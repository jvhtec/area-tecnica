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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { REQUEST_TRANSPORT_OPTIONS } from "@/constants/transportOptions";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/react-query";

interface TransportRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  department: string; // 'sound' | 'lights' | 'video'
  onSubmitted?: () => void;
}

interface VehicleItem {
  transport_type: string;
  leftover_space_meters?: number | "";
}

interface ActiveRequest {
  id: string;
  status: string;
  note: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  is_hoja_relevant: boolean;
  items: { id: string; transport_type: string; leftover_space_meters: number | null }[];
}

const emptyItems = (): VehicleItem[] => [{ transport_type: "trailer", leftover_space_meters: "" }];

export function TransportRequestDialog({
  open,
  onOpenChange,
  jobId,
  department,
  onSubmitted,
}: TransportRequestDialogProps) {
  const [view, setView] = useState<"list" | "form">("list");
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [items, setItems] = useState<VehicleItem[]>(emptyItems());
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [isHojaRelevant, setIsHojaRelevant] = useState(true);
  const { toast } = useToast();
  const { user } = useOptimizedAuth();
  const queryClient = useQueryClient();

  const { data: activeRequests = [], isLoading } = useQuery({
    queryKey: queryKeys.scope("transport-request", jobId, department),
    enabled: open && !!jobId && !!department,
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from("transport_requests")
        .select(
          "id, status, note, description, created_by, created_at, is_hoja_relevant, items:transport_request_items(id, transport_type, leftover_space_meters)"
        )
        .eq("job_id", jobId)
        .eq("department", department)
        .eq("status", "requested")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ActiveRequest[];
    },
  });

  // Reset to the overview every time the dialog opens
  useEffect(() => {
    if (open) {
      setView("list");
      setEditingRequestId(null);
    }
  }, [open]);

  // With no active requests there is nothing to list — go straight to creating one
  useEffect(() => {
    if (open && !isLoading && activeRequests.length === 0 && view === "list") {
      startCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isLoading, activeRequests.length]);

  const startCreate = () => {
    setEditingRequestId(null);
    setItems(emptyItems());
    setNote("");
    setDescription("");
    setIsHojaRelevant(true);
    setView("form");
  };

  const startEdit = (request: ActiveRequest) => {
    setEditingRequestId(request.id);
    setNote(request.note || "");
    setDescription(request.description || "");
    setIsHojaRelevant(request.is_hoja_relevant ?? true);
    setItems(
      request.items.length > 0
        ? request.items.map((it) => ({
            transport_type: it.transport_type,
            leftover_space_meters: it.leftover_space_meters ?? "",
          }))
        : emptyItems()
    );
    setView("form");
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.scope("transport-request", jobId, department) });
    queryClient.invalidateQueries({ queryKey: queryKeys.scope("transport-requests-all", jobId) });
  };

  const canManageRequest = (request: ActiveRequest) => !request.created_by || request.created_by === user?.id;

  const handleCancelRequest = async (requestId: string) => {
    const { error } = await dataLayerClient
      .from("transport_requests")
      .update({ status: "cancelled" })
      .eq("id", requestId);
    if (error) {
      toast({
        title: "Error",
        description: error.message || "No se pudo cancelar la solicitud",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Solicitud cancelada" });
    invalidate();
    onSubmitted?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user: authUser } } = await dataLayerClient.auth.getUser();
      if (!authUser) throw new Error("No autenticado");

      const toInsertItems = (requestId: string) =>
        items
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
            note: note || null,
            description: description || null,
            is_hoja_relevant: isHojaRelevant,
          } as never)
          .eq("id", editingRequestId);
        if (error) throw error;

        const { error: deleteItemsError } = await dataLayerClient
          .from("transport_request_items")
          .delete()
          .eq("request_id", editingRequestId);
        if (deleteItemsError) throw deleteItemsError;

        const toInsert = toInsertItems(editingRequestId);
        if (toInsert.length > 0) {
          const { error: itemsErr } = await dataLayerClient.from("transport_request_items").insert(toInsert);
          if (itemsErr) throw itemsErr;
        }
      } else {
        const { data: inserted, error } = await dataLayerClient
          .from("transport_requests")
          .insert({
            job_id: jobId,
            department,
            note: note || null,
            description: description || null,
            status: "requested",
            created_by: authUser.id,
            is_hoja_relevant: isHojaRelevant,
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
              description: description || undefined,
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
      invalidate();
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
              {request.note && <div className="text-xs text-muted-foreground italic">{request.note}</div>}
            </div>
            {request.is_hoja_relevant === false && (
              <Badge variant="outline" className="shrink-0">Fuera de Hoja de Ruta</Badge>
            )}
          </div>
          {canManageRequest(request) && (
            <div className="flex gap-2">
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Descripción</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="P. ej., Recogida de subalquiler, Devolución de material al proveedor"
        />
      </div>
      <div className="space-y-2">
        <Label>Vehículos</Label>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select
                value={it.transport_type}
                onValueChange={(val) => {
                  const next = items.slice();
                  next[idx] = { ...next[idx], transport_type: val };
                  setItems(next);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TRANSPORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step={0.1}
                className="w-52"
                placeholder="Espacio sobrante (m) - opcional"
                value={it.leftover_space_meters === "" ? "" : it.leftover_space_meters}
                onChange={(e) => {
                  const val = e.target.value;
                  const num = val === "" ? "" : Math.max(0, Number(val));
                  const next = items.slice();
                  next[idx] = { ...next[idx], leftover_space_meters: num as number | "" };
                  setItems(next);
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const next = items.slice();
                  next.splice(idx, 1);
                  setItems(next.length ? next : emptyItems());
                }}
              >
                Eliminar
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setItems([...items, { transport_type: "trailer", leftover_space_meters: "" }])}
            >
              Añadir vehículo
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Nota</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalles opcionales" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id="transport-request-hoja-relevant"
            checked={isHojaRelevant}
            onCheckedChange={(value) => setIsHojaRelevant(value === true)}
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {view === "list"
              ? "Solicitudes de transporte"
              : editingRequestId
                ? "Editar solicitud de transporte"
                : "Solicitar transporte"}
          </DialogTitle>
        </DialogHeader>
        {view === "list" ? (isLoading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : renderList()) : renderForm()}
      </DialogContent>
    </Dialog>
  );
}
