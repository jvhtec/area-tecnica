import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { operationsRoot, saveOperation, useOperationHistory, useLogisticsResponsibles } from "@/features/logistics/operations/operationsApi";
import { parseCost, type Operation, type WorkItem } from "@/features/logistics/operations/operationsModel";
import type { MatrixDriver } from "@/features/logistics/fleet/fleetModel";
import { formatInJobTimezone } from "@/utils/timezoneUtils";
import { getErrorMessage } from "@/utils/errorMessage";

const fieldLabels: Record<string, string> = { responsible_id: "Responsable", transport_company: "Empresa de transporte", transport_cost: "Coste de transporte", hotel_cost: "Coste de hotel", other_cost: "Otros gastos", cost_notes: "Observaciones de costes", in_progress: "Servicio en curso", status: "Estado", planning_status: "Estado de solicitud", starts_at: "Salida", ends_at: "Llegada", vehicle_id: "Vehículo", driver_id: "Conductor", hotel_name: "Hotel", destination_location_id: "Destino", origin_location_id: "Origen", people_count: "Personas", notes: "Observaciones", needed_at: "Fecha necesaria", destination: "Destino", origin: "Origen", event_date: "Fecha", event_time: "Hora" };
export function OperationDetailsDialog({ item, operation, readOnly, onClose }: { item: WorkItem; operation?: Operation; drivers: MatrixDriver[]; readOnly: boolean; onClose: () => void }) {
  const client = useQueryClient();
  const history = useOperationHistory(item.kind, item.id);
  const responsibles = useLogisticsResponsibles();
  const [responsible, setResponsible] = useState(operation?.responsible_id ?? "");
  const [transport, setTransport] = useState(operation?.transport_cost?.toString() ?? "");
  const [hotel, setHotel] = useState(operation?.hotel_cost?.toString() ?? "");
  const [other, setOther] = useState(operation?.other_cost?.toString() ?? "");
  const [notes, setNotes] = useState(operation?.cost_notes ?? "");
  const [company, setCompany] = useState(operation?.transport_company ?? "");
  const [progress, setProgress] = useState(operation?.in_progress ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirmed = item.kind === "personnel" ? "status" in item.source && item.source.status === "confirmed" : "planning_status" in item.source && item.source.planning_status === "confirmed";
  async function save() {
    setSaving(true); setError("");
    try {
      await saveOperation({ entity_kind: item.kind, entity_id: item.id, responsible_id: responsible || null, transport_company: company.trim(), transport_cost: parseCost(transport), hotel_cost: parseCost(hotel), other_cost: parseCost(other), cost_notes: notes, in_progress: confirmed && progress }, operation?.updated_at ?? null);
      await client.invalidateQueries({ queryKey: [operationsRoot] }); onClose();
    } catch (failure) { setError(getErrorMessage(failure)); } finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Gestión del servicio · {item.title}</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">{item.kind === "material" ? "Material" : "Personal"} · {item.status}. Los importes son el total del servicio en euros; un campo vacío indica coste pendiente.</p>
    <fieldset disabled={readOnly || saving} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="operation-owner">Responsable de logística</Label><select id="operation-owner" className="h-10 w-full rounded-md border bg-background px-3" value={responsible} onChange={(e) => setResponsible(e.target.value)}><option value="">Sin asignar</option>{operation?.responsible_id && !responsibles.data?.some((d) => d.id === operation.responsible_id) && <option value={operation.responsible_id}>{operation.responsible_name ?? "Responsable anterior"}</option>}{responsibles.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><p className="text-xs text-muted-foreground">Equipo de Logística, gestión y administración. El responsable puede ser distinto del conductor.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">{[{ label: "Transporte (€)", id: "operation-transport", value: transport, set: setTransport }, { label: "Hotel (€)", id: "operation-hotel", value: hotel, set: setHotel }, { label: "Otros gastos (€)", id: "operation-other", value: other, set: setOther }].map((field) => <div key={field.id} className="space-y-2"><Label htmlFor={field.id}>{field.label}</Label><Input id={field.id} inputMode="decimal" value={field.value} onChange={(e) => field.set(e.target.value)} placeholder="Pendiente" /></div>)}</div>
      <div className="space-y-2"><Label htmlFor="operation-notes">Detalle de los gastos</Label><Textarea id="operation-notes" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="operation-company">Empresa de transporte</Label><Input id="operation-company" maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nombre de la empresa que realizó el servicio" /><p className="text-xs text-muted-foreground">Si lo realizó vuestra flota, puedes indicar Transporte propio.</p></div>
      {confirmed && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={progress} onChange={(e) => setProgress(e.target.checked)} />Marcar servicio en curso</label>}
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {responsibles.error && <p role="alert" className="text-sm text-destructive">No se pudieron cargar los responsables: {getErrorMessage(responsibles.error)}</p>}
    {!readOnly && <Button onClick={() => void save()} disabled={saving}>{saving ? "Guardando…" : "Guardar responsable y gastos"}</Button>}
    <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Historial de cambios</h3>{history.isLoading ? <p>Cargando historial…</p> : history.error ? <p role="alert">No se pudo cargar el historial: {getErrorMessage(history.error)}</p> : !history.data?.length ? <p className="text-sm text-muted-foreground">Sin cambios registrados desde la activación del historial.</p> : history.data.map((entry) => {
      const keys = Object.keys({ ...entry.before_data, ...entry.after_data }).filter((key) => !["updated_at", "updated_by", "created_at"].includes(key) && JSON.stringify(entry.before_data?.[key]) !== JSON.stringify(entry.after_data?.[key]));
      const display = (value: unknown) => value == null ? "Sin indicar" : typeof value === "boolean" ? value ? "Sí" : "No" : typeof value === "object" ? JSON.stringify(value) : String(value);
      return <div key={entry.id} className="rounded-md border p-3 text-sm"><p className="font-medium">{formatInJobTimezone(entry.changed_at, "dd/MM/yyyy HH:mm")} · {entry.actor_name ?? "Sistema"}</p><p>{entry.action === "INSERT" ? "Creación" : entry.action === "DELETE" ? "Eliminación" : "Modificación"}</p>{keys.map((key) => <p key={key} className="break-words text-muted-foreground">{fieldLabels[key] ?? key}: {display(entry.before_data?.[key])} → {display(entry.after_data?.[key])}</p>)}</div>;
    })}</section>
  </DialogContent></Dialog>;
}

