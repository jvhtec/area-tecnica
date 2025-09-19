import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Plus, Trash2 } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { exportToPDF } from "@/utils/pdfExport";
import { supabase } from "@/lib/supabase";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useJobSelection } from "@/hooks/useJobSelection";

import { TRUSS_MODELS } from "@/data/trussModels";
import { HOIST_CATALOG } from "@/data/hoists";
import { solveTrussWithTilt, suggestHoists, type Fixture, type Support, type TrussModel } from "@/calc/rigging";

const FIXTURES_DB = [
  { id: 7, name: "MARTIN MAC VIPER", weight: 39 },
  { id: 8, name: "ROBE BMFL BLADE", weight: 40 },
  { id: 10, name: "ROBE BMFL WASHBEAM", weight: 41 },
  { id: 11, name: "ROBE MEGAPOINTE", weight: 24 },
  { id: 33, name: "SUNSTRIP", weight: 7 },
];

type UITruss = {
  id: string;            // lt1, lt2, …
  modelId: string;
  tiltDeg: number;
  fixtures: { fixtureId: number; qty: number; x: number }[];
  supports: Support[];   // rigging points
  addCablePick: boolean;
  results?: {
    reactionsKg: number[];
    hoistPicks: { support: string; requiredKg: number; hoistName: string }[];
    maxMomentNm: number;
    maxDeflMm: number;
    okMoment?: boolean;
    okDefl?: boolean;
  };
  suggestion?: { message: string; severity: "warn" | "error" };
};

const autoName = (n: number) => `lt${n}`;
const findTruss = (id: string): TrussModel | undefined => TRUSS_MODELS.find(t => t.id === id);

const LightsRiggingPlanner: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();

  const tourId = searchParams.get("tourId");
  const mode = searchParams.get("mode");
  const isTourDefaults = mode === "tour-defaults";

  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const selectedJob = useMemo(() => jobs?.find(j => j.id === selectedJobId), [jobs, selectedJobId]);

  const [trusses, setTrusses] = useState<UITruss[]>([]);

  const addTruss = () => {
    const nextName = autoName(trusses.length + 1);
    const defaultModel = TRUSS_MODELS[0]?.id ?? "";
    const L = TRUSS_MODELS[0]?.lengthM ?? 8;
    setTrusses(prev => [
      ...prev,
      {
        id: nextName,
        modelId: defaultModel,
        tiltDeg: 0,
        fixtures: [],
        supports: [
          { x: Math.max(0.5, 0.1 * L), label: "H1" },
          { x: Math.min(L - 0.5, 0.9 * L), label: "H2" }
        ],
        addCablePick: false
      }
    ]);
  };

  const removeTruss = (id: string) => setTrusses(prev => prev.filter(t => t.id !== id));

  const updateTruss = (id: string, patch: Partial<UITruss>) =>
    setTrusses(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));

  const addFixtureRow = (tid: string) =>
    setTrusses(prev =>
      prev.map(t =>
        t.id === tid
          ? { ...t, fixtures: [...t.fixtures, { fixtureId: FIXTURES_DB[0].id, qty: 1, x: 0.5 }] }
          : t
      )
    );

  const removeFixtureRow = (tid: string, idx: number) =>
    setTrusses(prev =>
      prev.map(t => (t.id === tid ? { ...t, fixtures: t.fixtures.filter((_, i) => i !== idx) } : t))
    );

  const addSupport = (tid: string) =>
    setTrusses(prev =>
      prev.map(t => {
        if (t.id !== tid) return t;
        const tr = findTruss(t.modelId);
        const L = tr?.lengthM ?? 8;
        const nextIndex = t.supports.length + 1;
        return {
          ...t,
          supports: [...t.supports, { x: Math.min(L - 0.3, (nextIndex / (nextIndex + 1)) * L), label: `H${nextIndex}` }]
        };
      })
    );

  const removeSupport = (tid: string, idx: number) =>
    setTrusses(prev =>
      prev.map(t =>
        t.id === tid
          ? {
              ...t,
              supports: t.supports.filter((_, i) => i !== idx).map((s, i) => ({ ...s, label: `H${i + 1}` }))
            }
          : t
      )
    );

  const solveOne = (t: UITruss) => {
    const tr = findTruss(t.modelId);
    if (!tr) {
      updateTruss(t.id, { suggestion: { message: "Select a truss model.", severity: "warn" } });
      return;
    }
    const L = tr.lengthM;
    const fx: Fixture[] = t.fixtures.map(row => {
      const f = FIXTURES_DB.find(i => i.id === row.fixtureId)!;
      return { x: clamp(row.x, 0, L), qty: row.qty, weightKg: f.weight, name: f.name };
    });

    const result = solveTrussWithTilt(
      tr,
      {
        fixtures: fx,
        includeMotorWeightOnTruss: false,
        motorWeightKgEach: 0,
        dynamicFactor: 1.2
      },
      {
        supports: t.supports,
        tiltDeg: t.tiltDeg,
        nElements: 32
      }
    );

    const picks = suggestHoists(result.supportReactionsKg, HOIST_CATALOG).map(p => ({
      support: p.support,
      requiredKg: p.requiredKg,
      hoistName: p.hoist.name
    }));

    let suggestion: UITruss["suggestion"];
    if (result.okAgainstAllowables.moment === false || result.okAgainstAllowables.deflection === false) {
      suggestion = {
        severity: "warn",
        message: "Truss model may be insufficient (moment/deflection). Consider upgrading model or adding supports."
      };
    } else {
      suggestion = undefined;
    }

    updateTruss(t.id, {
      results: {
        reactionsKg: result.supportReactionsKg,
        hoistPicks: picks,
        maxMomentNm: Math.round(result.maxMomentNm),
        maxDeflMm: Math.round(result.maxDeflectionM * 1000),
        okMoment: result.okAgainstAllowables.moment,
        okDefl: result.okAgainstAllowables.deflection
      },
      suggestion
    });
  };

  const solveAll = () => trusses.forEach(solveOne);

  const handleExportPDF = async () => {
    if (!isTourDefaults && !selectedJobId) {
      toast({ title: "No job selected", description: "Select a job before exporting.", variant: "destructive" });
      return;
    }
    try {
      const tables = trusses.map(t => {
        const rows = [
          // fixtures rows
          ...t.fixtures.map(fx => {
            const f = FIXTURES_DB.find(i => i.id === fx.fixtureId)!;
            return {
              quantity: String(fx.qty),
              componentName: f.name,
              weight: String(f.weight),
              x: fx.x
            };
          }),
          // supports rows
          ...(t.results?.hoistPicks.map((h, i) => ({
            componentName: h.support,
            reactionKg: t.results?.reactionsKg[i],
            hoistName: h.hoistName
          })) ?? [])
        ];
        const totalWeight = t.results ? t.results.reactionsKg.reduce((a, b) => a + b, 0) : 0;
        return {
          name: t.id,
          rows,
          totalWeight,
          toolType: 'rigging' as const,
          maxMomentNm: t.results?.maxMomentNm,
          maxDeflectionMm: t.results?.maxDeflMm,
          okMoment: t.results?.okMoment,
          okDefl: t.results?.okDefl,
          cablePick: t.addCablePick
        };
      });

      const title = isTourDefaults ? "Tour Lights Rigging Defaults" : (selectedJob?.title ?? "Rigging Report");
      const pdfBlob = await exportToPDF(
        title,
        tables,
        'rigging',
        title,
        selectedJob?.start_time || new Date().toISOString(),
        trusses.map(t => ({
          clusterName: t.id,
          riggingPoints: String(t.supports.length),
          clusterWeight: t.results ? Math.round(t.results.reactionsKg.reduce((a, b) => a + b, 0)) : 0
        }))
      );

      const fileName = `${title} - Rigging.pdf`;
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      if (!isTourDefaults && selectedJobId) {
        const file = new File([pdfBlob], fileName, { type: "application/pdf" });
        const filePath = `lights/${selectedJobId}/${crypto.randomUUID()}.pdf`;
        await supabase.storage.from("task_documents").upload(filePath, file);
      }

      toast({ title: "Success", description: "PDF generated." });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to export PDF.", variant: "destructive" });
    }
  };

  return (
    <Card className="w-full max-w-5xl mx-auto my-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">Rigging Planner (Tilt-accurate)</CardTitle>
          <div className="flex gap-2 items-center">
            {isTourDefaults && <Badge variant="outline">Tour Defaults</Badge>}
            <Button variant="secondary" onClick={solveAll}>Solve All</Button>
            {trusses.length > 0 && (
              <Button variant="outline" onClick={handleExportPDF} className="gap-2">
                <FileText className="h-4 w-4" /> Export PDF
              </Button>
            )}
          </div>
        </div>

        {!isTourDefaults && (
          <div className="grid gap-2 max-w-sm">
            <Label>Select Job</Label>
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
              <SelectContent>
                {jobs?.map(job => (
                  <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex justify-between">
          <Button onClick={addTruss} className="gap-2"><Plus className="h-4 w-4" /> Add Truss</Button>
        </div>

        {trusses.map((t) => {
          const model = findTruss(t.modelId) ?? TRUSS_MODELS[0];
          return (
            <div key={t.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-lg">{t.id}</h3>
                  <Select value={t.modelId} onValueChange={(v) => updateTruss(t.id, { modelId: v })}>
                    <SelectTrigger className="w-64"><SelectValue placeholder="Truss model" /></SelectTrigger>
                    <SelectContent>
                      {TRUSS_MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Label className="whitespace-nowrap">Tilt (°)</Label>
                    <Input
                      type="number"
                      value={t.tiltDeg}
                      onChange={(e) => updateTruss(t.id, { tiltDeg: Number(e.target.value) })}
                      className="w-24"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`${t.id}-cable`}
                      checked={t.addCablePick}
                      onCheckedChange={(v) => updateTruss(t.id, { addCablePick: !!v })}
                    />
                    <Label htmlFor={`${t.id}-cable`}>Cable pick</Label>
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => removeTruss(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Supports */}
              <div className="space-y-2">
                <Label>Rigging points (supports)</Label>
                <div className="flex flex-wrap gap-3">
                  {t.supports.map((s, sIdx) => (
                    <div key={sIdx} className="flex items-center gap-2">
                      <Badge>{s.label ?? `H${sIdx + 1}`}</Badge>
                      <Label>X (m)</Label>
                      <Input
                        type="number"
                        value={s.x}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const supports = [...t.supports];
                          supports[sIdx] = { ...supports[sIdx], x: clamp(v, 0, model.lengthM) };
                          updateTruss(t.id, { supports });
                        }}
                        className="w-24"
                        step="0.1"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeSupport(t.id, sIdx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="secondary" onClick={() => addSupport(t.id)}>Add support</Button>
                </div>
              </div>

              {/* Fixtures */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Fixtures on truss (x in meters from left)</Label>
                  <Button variant="secondary" size="sm" onClick={() => addFixtureRow(t.id)}>
                    <Plus className="h-4 w-4" /> Add fixture
                  </Button>
                </div>
                <div className="space-y-2">
                  {t.fixtures.map((row, rIdx) => (
                    <div key={rIdx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <Select
                          value={String(row.fixtureId)}
                          onValueChange={(v) => {
                            const fixtures = [...t.fixtures];
                            fixtures[rIdx] = { ...fixtures[rIdx], fixtureId: Number(v) };
                            updateTruss(t.id, { fixtures });
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Fixture" /></SelectTrigger>
                          <SelectContent>
                            {FIXTURES_DB.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          value={row.qty}
                          onChange={(e) => {
                            const fixtures = [...t.fixtures];
                            fixtures[rIdx] = { ...fixtures[rIdx], qty: Number(e.target.value) };
                            updateTruss(t.id, { fixtures });
                          }}
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">X (m)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={row.x}
                          onChange={(e) => {
                            const fixtures = [...t.fixtures];
                            fixtures[rIdx] = { ...fixtures[rIdx], x: Number(e.target.value) };
                            updateTruss(t.id, { fixtures });
                          }}
                        />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button variant="ghost" size="icon" onClick={() => removeFixtureRow(t.id, rIdx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Solve + Results */}
              <div className="flex gap-2">
                <Button onClick={() => solveOne(t)}>Solve</Button>
              </div>

              {t.results && (
                <div className="rounded-md border p-3 bg-muted/50">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span>Max M: <b>{t.results.maxMomentNm} N·m</b></span>
                    <span>Max defl: <b>{t.results.maxDeflMm} mm</b></span>
                    {t.results.okMoment !== undefined && (
                      <span>Moment check: <b>{t.results.okMoment ? "OK" : "FAIL"}</b></span>
                    )}
                    {t.results.okDefl !== undefined && (
                      <span>Deflection check: <b>{t.results.okDefl ? "OK" : "FAIL"}</b></span>
                    )}
                  </div>
                  <div className="mt-2">
                    <Label>Per-hoist loads & suggestions</Label>
                    <ul className="list-disc pl-6 text-sm">
                      {t.results.hoistPicks.map((h, i) => (
                        <li key={i}>
                          {h.support}: need ~{t.results?.reactionsKg[i].toFixed(0)} kg → <b>{h.hoistName}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {t.suggestion && (
                    <div className={`mt-2 text-sm ${t.suggestion.severity === "error" ? "text-red-700" : "text-amber-700"}`}>
                      {t.suggestion.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default LightsRiggingPlanner;

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

