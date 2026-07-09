import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, Copy, Loader2, Search } from "lucide-react";
import { format } from "date-fns";

import type { JobCardJob } from "@/components/jobs/cards/job-card-actions/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import {
  duplicateSoundDocumentation,
  SOUND_DOCUMENTATION_COPY_SCOPES,
  type SoundDocumentationCopyScope,
} from "@/utils/duplicateSoundDocumentation";

type SourceJob = {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
};

type DuplicateSoundDocumentationDialogProps = {
  job: JobCardJob;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const COPY_SCOPE_OPTIONS: Array<{
  description: string;
  label: string;
  scope: SoundDocumentationCopyScope;
}> = [
  {
    scope: "soundDocuments",
    label: "Sound docs",
    description: "Uploaded sound department files",
  },
  {
    scope: "power",
    label: "Power / Consumos",
    description: "Editable tables and latest generated report",
  },
  {
    scope: "soundvision",
    label: "SoundVision",
    description: "Venue template and latest generated SV report",
  },
  {
    scope: "material",
    label: "Lista de material",
    description: "Latest Flex material-list PDF",
  },
  {
    scope: "memoria",
    label: "Memoria",
    description: "Stage records for regenerating Memoria Técnica",
  },
];

const formatJobDate = (value: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return format(parsed, "dd MMM yyyy");
};

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const buildResultDescription = (result: Awaited<ReturnType<typeof duplicateSoundDocumentation>>) => {
  const parts = [
    result.copiedDocuments ? `${result.copiedDocuments} documentos` : null,
    result.copiedPowerTables ? `${result.copiedPowerTables} tablas de consumos` : null,
    result.copiedMemoriaRows ? `${result.copiedMemoriaRows} registros de memoria` : null,
  ].filter(Boolean);

  const base = parts.length > 0 ? parts.join(", ") : "No se encontraron documentos para copiar";
  return result.skippedDocuments > 0
    ? `${base}. ${result.skippedDocuments} documentos no se pudieron copiar.`
    : `${base}.`;
};

export const DuplicateSoundDocumentationDialog = ({
  job,
  onOpenChange,
  open,
}: DuplicateSoundDocumentationDialogProps) => {
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [selectedSourceJobId, setSelectedSourceJobId] = React.useState("");
  const [selectedScopes, setSelectedScopes] = React.useState<SoundDocumentationCopyScope[]>([
    ...SOUND_DOCUMENTATION_COPY_SCOPES,
  ]);
  const [isCopying, setIsCopying] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedSourceJobId("");
      setSelectedScopes([...SOUND_DOCUMENTATION_COPY_SCOPES]);
      setIsCopying(false);
    }
  }, [open]);

  const { data: sourceJobs = [], isLoading } = useQuery<SourceJob[]>({
    queryKey: queryKeys.scope("sound-documentation-copy-source-jobs", job.id),
    enabled: open && Boolean(job.id),
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from("jobs")
        .select("id, title, start_time, end_time")
        .neq("id", job.id)
        .in("job_type", ["single", "festival", "ciclo", "tourdate"])
        .order("start_time", { ascending: false })
        .limit(250);

      if (error) throw error;
      return (data || []) as SourceJob[];
    },
  });

  const filteredJobs = React.useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return sourceJobs;

    return sourceJobs.filter((sourceJob) => {
      const haystack = normalizeSearch(`${sourceJob.title} ${formatJobDate(sourceJob.start_time)}`);
      return haystack.includes(normalizedQuery);
    });
  }, [query, sourceJobs]);

  const selectedSourceJob = sourceJobs.find((sourceJob) => sourceJob.id === selectedSourceJobId);
  const canCopy = Boolean(selectedSourceJobId && selectedScopes.length > 0 && !isCopying);

  const toggleScope = (scope: SoundDocumentationCopyScope, checked: boolean) => {
    setSelectedScopes((current) =>
      checked
        ? Array.from(new Set([...current, scope]))
        : current.filter((selectedScope) => selectedScope !== scope)
    );
  };

  const handleCopy = async () => {
    if (!selectedSourceJob) return;

    setIsCopying(true);
    try {
      const result = await duplicateSoundDocumentation({
        sourceJobId: selectedSourceJob.id,
        sourceJobTitle: selectedSourceJob.title,
        targetJobDate: job.start_time || job.date || null,
        targetJobId: job.id,
        targetJobTitle: job.title || job.name || job.job_name,
        scopes: selectedScopes,
      });

      toast({
        title: "Documentación copiada",
        description: buildResultDescription(result),
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error duplicating sound documentation:", error);
      toast({
        title: "No se pudo copiar",
        description: error instanceof Error ? error.message : "Error al duplicar la documentación de sonido.",
        variant: "destructive",
      });
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Duplicar documentación de sonido</DialogTitle>
          <DialogDescription>
            Copia documentación técnica desde otro trabajo a {job.title || job.name || "este trabajo"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="sound-doc-source-search">Trabajo origen</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="sound-doc-source-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar trabajo"
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-56 rounded-md border">
              <div className="divide-y">
                {isLoading ? (
                  <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando trabajos
                  </div>
                ) : filteredJobs.length > 0 ? (
                  filteredJobs.map((sourceJob) => {
                    const selected = sourceJob.id === selectedSourceJobId;
                    return (
                      <button
                        key={sourceJob.id}
                        type="button"
                        onClick={() => setSelectedSourceJobId(sourceJob.id)}
                        className={[
                          "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                          selected ? "bg-primary/10 text-primary" : "hover:bg-muted",
                        ].join(" ")}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{sourceJob.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatJobDate(sourceJob.start_time)}
                          </span>
                        </span>
                        {selected && <CheckSquare className="h-4 w-4 shrink-0" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="flex h-24 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    No hay trabajos que coincidan.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-3">
            <Label>Categorías</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {COPY_SCOPE_OPTIONS.map((option) => {
                const checked = selectedScopes.includes(option.scope);
                return (
                  <label
                    key={option.scope}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleScope(option.scope, value === true)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCopying}>
            Cancelar
          </Button>
          <Button onClick={handleCopy} disabled={!canCopy} className="gap-2">
            {isCopying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Copiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
