import React from "react";
import { Loader2, RotateCw } from "lucide-react";

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

export interface BackfillDocTecnicaActionProps {
  job: any;
}

export const BackfillDocTecnicaAction: React.FC<BackfillDocTecnicaActionProps> = ({ job }) => {
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [backfilling, setBackfilling] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<any | null>(null);
  const [bfSound, setBfSound] = React.useState(true);
  const [bfLights, setBfLights] = React.useState(true);
  const [bfVideo, setBfVideo] = React.useState(true);
  const [bfProduction, setBfProduction] = React.useState(true);
  const [uuidSound, setUuidSound] = React.useState("");
  const [uuidLights, setUuidLights] = React.useState("");
  const [uuidVideo, setUuidVideo] = React.useState("");
  const [uuidProduction, setUuidProduction] = React.useState("");

  const runBackfill = async () => {
    setBackfilling(true);
    setMsg(null);
    setResult(null);
    try {
      const depts: string[] = [];
      if (bfSound) depts.push("sound");
      if (bfLights) depts.push("lights");
      if (bfVideo) depts.push("video");
      if (bfProduction) depts.push("production");
      const body: any = { job_id: job.id };
      if (depts.length) body.departments = depts;
      const manual: Array<{ dept: string; element_id: string }> = [];
      if (uuidSound.trim()) manual.push({ dept: "sound", element_id: uuidSound.trim() });
      if (uuidLights.trim()) manual.push({ dept: "lights", element_id: uuidLights.trim() });
      if (uuidVideo.trim()) manual.push({ dept: "video", element_id: uuidVideo.trim() });
      if (uuidProduction.trim()) manual.push({ dept: "production", element_id: uuidProduction.trim() });
      if (manual.length) body.manual = manual;
      const { data, error } = await supabase.functions.invoke("backfill-flex-doc-tecnica", { body });
      if (error) throw error;
      setResult(data);
      setMsg(`Inserted ${data?.inserted ?? 0}, already ${data?.already ?? 0}`);
      toast({
        title: "Backfill complete",
        description: `Inserted ${data?.inserted ?? 0}, already ${data?.already ?? 0}`,
      });
    } catch (err: any) {
      console.error("[BackfillDocTecnicaAction] Backfill error", err);
      setMsg(err?.message || "Backfill failed");
      toast({ title: "Backfill failed", description: err?.message || "Backfill failed", variant: "destructive" });
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        disabled={backfilling}
        title={backfilling ? "Rellenando…" : "Rellenar Doc Técnica"}
        className={backfilling ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/50"}
      >
        {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Backfill Documentación Técnica</DialogTitle>
            <DialogDescription>
              Finds and persists missing Documentación Técnica elements for this job so archiving can target them
              reliably.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bfSound} onChange={(e) => setBfSound(e.target.checked)} /> Sound
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bfLights} onChange={(e) => setBfLights(e.target.checked)} /> Lights
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bfVideo} onChange={(e) => setBfVideo(e.target.checked)} /> Video
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bfProduction}
                  onChange={(e) => setBfProduction(e.target.checked)}
                />{" "}
                Production
              </label>
            </div>
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">Manual UUIDs (optional)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs">Sound UUID</label>
                  <input
                    className="w-full h-8 rounded border px-2 text-xs"
                    value={uuidSound}
                    onChange={(e) => setUuidSound(e.target.value)}
                    placeholder="paste elementId"
                  />
                </div>
                <div>
                  <label className="text-xs">Lights UUID</label>
                  <input
                    className="w-full h-8 rounded border px-2 text-xs"
                    value={uuidLights}
                    onChange={(e) => setUuidLights(e.target.value)}
                    placeholder="paste elementId"
                  />
                </div>
                <div>
                  <label className="text-xs">Video UUID</label>
                  <input
                    className="w-full h-8 rounded border px-2 text-xs"
                    value={uuidVideo}
                    onChange={(e) => setUuidVideo(e.target.value)}
                    placeholder="paste elementId"
                  />
                </div>
                <div>
                  <label className="text-xs">Production UUID</label>
                  <input
                    className="w-full h-8 rounded border px-2 text-xs"
                    value={uuidProduction}
                    onChange={(e) => setUuidProduction(e.target.value)}
                    placeholder="paste elementId"
                  />
                </div>
              </div>
            </div>

            {backfilling && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Backfilling…
              </div>
            )}
            {msg && <div className="text-muted-foreground">{msg}</div>}
            {result?.details && (
              <div className="max-h-48 overflow-auto border rounded p-2 text-xs">
                {result.details.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-0.5">
                    <div className="truncate mr-2">{d.dept}</div>
                    <div className="truncate mr-2" title={d.elementId}>
                      {d.elementId}
                    </div>
                    <div className="text-muted-foreground">{d.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={backfilling}>
              Cerrar
            </Button>
            <Button onClick={runBackfill} disabled={backfilling}>
              {backfilling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

