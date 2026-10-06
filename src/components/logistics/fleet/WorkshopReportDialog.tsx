import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FleetVehicle } from "@/features/logistics/fleet/fleetModel";
import { listWorkshopAppointments } from "@/features/logistics/fleet/workshopApi";
import { createWorkshopReport, workshopReportPeriod } from "@/features/logistics/fleet/workshopReport";
import { formatMadridDateKey } from "@/utils/timezoneUtils";
import { getErrorMessage } from "@/utils/errorMessage";

export function WorkshopReportDialog({ vehicles }: { vehicles: FleetVehicle[] }) {
  const today = formatMadridDateKey(new Date());
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"monthly" | "weekly">("monthly");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportReport = async () => {
    setSaving(true); setError(null);
    try {
      const { first, last } = workshopReportPeriod(mode, mode === "monthly" ? month : day);
      const appointments = await listWorkshopAppointments(first, last);
      const workbook = await createWorkshopReport(vehicles, appointments, first, last);
      const buffer = await workbook.xlsx.writeBuffer();
      const { saveAs } = await import("file-saver");
      saveAs(new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `flota-${mode === "monthly" ? "mensual" : "semanal"}-${first}-${last}.xlsx`);
    } catch (failure) { setError(getErrorMessage(failure)); }
    finally { setSaving(false); }
  };
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}><FileSpreadsheet className="mr-2 h-4 w-4" /> Informe Excel</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Informe de todos los vehículos</DialogTitle><DialogDescription>Excel con un resumen de toda la flota y el detalle de las citas del periodo, incluidos vehículos sin citas.</DialogDescription></DialogHeader>
        <Label htmlFor="report-period">Periodo</Label>
        <select id="report-period" className="h-10 rounded-md border bg-background px-3" value={mode} disabled={saving} onChange={(event) => setMode(event.target.value as "monthly" | "weekly")}><option value="monthly">Mensual</option><option value="weekly">Semanal (lunes a domingo)</option></select>
        {mode === "monthly" ? <><Label htmlFor="report-month">Mes</Label><Input id="report-month" type="month" value={month} disabled={saving} onChange={(event) => setMonth(event.target.value)} /></>
          : <><Label htmlFor="report-day">Un día de la semana que quieres exportar</Label><Input id="report-day" type="date" value={day} disabled={saving} onChange={(event) => setDay(event.target.value)} /></>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button disabled={saving || !(mode === "monthly" ? month : day)} onClick={() => void exportReport()}>{saving ? "Preparando Excel…" : "Descargar Excel"}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
