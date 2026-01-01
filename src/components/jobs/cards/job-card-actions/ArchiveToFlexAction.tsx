import React from "react";
import { Archive, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export interface ArchiveToFlexActionProps {
  job: any;
}

export const ArchiveToFlexAction: React.FC<ArchiveToFlexActionProps> = ({ job }) => {
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [result, setResult] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"by-prefix" | "all-tech">("by-prefix");
  const [includeTemplates, setIncludeTemplates] = React.useState(false);
  const [dryRun, setDryRun] = React.useState(false);

  if (job?.job_type === "dryhire") {
    return null;
  }

  const handleArchive = async () => {
    setArchiving(true);
    setError(null);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("archive-to-flex", {
        body: {
          job_id: job.id,
          mode,
          include_templates: includeTemplates,
          dry_run: dryRun,
        },
      });
      if (error) throw error;
      setResult(data);
      toast({
        title: dryRun ? "Dry run complete" : "Archive complete",
        description: `${data?.uploaded ?? 0} uploaded, ${data?.failed ?? 0} failed`,
      });
    } catch (err: any) {
      console.error("[ArchiveToFlexAction] ArchiveToFlex error", err);
      setError(err?.message || "Failed to archive");
      toast({
        title: "Archive failed",
        description: err?.message || "Failed to archive",
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="gap-2"
        title="Archivar documentos en Flex"
      >
        <Archive className="h-4 w-4" />
        <span className="hidden sm:inline">Archivar</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Archive documents to Flex</DialogTitle>
            <DialogDescription>
              Uploads all job documents to each department&apos;s Documentación Técnica in Flex and removes them from
              Supabase.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mode</label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "by-prefix" | "all-tech")}
                >
                  <option value="by-prefix">By prefix (default)</option>
                  <option value="all-tech">All technical depts</option>
                </select>
              </div>
              <div className="flex items-center gap-2 mt-6 sm:mt-[30px]">
                <input
                  id="includeTemplatesA"
                  type="checkbox"
                  checked={includeTemplates}
                  onChange={(e) => setIncludeTemplates(e.target.checked)}
                />
                <label htmlFor="includeTemplatesA" className="text-sm">
                  Include templates
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input id="dryRunA" type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                <label htmlFor="dryRunA" className="text-sm">
                  Dry run (no delete)
                </label>
              </div>
            </div>

            {archiving && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Archiving...
              </div>
            )}

            {error && <div className="text-sm text-red-600">{error}</div>}

            {result && (
              <div className="space-y-3">
                <div className="text-sm">Summary</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    Attempted: <span className="font-medium">{result.attempted ?? 0}</span>
                  </div>
                  <div>
                    Uploaded: <span className="font-medium">{result.uploaded ?? 0}</span>
                  </div>
                  <div>
                    Skipped: <span className="font-medium">{result.skipped ?? 0}</span>
                  </div>
                  <div>
                    Failed: <span className="font-medium">{result.failed ?? 0}</span>
                  </div>
                </div>
                {result.details && Array.isArray(result.details) && (
                  <div className="max-h-48 overflow-auto border rounded p-2 text-xs">
                    {result.details.map((d: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between py-0.5">
                        <div className="truncate mr-2" title={d.file}>
                          {d.file}
                        </div>
                        <div className="text-muted-foreground">{d.status}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={archiving}>
              Cerrar
            </Button>
            <Button onClick={handleArchive} disabled={archiving}>
              {archiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {dryRun ? "Prueba" : "Iniciar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

