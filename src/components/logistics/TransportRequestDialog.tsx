import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REQUEST_TRANSPORT_OPTIONS } from "@/constants/transportOptions";
import {
  listTransportRequests,
  saveTransportRequest,
  setTransportRequestStage,
  TRANSPORT_MOVEMENT_LABELS,
  TRANSPORT_PRIORITY_LABELS,
  TRANSPORT_STAGE_LABELS,
  type TransportMovementType,
  type TransportPriority,
  type TransportRequestRecord,
} from "@/features/logistics/transportRequests";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { formatInJobTimezone, localInputToUTC, utcToLocalInput } from "@/utils/timezoneUtils";

const itemSchema = z.object({
  transport_type: z.string().min(1, "Selecciona un vehículo"),
  leftover_space_meters: z.union([z.number().min(0), z.null()]),
});

const schema = z.object({
  description: z.string().max(2000).optional(),
  note: z.string().max(4000).optional(),
  neededAt: z.string().optional(),
  origin: z.string().max(300).optional(),
  destination: z.string().max(300).optional(),
  movementType: z.enum(["transfer", "pickup", "delivery", "return", "other"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  isHojaRelevant: z.boolean(),
  items: z.array(itemSchema).min(1, "Añade al menos un vehículo").max(20),
});

type FormValues = z.infer<typeof schema>;

interface TransportRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  department: string;
  requestId?: string | null;
  onSubmitted?: () => void;
}

const emptyValues: FormValues = {
  description: "",
  note: "",
  neededAt: "",
  origin: "",
  destination: "",
  movementType: "transfer",
  priority: "normal",
  isHojaRelevant: true,
  items: [{ transport_type: "trailer", leftover_space_meters: null }],
};

export function TransportRequestDialog({
  open,
  onOpenChange,
  jobId,
  department,
  requestId,
  onSubmitted,
}: TransportRequestDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "form">("list");

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });
  const items = useFieldArray({ control: form.control, name: "items" });

  const queryKey = queryKeys.scope("transport-request", jobId, department);
  const { data: requests = [], isLoading, isError, error, refetch } = useQuery({
    queryKey,
    enabled: open && Boolean(jobId && department),
    queryFn: () => listTransportRequests({ jobId, department }),
  });

  const requestedById = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests]);

  const beginCreate = () => {
    setEditingId(null);
    form.reset(emptyValues);
    setView("form");
  };

  const beginEdit = (request: TransportRequestRecord) => {
    setEditingId(request.id);
    form.reset({
      description: request.description || "",
      note: request.note || "",
      neededAt: request.needed_at ? utcToLocalInput(request.needed_at) : "",
      origin: request.origin || "",
      destination: request.destination || "",
      movementType: request.movement_type,
      priority: request.priority,
      isHojaRelevant: request.is_hoja_relevant,
      items: request.items.length
        ? request.items.map((item) => ({
            transport_type: item.transport_type,
            leftover_space_meters: item.leftover_space_meters,
          }))
        : [{ transport_type: "trailer", leftover_space_meters: null }],
    });
    setView("form");
  };

  useEffect(() => {
    if (!open) return;
    setEditingId(null);
    setView("list");
  }, [open]);

  useEffect(() => {
    if (!open || isLoading || isError) return;
    if (requestId) {
      const requested = requestedById.get(requestId);
      if (requested) {
        beginEdit(requested);
        return;
      }
    }
    if (requests.length === 0 && view === "list") beginCreate();
    // beginCreate/beginEdit are intentionally driven only by the loaded request snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, isLoading, open, requestId, requestedById, requests.length]);

  const refresh = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("transport-request", jobId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("transport-requests-all", jobId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("logistics-transport-inbox") }),
    ]);
    onSubmitted?.();
  };

  const cancelRequest = async (request: TransportRequestRecord) => {
    try {
      await setTransportRequestStage(request.id, "cancelled");
      toast({ title: "Solicitud cancelada" });
      await refresh();
    } catch (cancelError) {
      toast({
        title: "No se pudo cancelar",
        description: cancelError instanceof Error ? cancelError.message : String(cancelError),
        variant: "destructive",
      });
    }
  };

  const submit = form.handleSubmit(async (values) => {
    const isNew = !editingId;
    try {
      const requestIdentifier = await saveTransportRequest({
        requestId: editingId,
        jobId,
        department,
        description: values.description || null,
        note: values.note || null,
        neededAt: values.neededAt ? localInputToUTC(values.neededAt).toISOString() : null,
        origin: values.origin || null,
        destination: values.destination || null,
        movementType: values.movementType,
        priority: values.priority,
        isHojaRelevant: values.isHojaRelevant,
        sourceType: "manual",
        sourceRef: null,
        items: values.items,
      });

      if (isNew) {
        try {
          await dataLayerClient.functions.invoke("push", {
            body: {
              action: "broadcast",
              type: "logistics.transport.requested",
              job_id: jobId,
              department,
              request_id: requestIdentifier,
              description: values.description || undefined,
            },
          });
        } catch (pushError) {
          console.error("Transport request push failed", pushError);
        }
      }

      toast({ title: editingId ? "Solicitud actualizada" : "Solicitud creada" });
      await refresh();
      setView("list");
      setEditingId(null);
    } catch (submitError) {
      toast({
        title: "No se pudo guardar la solicitud",
        description: submitError instanceof Error ? submitError.message : String(submitError),
        variant: "destructive",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{view === "list" ? "Solicitudes de transporte" : editingId ? "Editar solicitud" : "Nueva solicitud de transporte"}</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Cargando solicitudes…</p>}
        {isError && (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : "No se pudieron cargar las solicitudes."}</p>
            <Button variant="outline" onClick={() => void refetch()}>Reintentar</Button>
          </div>
        )}

        {!isLoading && !isError && view === "list" && (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{TRANSPORT_STAGE_LABELS[request.planning_status]}</Badge>
                      {request.priority !== "normal" && <Badge>{TRANSPORT_PRIORITY_LABELS[request.priority]}</Badge>}
                      <span className="text-sm font-medium">{TRANSPORT_MOVEMENT_LABELS[request.movement_type]}</span>
                    </div>
                    {request.description && <p className="text-sm">{request.description}</p>}
                    <p className="text-xs text-muted-foreground">
                      {request.needed_at ? formatInJobTimezone(request.needed_at, "dd/MM/yyyy · HH:mm") : "Sin fecha requerida"}
                      {request.origin || request.destination ? ` · ${request.origin || "?"} → ${request.destination || "?"}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {request.items.map((item) => item.transport_type.replace("_", " ")).join(" · ") || "Sin vehículo"}
                    </p>
                  </div>
                  {request.planning_status !== "completed" && request.planning_status !== "cancelled" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => beginEdit(request)}><Pencil className="mr-1 h-4 w-4" />Editar</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void cancelRequest(request)}><Trash2 className="mr-1 h-4 w-4" />Cancelar</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <Button onClick={beginCreate}><Plus className="mr-2 h-4 w-4" />Nueva solicitud</Button>
          </div>
        )}

        {!isLoading && !isError && view === "form" && (
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="transport-description">Qué necesitas</Label>
              <Input id="transport-description" {...form.register("description")} placeholder="PA principal, recogida de subalquiler, devolución…" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transport-needed-at">Necesario para</Label>
                <Input id="transport-needed-at" type="datetime-local" {...form.register("neededAt")} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de movimiento</Label>
                <Select value={form.watch("movementType")} onValueChange={(value) => form.setValue("movementType", value as TransportMovementType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRANSPORT_MOVEMENT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transport-origin">Origen</Label>
                <Input id="transport-origin" {...form.register("origin")} placeholder="Almacén, proveedor, recinto…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transport-destination">Destino</Label>
                <Input id="transport-destination" {...form.register("destination")} placeholder="Recinto, almacén, proveedor…" />
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={form.watch("priority")} onValueChange={(value) => form.setValue("priority", value as TransportPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRANSPORT_PRIORITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 self-end rounded-md border p-3">
                <Checkbox id="transport-hoja" checked={form.watch("isHojaRelevant")} onCheckedChange={(checked) => form.setValue("isHojaRelevant", checked === true)} />
                <Label htmlFor="transport-hoja" className="cursor-pointer font-normal">Incluir en Hoja de Ruta</Label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Vehículos / capacidad</Label>
                <Button type="button" size="sm" variant="secondary" onClick={() => items.append({ transport_type: "trailer", leftover_space_meters: null })}>
                  <Plus className="mr-1 h-4 w-4" />Vehículo
                </Button>
              </div>
              {items.fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[180px_1fr_auto] sm:items-center">
                  <Select value={form.watch(`items.${index}.transport_type`)} onValueChange={(value) => form.setValue(`items.${index}.transport_type`, value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REQUEST_TRANSPORT_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="relative">
                    <Truck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="Espacio sobrante (m), opcional"
                      value={form.watch(`items.${index}.leftover_space_meters`) ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        const parsed = value === "" ? null : Number(value);
                        if (parsed === null || Number.isFinite(parsed)) form.setValue(`items.${index}.leftover_space_meters`, parsed === null ? null : Math.max(0, parsed));
                      }}
                    />
                  </div>
                  <Button type="button" size="icon" variant="ghost" disabled={items.fields.length === 1} onClick={() => items.remove(index)} aria-label="Eliminar vehículo">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {form.formState.errors.items?.message && <p className="text-xs text-destructive">{form.formState.errors.items.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="transport-note">Notas</Label>
              <Textarea id="transport-note" {...form.register("note")} rows={3} placeholder="Accesos, contacto, restricciones, devolución…" />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={() => requests.length ? setView("list") : onOpenChange(false)}>
                {requests.length ? "Volver" : "Cancelar"}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Guardando…" : editingId ? "Actualizar solicitud" : "Crear solicitud"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}