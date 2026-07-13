import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { REQUEST_TRANSPORT_OPTIONS } from "@/constants/transportOptions";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  useJobTransportRequests,
  type TransportRequestSummary,
} from "@/hooks/useJobTransportRequests";

interface TransportRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  department: string; // 'sound' | 'lights' | 'video'
  onSubmitted?: () => void;
}

const vehicleItemSchema = z.object({
  transport_type: z.string().min(1, "Selecciona un tipo de vehículo"),
  leftover_space_meters: z.union([
    z.number().finite().min(0, "El espacio libre no puede ser negativo"),
    z.literal(""),
  ]),
});

const transportRequestFormSchema = z.object({
  description: z.string(),
  items: z.array(vehicleItemSchema).min(1, "Añade al menos un vehículo"),
  needed_date: z.string(),
  note: z.string(),
  is_hoja_relevant: z.boolean(),
});

type TransportRequestFormValues = z.infer<typeof transportRequestFormSchema>;
type VehicleItem = TransportRequestFormValues["items"][number];

const formatNeededDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};

const emptyItems = (): VehicleItem[] => [{ transport_type: "trailer", leftover_space_meters: "" }];

const emptyFormValues = (): TransportRequestFormValues => ({
  description: "",
  items: emptyItems(),
  needed_date: "",
  note: "",
  is_hoja_relevant: true,
});

export function TransportRequestDialog({
  open,
  onOpenChange,
  jobId,
  department,
  onSubmitted,
}: TransportRequestDialogProps) {
  const [view, setView] = useState<"list" | "form">("list");
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user } = useOptimizedAuth();
  const {
    myTransportRequests: activeRequests,
    isMyTransportRequestsLoading: isLoading,
    isMyTransportRequestsError: isError,
    refetchMyTransportRequests: refetchActiveRequests,
    cancelRequest,
    invalidateRequests,
  } = useJobTransportRequests(jobId, department, false);
  const {
    control,
    formState: { errors },
    handleSubmit: handleValidatedSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<TransportRequestFormValues>({
    resolver: zodResolver(transportRequestFormSchema),
    defaultValues: emptyFormValues(),
  });
  const {
    append: appendItem,
    fields: itemFields,
    remove: removeItem,
    replace: replaceItems,
  } = useFieldArray({ control, name: "items" });
  const items = watch("items");
  const isHojaRelevant = watch("is_hoja_relevant");

  // Reset to the overview every time the dialog opens
  useEffect(() => {
    if (open) {
      setView("list");
      setEditingRequestId(null);
    }
  }, [open]);

  // With no active requests there is nothing to list — go straight to creating one
  useEffect(() => {
    if (open && !isLoading && !isError && activeRequests.length === 0 && view === "list") {
      startCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isLoading, isError, activeRequests.length]);

  const startCreate = () => {
    setEditingRequestId(null);
    reset(emptyFormValues());
    setView("form");
  };

  const startEdit = (request: TransportRequestSummary) => {
    setEditingRequestId(request.id);
    reset({
      note: request.note || "",
      description: request.description || "",
      is_hoja_relevant: request.is_hoja_relevant ?? true,
      needed_date: request.needed_date || "",
      items: request.items.length > 0
        ? request.items.map((it) => ({
            transport_type: it.transport_type,
            leftover_space_meters: it.leftover_space_meters ?? "",
          }))
        : emptyItems(),
    });
    setView("form");
  };

  const canManageRequest = (request: TransportRequestSummary) =>
    !request.created_by || request.created_by === user?.id;

  const handleCancelRequest = async (requestId: string) => {
    const confirmed = await confirm({
      title: "¿Cancelar esta solicitud?",
      description: "La solicitud dejará de aparecer como pendiente.",
      confirmText: "Cancelar solicitud",
      destructive: true,
    });
    if (!confirmed) return;

    const { error } = await cancelRequest(requestId);
    if (error) {
      toast({
        title: "Error",
        description: error || "No se pudo cancelar la solicitud",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Solicitud cancelada" });
    onSubmitted?.();
  };

  const saveRequest = async (values: TransportRequestFormValues) => {
    try {
      const { data: { user: authUser } } = await dataLayerClient.auth.getUser();
      if (!authUser) throw new Error("No autenticado");

      const toInsertItems = (requestId: string) =>
        values.items
          .filter((it) => !!it.transport_type)
          .map((it) => ({
            request_id: requestId,
            transport_type: it.transport_type,
            leftover_space_meters: it.leftover_space_meters === "" ? null : it.leftover_space_meters,
          }));

      if (editingRequestId) {
        // Only the editable fields — never touch status, so a request cannot be
        // resurrected or re-owned through an edit.
        const { error } = await dataLayerClient
          .from("transport_requests")
          .update({
            note: values.note || null,
            description: values.description || null,
            is_hoja_relevant: values.is_hoja_relevant,
            needed_date: values.needed_date || null,
          } as never)
          .eq("id", editingRequestId);
        if (error) throw error;

        const existingItemIds = activeRequests
          .find((request) => request.id === editingRequestId)
          ?.items.map((item) => item.id) ?? [];
        const toInsert = toInsertItems(editingRequestId);
        if (toInsert.length > 0) {
          const { error: itemsErr } = await dataLayerClient.from("transport_request_items").insert(toInsert);
          if (itemsErr) throw itemsErr;

          if (existingItemIds.length > 0) {
            const { error: deleteItemsError } = await dataLayerClient
              .from("transport_request_items")
              .delete()
              .eq("request_id", editingRequestId)
              .in("id", existingItemIds);
            if (deleteItemsError) throw deleteItemsError;
          }
        }
      } else {
        const { data: inserted, error } = await dataLayerClient
          .from("transport_requests")
          .insert({
            job_id: jobId,
            department,
            note: values.note || null,
            description: values.description || null,
            status: "requested",
            created_by: authUser.id,
            is_hoja_relevant: values.is_hoja_relevant,
            needed_date: values.needed_date || null,
          } as never)
          .select("id")
          .single();
        if (error) throw error;
        const requestId = (inserted as { id: string }).id;
        const toInsert = toInsertItems(requestId);
        if (toInsert.length > 0) {
          const { error: itemsErr } = await dataLayerClient.from("transport_request_items").insert(toInsert);
          if (itemsErr) throw itemsErr;
        }
        try {
          const { error: pushError } = await dataLayerClient.functions.invoke("push", {
            body: {
              action: "broadcast",
              type: "logistics.transport.requested",
              job_id: jobId,
              department,
              request_id: requestId,
              description: values.description || undefined,
            },
          });
          if (pushError) {
            console.error("Failed to invoke push notification for transport request", pushError);
          }
        } catch (pushError) {
          console.error("Unexpected error invoking push notification for transport request", pushError);
        }
      }

      toast({ title: editingRequestId ? "Solicitud actualizada" : "Solicitud de transporte enviada" });
      invalidateRequests();
      onSubmitted?.();
      setView("list");
      setEditingRequestId(null);
      if (activeRequests.length === 0 && !editingRequestId) {
        // First request from the empty state: close, matching the old flow
        onOpenChange(false);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la solicitud";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const renderList = () => (
    <div className="space-y-3">
      {activeRequests.map((request) => (
        <div key={request.id} className="border rounded p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {request.description || "Transporte de material"}
              </div>
              <div className="text-xs text-muted-foreground">
                {(request.items || [])
                  .map((it) =>
                    it.leftover_space_meters != null
                      ? `${it.transport_type.replace("_", " ")} (${it.leftover_space_meters} m libres)`
                      : it.transport_type.replace("_", " ")
                  )
                  .join(", ") || "Sin vehículos"}
              </div>
              {request.needed_date && (
                <div className="text-xs text-muted-foreground">
                  Fecha necesaria: {formatNeededDate(request.needed_date)}
                </div>
              )}
              {request.note && <div className="text-xs text-muted-foreground italic">{request.note}</div>}
            </div>
            {request.is_hoja_relevant === false && (
              <Badge variant="outline" className="shrink-0">Fuera de Hoja de Ruta</Badge>
            )}
          </div>
          {canManageRequest(request) && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => startEdit(request)}>
                Editar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => handleCancelRequest(request.id)}>
                Cancelar solicitud
              </Button>
            </div>
          )}
        </div>
      ))}
      <div className="flex justify-end">
        <Button type="button" onClick={startCreate}>Nueva solicitud</Button>
      </div>
    </div>
  );

  const renderForm = () => (
    <form onSubmit={handleValidatedSubmit(saveRequest)} className="space-y-4">
      <div className="space-y-2">
        <Label>Descripción</Label>
        <Input
          {...register("description")}
          placeholder="P. ej., Recogida de subalquiler, Devolución de material al proveedor"
        />
      </div>
      <div className="space-y-2">
        <Label>Vehículos</Label>
        <div className="space-y-2">
          {itemFields.map((field, idx) => {
            const item = items[idx] ?? { transport_type: "trailer", leftover_space_meters: "" };
            return (
              <div key={field.id} className="space-y-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={item.transport_type}
                    onValueChange={(val) => {
                      setValue(`items.${idx}.transport_type`, val, { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_TRANSPORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    className="w-full sm:w-52"
                    placeholder="Espacio sobrante (m) - opcional"
                    value={item.leftover_space_meters === "" ? "" : item.leftover_space_meters}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = Number(val);
                      const nextValue = val === "" || !Number.isFinite(parsed) ? "" : Math.max(0, parsed);
                      setValue(`items.${idx}.leftover_space_meters`, nextValue, { shouldValidate: true });
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (itemFields.length === 1) {
                        replaceItems(emptyItems());
                      } else {
                        removeItem(idx);
                      }
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
                {errors.items?.[idx]?.leftover_space_meters?.message && (
                  <p className="text-xs text-destructive">
                    {errors.items[idx]?.leftover_space_meters?.message}
                  </p>
                )}
              </div>
            );
          })}
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => appendItem({ transport_type: "trailer", leftover_space_meters: "" })}
            >
              Añadir vehículo
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Fecha necesaria</Label>
        <Input
          type="date"
          {...register("needed_date")}
        />
        <p className="text-xs text-muted-foreground">
          Día en que se necesita el transporte (opcional). Se usará como fecha inicial del evento de logística.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Nota</Label>
        <Input {...register("note")} placeholder="Detalles opcionales" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id="transport-request-hoja-relevant"
            checked={isHojaRelevant}
            onCheckedChange={(value) => setValue("is_hoja_relevant", value === true)}
          />
          <Label htmlFor="transport-request-hoja-relevant">Incluir en la Hoja de Ruta</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Desmárcalo para transportes internos (subalquileres, devoluciones…) que no deben aparecer en la Hoja de Ruta.
        </p>
      </div>
      <div className="flex justify-between">
        {activeRequests.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setView("list");
              setEditingRequestId(null);
            }}
          >
            Volver
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit">{editingRequestId ? "Actualizar solicitud" : "Enviar solicitud"}</Button>
      </div>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {view === "list"
              ? "Solicitudes de transporte"
              : editingRequestId
                ? "Editar solicitud de transporte"
                : "Solicitar transporte"}
          </DialogTitle>
        </DialogHeader>
        {view === "list" ? (
          isLoading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : isError ? (
            <div className="space-y-3">
              <div className="text-sm text-destructive">
                No se pudieron cargar las solicitudes de transporte.
              </div>
              <Button type="button" variant="outline" onClick={() => void refetchActiveRequests()}>
                Reintentar
              </Button>
            </div>
          ) : renderList()
        ) : renderForm()}
      </DialogContent>
    </Dialog>
  );
}
