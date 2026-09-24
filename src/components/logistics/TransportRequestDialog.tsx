import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { AddressAutocomplete } from "@/components/maps/AddressAutocomplete";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getLogisticsTransportTypeLabel } from "@/components/technician/details-modal/formatters";
import { REQUEST_TRANSPORT_OPTIONS } from "@/constants/transportOptions";
import {
  listTransportRequests,
  saveTransportRequest,
  setTransportRequestStage,
  TRANSPORT_MOVEMENT_LABELS,
  TRANSPORT_PRIORITY_LABELS,
  TRANSPORT_SOURCE_LABELS,
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
  leftover_space_meters: z.union([
    z.number().min(0, "El espacio no puede ser negativo").max(100, "Máximo 100 m"),
    z.null(),
  ]),
});

const schema = z.object({
  description: z.string().max(2000, "Máximo 2000 caracteres").optional(),
  note: z.string().max(4000, "Máximo 4000 caracteres").optional(),
  neededAt: z.string().optional(),
  origin: z.string().max(300, "Máximo 300 caracteres").optional(),
  destination: z.string().max(300, "Máximo 300 caracteres").optional(),
  movementType: z.enum(["transfer", "pickup", "delivery", "return", "other"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  isHojaRelevant: z.boolean(),
  items: z.array(itemSchema).min(1, "Añade al menos un vehículo").max(20, "Máximo 20 vehículos"),
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

const canEditDemand = (request: TransportRequestRecord) =>
  request.source_type === "manual" &&
  (request.planning_status === "requested" || request.planning_status === "reviewing");

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
  const [cancelTarget, setCancelTarget] = useState<TransportRequestRecord | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });
  const items = useFieldArray({ control: form.control, name: "items" });

  // Job cards cache a single summary at the parent key; this RPC returns a list.
  const queryKey = queryKeys.scope("transport-request", jobId, department, "list");
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
    if (!canEditDemand(request)) return;
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
    setCancelTarget(null);
  }, [open]);

  useEffect(() => {
    if (!open || isLoading || isError) return;
    if (requestId) {
      const requested = requestedById.get(requestId);
      if (requested && canEditDemand(requested)) {
        beginEdit(requested);
        return;
      }
    }
    if (requests.length === 0 && view === "list") beginCreate();
    // Creation/editing is driven by the loaded request snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, isLoading, open, requestId, requestedById, requests.length]);

  const refresh = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("transport-request", jobId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("transport-requests-all", jobId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("logistics-transport-inbox") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("logistics-events") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("today-logistics") }),
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
    const existingRequest = editingId ? requestedById.get(editingId) : null;
    if (existingRequest && !canEditDemand(existingRequest)) {
      toast({
        title: "La solicitud ya no se puede editar",
        description: "Una solicitud generada o ya planificada debe modificarse desde su origen o replantearse desde Logística.",
        variant: "destructive",
      });
      setView("list");
      setEditingId(null);
      return;
    }

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
        sourceType: existingRequest?.source_type ?? "manual",
        sourceRef: existingRequest?.source_ref ?? null,
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
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent className="max-w-3xl p-0 sm:p-6">
          <div className="min-w-0 space-y-4 px-4 pb-4 pt-2 sm:p-0">
            <ResponsiveDialogHeader className="pr-10 sm:pr-8">
              <ResponsiveDialogTitle className="break-words">
                {view === "list" ? "Solicitudes de transporte" : editingId ? "Editar solicitud" : "Nueva solicitud de transporte"}
              </ResponsiveDialogTitle>
            </ResponsiveDialogHeader>

            {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Cargando solicitudes…</p>}
            {isError && (
              <div className="space-y-3 py-6 text-center">
                <p className="break-words text-sm text-destructive">{error instanceof Error ? error.message : "No se pudieron cargar las solicitudes."}</p>
                <Button variant="outline" onClick={() => void refetch()}>Reintentar</Button>
              </div>
            )}

            {!isLoading && !isError && view === "list" && (
              <div className="min-w-0 space-y-4">
                {requests.map((request) => {
                  const editable = canEditDemand(request);
                  return (
                    <div key={request.id} className="min-w-0 space-y-3 rounded-lg border p-4">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <Badge variant="outline">{TRANSPORT_STAGE_LABELS[request.planning_status]}</Badge>
                            {request.priority !== "normal" && <Badge>{TRANSPORT_PRIORITY_LABELS[request.priority]}</Badge>}
                            {request.source_type !== "manual" && <Badge variant="secondary">{TRANSPORT_SOURCE_LABELS[request.source_type]}</Badge>}
                            <span className="text-sm font-medium">{TRANSPORT_MOVEMENT_LABELS[request.movement_type]}</span>
                          </div>
                          {request.description && <p className="break-words text-sm">{request.description}</p>}
                          <p className="break-words text-xs text-muted-foreground">
                            {request.needed_at ? formatInJobTimezone(request.needed_at, "dd/MM/yyyy · HH:mm") : "Sin fecha requerida"}
                            {request.origin || request.destination ? ` · ${request.origin || "?"} → ${request.destination || "?"}` : ""}
                          </p>
                          <p className="break-words text-xs text-muted-foreground">
                            {request.items.map((item) => getLogisticsTransportTypeLabel(item.transport_type)).join(" · ") || "Sin vehículo"}
                          </p>
                          {!editable && request.planning_status !== "completed" && request.planning_status !== "cancelled" && (
                            <p className="text-xs text-muted-foreground">
                              {request.source_type !== "manual"
                                ? "Solicitud generada: edítala desde su origen."
                                : "La demanda queda bloqueada al planificarla; usa Editar planificación para cambiar su ejecución."}
                            </p>
                          )}
                        </div>
                        {request.planning_status !== "completed" && request.planning_status !== "cancelled" && (
                          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                            {editable && (
                              <Button className="w-full sm:w-auto" size="sm" variant="outline" onClick={() => beginEdit(request)}>
                                <Pencil className="mr-1 h-4 w-4" />Editar
                              </Button>
                            )}
                            <Button className="w-full text-destructive sm:w-auto" size="sm" variant="ghost" onClick={() => setCancelTarget(request)}>
                              <Trash2 className="mr-1 h-4 w-4" />Cancelar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <Button className="w-full sm:w-auto" onClick={beginCreate}><Plus className="mr-2 h-4 w-4" />Nueva solicitud</Button>
              </div>
            )}

            {!isLoading && !isError && view === "form" && (
              <form onSubmit={submit} className="min-w-0 space-y-5">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="transport-description">Qué necesitas</Label>
                  <Input id="transport-description" {...form.register("description")} placeholder="PA principal, recogida de subalquiler, devolución…" />
                  {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="transport-needed-at">Necesario para</Label>
                    <Input id="transport-needed-at" type="datetime-local" {...form.register("neededAt")} />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="transport-movement-type">Tipo de movimiento</Label>
                    <Select value={form.watch("movementType")} onValueChange={(value) => form.setValue("movementType", value as TransportMovementType, { shouldDirty: true })}>
                      <SelectTrigger id="transport-movement-type" className="w-full min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRANSPORT_MOVEMENT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Free text is still allowed ("Almacén"); a picked suggestion stores the full address so drivers can navigate to it. */}
                  <div className="min-w-0 space-y-2">
                    <AddressAutocomplete
                      id="transport-origin"
                      label="Origen"
                      value={form.watch("origin") ?? ""}
                      onChange={(address) => form.setValue("origin", address, { shouldDirty: true })}
                      placeholder="Almacén, proveedor, recinto…"
                      className="space-y-2"
                    />
                    {form.formState.errors.origin && <p className="text-xs text-destructive">{form.formState.errors.origin.message}</p>}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <AddressAutocomplete
                      id="transport-destination"
                      label="Destino"
                      value={form.watch("destination") ?? ""}
                      onChange={(address) => form.setValue("destination", address, { shouldDirty: true })}
                      placeholder="Recinto, almacén, proveedor…"
                      className="space-y-2"
                    />
                    {form.formState.errors.destination && <p className="text-xs text-destructive">{form.formState.errors.destination.message}</p>}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="transport-priority">Prioridad</Label>
                    <Select value={form.watch("priority")} onValueChange={(value) => form.setValue("priority", value as TransportPriority, { shouldDirty: true })}>
                      <SelectTrigger id="transport-priority" className="w-full min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRANSPORT_PRIORITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 self-end rounded-md border p-3">
                    <Checkbox id="transport-hoja" checked={form.watch("isHojaRelevant")} onCheckedChange={(checked) => form.setValue("isHojaRelevant", checked === true, { shouldDirty: true })} />
                    <Label htmlFor="transport-hoja" className="min-w-0 cursor-pointer break-words font-normal">Incluir en Hoja de Ruta</Label>
                  </div>
                </div>

                <div className="min-w-0 space-y-3">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <Label>Vehículos / capacidad</Label>
                    <Button type="button" size="sm" variant="secondary" disabled={items.fields.length >= 20} onClick={() => items.append({ transport_type: "trailer", leftover_space_meters: null })}>
                      <Plus className="mr-1 h-4 w-4" />Vehículo
                    </Button>
                  </div>
                  {items.fields.map((field, index) => (
                    <div key={field.id} className="grid min-w-0 grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center">
                      <Select value={form.watch(`items.${index}.transport_type`)} onValueChange={(value) => form.setValue(`items.${index}.transport_type`, value, { shouldDirty: true })}>
                        <SelectTrigger aria-label={`Tipo de vehículo ${index + 1}`} className="w-full min-w-0"><SelectValue /></SelectTrigger>
                        <SelectContent>{REQUEST_TRANSPORT_OPTIONS.map((option) => <SelectItem key={option} value={option}>{getLogisticsTransportTypeLabel(option)}</SelectItem>)}</SelectContent>
                      </Select>
                      <div className="min-w-0 space-y-1">
                        <div className="relative min-w-0">
                          <Truck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={100}
                            step={0.1}
                            placeholder="Espacio sobrante (m), opcional"
                            defaultValue={field.leftover_space_meters ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (value === "") {
                                form.setValue(`items.${index}.leftover_space_meters`, null, { shouldDirty: true, shouldValidate: true });
                                return;
                              }
                              const parsed = Number(value);
                              if (Number.isFinite(parsed)) {
                                form.setValue(`items.${index}.leftover_space_meters`, parsed, { shouldDirty: true, shouldValidate: true });
                              }
                            }}
                          />
                        </div>
                        {form.formState.errors.items?.[index]?.leftover_space_meters && (
                          <p className="text-xs text-destructive">{form.formState.errors.items[index]?.leftover_space_meters?.message}</p>
                        )}
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="justify-self-end" disabled={items.fields.length === 1} onClick={() => items.remove(index)} aria-label="Eliminar vehículo">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {form.formState.errors.items?.message && <p className="text-xs text-destructive">{form.formState.errors.items.message}</p>}
                </div>

                <div className="min-w-0 space-y-2">
                  <Label htmlFor="transport-note">Notas</Label>
                  <Textarea id="transport-note" {...form.register("note")} rows={3} placeholder="Accesos, contacto, restricciones, devolución…" />
                  {form.formState.errors.note && <p className="text-xs text-destructive">{form.formState.errors.note.message}</p>}
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => requests.length ? setView("list") : onOpenChange(false)}>
                    {requests.length ? "Volver" : "Cancelar"}
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Guardando…" : editingId ? "Actualizar solicitud" : "Crear solicitud"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <AlertDialog open={Boolean(cancelTarget)} onOpenChange={(nextOpen) => { if (!nextOpen) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar solicitud de transporte</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.events.length
                ? "La solicitud y sus movimientos planificados se cancelarán y dejarán de aparecer en el calendario. Esta acción no se puede deshacer."
                : "La solicitud se cancelará. Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = cancelTarget;
                setCancelTarget(null);
                if (target) void cancelRequest(target);
              }}
            >
              Cancelar solicitud
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
