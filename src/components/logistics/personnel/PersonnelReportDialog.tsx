import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FleetVehicle, MatrixDriver } from "@/features/logistics/fleet/fleetModel";
import { workshopReportPeriod } from "@/features/logistics/fleet/workshopReport";
import { listPersonnelPlans } from "@/features/logistics/personnel/personnelApi";
import { createPersonnelReport } from "@/features/logistics/personnel/personnelReport";
import type { PersonnelOptions } from "@/features/logistics/personnel/personnelModel";
import { formatMadridDateKey } from "@/utils/timezoneUtils";
import { getErrorMessage } from "@/utils/errorMessage";
import { listOperations } from "@/features/logistics/operations/operationsApi";
import { addOperationsCosts } from "@/features/logistics/operations/operationsReport";
import { PERSONNEL_STATUSES } from "@/features/logistics/personnel/personnelModel";

export function PersonnelReportDialog({ vehicles, drivers, options }: { vehicles: FleetVehicle[]; drivers: MatrixDriver[]; options: PersonnelOptions }) {
  const today = formatMadridDateKey(new Date());
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"monthly" | "weekly">("monthly");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setSaving(true); setError(null);
    try {
      const { first, last } = workshopReportPeriod(mode, mode === "monthly" ? month : day);
      const plans = await listPersonnelPlans(first, last);
      const workbook = await createPersonnelReport(plans, first, last, vehicles, drivers, options);
      const operations = await listOperations();
      addOperationsCosts(workbook, plans.map((plan) => ({ id: plan.id, kind: "personnel", title: plan.title, eventId: plan.job_id, eventTitle: options.jobs.find((job) => job.id === plan.job_id)?.title, date: formatMadridDateKey(new Date(plan.starts_at)), status: PERSONNEL_STATUSES[plan.status] })), operations, { first, last });
      const buffer = await workbook.xlsx.writeBuffer();
      const { saveAs } = await import("file-saver");
      saveAs(new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `personal-${mode === "monthly" ? "mensual" : "semanal"}-${first}-${last}.xlsx`);
    } catch (failure) { setError(getErrorMessage(failure)); }
    finally { setSaving(false); }
  };
  return <><Button variant="outline" onClick={() => setOpen(true)}>Informe Excel de personal</Button><Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}><DialogContent>
    <DialogHeader><DialogTitle>Informe de logística de personal</DialogTitle></DialogHeader>
    <Label htmlFor="personnel-report-mode">Periodo</Label><select id="personnel-report-mode" className="h-10 rounded-md border bg-background px-3" disabled={saving} value={mode} onChange={(event) => setMode(event.target.value as "monthly" | "weekly")}><option value="monthly">Mensual</option><option value="weekly">Semanal (lunes a domingo)</option></select>
    {mode === "monthly" ? <><Label htmlFor="personnel-report-month">Mes del informe</Label><Input id="personnel-report-month" type="month" disabled={saving} value={month} onChange={(event) => setMonth(event.target.value)} /></> : <><Label htmlFor="personnel-report-day">Un día de la semana</Label><Input id="personnel-report-day" type="date" disabled={saving} value={day} onChange={(event) => setDay(event.target.value)} /></>}
    <p className="text-sm text-muted-foreground">El informe abre con una ficha en dos columnas por traslado (formato 03), con ruta, vehículo, conductor, hotel e instrucciones. También incluye resumen y listados. Las estancias se incluyen si coinciden con el periodo, aunque el traslado sea de otro día.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button disabled={saving || !(mode === "monthly" ? month : day)} onClick={() => void download()}>{saving ? "Preparando Excel…" : "Descargar Excel de personal"}</Button>
  </DialogContent></Dialog></>;
}
