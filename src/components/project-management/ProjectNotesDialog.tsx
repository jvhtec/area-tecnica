import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, NotebookPen, Save } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";

type ProjectNotesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  canManageNotes: boolean;
};

type JobProjectNoteRow = {
  job_id: string;
  notes: string;
  updated_at: string;
  updated_by: string | null;
};

const formatUpdatedAt = (value?: string | null) => {
  if (!value) return null;

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const ProjectNotesDialog = ({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  canManageNotes,
}: ProjectNotesDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState("");

  const notesQuery = useQuery({
    queryKey: queryKeys.scope("job-project-notes", jobId),
    enabled: open && canManageNotes && Boolean(jobId),
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from("job_project_notes")
        .select("job_id, notes, updated_at, updated_by")
        .eq("job_id", jobId)
        .maybeSingle();

      if (error) throw error;
      return data as JobProjectNoteRow | null;
    },
  });

  React.useEffect(() => {
    if (!open || notesQuery.isLoading) return;
    setDraft(notesQuery.data?.notes ?? "");
  }, [notesQuery.data?.notes, notesQuery.isLoading, open]);

  const saveNotes = useMutation({
    mutationFn: async (notes: string) => {
      const { data: authData } = await dataLayerClient.auth.getUser();
      const { error } = await dataLayerClient
        .from("job_project_notes")
        .upsert(
          {
            job_id: jobId,
            notes,
            updated_by: authData.user?.id ?? null,
          },
          { onConflict: "job_id" },
        );

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.scope("job-project-notes", jobId),
      });
      toast({
        title: "Notas guardadas",
        description: "Las notas del proyecto se han actualizado.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "No se pudieron guardar las notas",
        description: error instanceof Error ? error.message : "Intentalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  if (!canManageNotes) return null;

  const updatedAt = formatUpdatedAt(notesQuery.data?.updated_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden border-slate-300 p-0 shadow-2xl dark:border-slate-700">
        <DialogHeader className="border-b bg-slate-50 px-5 py-4 pr-12 dark:bg-slate-900">
          <DialogTitle className="flex min-w-0 items-center gap-2">
            <NotebookPen className="h-5 w-5 shrink-0 text-slate-600 dark:text-slate-300" />
            <span className="truncate">Notas de produccion</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Notas internas del proyecto para usuarios admin y management.
          </DialogDescription>
          <div className="min-w-0 text-sm text-muted-foreground">
            <div className="truncate">{jobTitle}</div>
            {updatedAt && <div className="mt-1 text-xs">Actualizado {updatedAt}</div>}
          </div>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveNotes.mutate(draft);
          }}
        >
          <div className="p-5">
            {notesQuery.isLoading ? (
              <div className="flex min-h-[45vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : notesQuery.isError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                No se pudieron cargar las notas.
              </div>
            ) : (
              <Textarea
                aria-label="Notas de produccion"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-[45vh] resize-none whitespace-pre-wrap border-slate-300 bg-background text-base leading-7 shadow-inner dark:border-slate-700"
                autoFocus
              />
            )}
          </div>

          <DialogFooter className="gap-2 border-t px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveNotes.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={notesQuery.isLoading || notesQuery.isError || saveNotes.isPending}
              className="gap-2"
            >
              {saveNotes.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
