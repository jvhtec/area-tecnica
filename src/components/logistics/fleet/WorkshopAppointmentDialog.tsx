import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { saveWorkshopAppointment, useInvalidateWorkshop } from "@/features/logistics/fleet/workshopApi";
import { WORKSHOP_STATUSES, type WorkshopAppointment, type WorkshopDraft, type WorkshopStatus } from "@/features/logistics/fleet/workshopModel";
import type { FleetVehicle } from "@/features/logistics/fleet/fleetModel";
import { formatInJobTimezone } from "@/utils/timezoneUtils";
import { getErrorMessage } from "@/utils/errorMessage";

type Props = {
  appointment: WorkshopAppointment | null;
  vehicleId: string; day: string; vehicles: FleetVehicle[];
  readOnly: boolean; onClose: () => void;
};

export function WorkshopAppointmentDialog({ appointment, vehicleId, day, vehicles, readOnly, onClose }: Props) {
  const { toast } = useToast();
  const invalidate = useInvalidateWorkshop();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkshopDraft>(() => ({
    vehicleId: appointment?.vehicle_id ?? vehicleId,
    start: appointment ? formatInJobTimezone(appointment.starts_at, "yyyy-MM-dd'T'HH:mm") : `${day}T09:00`,
    end: appointment ? formatInJobTimezone(appointment.ends_at, "yyyy-MM-dd'T'HH:mm") : `${day}T11:00`,
    workshop: appointment?.workshop ?? "", reason: appointment?.reason ?? "",
    notes: appointment?.notes ?? "", mileage: appointment?.mileage_km?.toString() ?? "",
    status: appointment?.status ?? "scheduled",
  }));
  const change = <K extends keyof WorkshopDraft>(key: K, value: WorkshopDraft[K]) => setDraft((old) => ({ ...old, [key]: value }));
  const submit = async () => {
    if (readOnly || saving) return;
    setSaving(true); setError(null);
    try {
      await saveWorkshopAppointment(draft, appointment);
      toast({ title: appointment ? "Cita actualizada" : "Cita de taller creada" });
      await invalidate();
      onClose();
    } catch (failure) {
      setError(getErrorMessage(failure));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{readOnly ? "Cita de taller" : appointment ? "Editar cita de taller" : "Nueva cita de taller"}</DialogTitle></DialogHeader>
        <form id="workshop-appointment" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <fieldset disabled={readOnly || saving} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="workshop-vehicle">Vehículo</Label>
              <Select value={draft.vehicleId} onValueChange={(value) => change("vehicleId", value)} disabled={readOnly || saving}>
                <SelectTrigger id="workshop-vehicle"><SelectValue placeholder="Selecciona un vehículo" /></SelectTrigger>
                <SelectContent>{vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.license_plate}{!vehicle.is_active ? " · inactivo" : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label htmlFor="workshop-start">Entrada</Label><Input id="workshop-start" type="datetime-local" required value={draft.start} onChange={(event) => change("start", event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="workshop-end">Salida prevista</Label><Input id="workshop-end" type="datetime-local" required value={draft.end} onChange={(event) => change("end", event.target.value)} /></div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Horario de Madrid. El vehículo queda reservado entre la entrada y la salida prevista mientras la cita esté programada o en taller.</p>
            <div className="space-y-1"><Label htmlFor="workshop-name">Taller</Label><Input id="workshop-name" maxLength={160} required value={draft.workshop} onChange={(event) => change("workshop", event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="workshop-mileage">Kilometraje (opcional)</Label><Input id="workshop-mileage" type="number" min={0} max={2147483647} step={1} value={draft.mileage} onChange={(event) => change("mileage", event.target.value)} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="workshop-reason">Motivo</Label><Input id="workshop-reason" placeholder="Revisión, ITV, reparación…" maxLength={200} required value={draft.reason} onChange={(event) => change("reason", event.target.value)} /></div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="workshop-status">Estado</Label>
              <Select value={draft.status} onValueChange={(value) => change("status", value as WorkshopStatus)} disabled={readOnly || saving}>
                <SelectTrigger id="workshop-status"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(WORKSHOP_STATUSES).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="workshop-notes">Observaciones</Label><Textarea id="workshop-notes" rows={3} maxLength={2000} value={draft.notes} onChange={(event) => change("notes", event.target.value)} /></div>
          </fieldset>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cerrar</Button>
          {!readOnly && <Button type="submit" form="workshop-appointment" disabled={saving}>{saving ? "Guardando…" : "Guardar cita"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
