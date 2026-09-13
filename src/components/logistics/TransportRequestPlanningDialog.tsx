import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TRANSPORT_PROVIDERS } from "@/constants/transportProviders";
import {
  scheduleTransportRequest,
  type TransportRequestRecord,
} from "@/features/logistics/transportRequests";

const schema = z.object({
  loadDate: z.string().min(1, "La fecha de carga es obligatoria"),
  loadTime: z.string().min(1, "La hora de carga es obligatoria"),
  unloadDate: z.string().min(1, "La fecha de descarga es obligatoria"),
  unloadTime: z.string().min(1, "La hora de descarga es obligatoria"),
  provider: z.string().optional(),
  licensePlate: z.string().max(40).optional(),
  loadingBay: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
}).refine(
  (values) => `${values.unloadDate}T${values.unloadTime}` >= `${values.loadDate}T${values.loadTime}`,
  { path: ["unloadDate"], message: "La descarga no puede ser anterior a la carga" },
);

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: TransportRequestRecord | null;
  onSaved?: () => void;
}

export function TransportRequestPlanningDialog({ open, onOpenChange, request, onSaved }: Props) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      loadDate: "",
      loadTime: "09:00",
      unloadDate: "",
      unloadTime: "18:00",
      provider: "",
      licensePlate: "",
      loadingBay: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open || !request) return;
    const load = request.events.find((event) => event.event_type === "load");
    const unload = request.events.find((event) => event.event_type === "unload");
    const neededDate = request.needed_at ? format(new Date(request.needed_at), "yyyy-MM-dd") : "";
    form.reset({
      loadDate: load?.event_date || neededDate,
      loadTime: load?.event_time?.slice(0, 5) || "09:00",
      unloadDate: unload?.event_date || neededDate,
      unloadTime: unload?.event_time?.slice(0, 5) || "18:00",
      provider: load?.transport_provider || unload?.transport_provider || "",
      licensePlate: load?.license_plate || unload?.license_plate || "",
      loadingBay: load?.loading_bay || unload?.loading_bay || "",
      notes: request.note || "",
    });
  }, [form, open, request]);

  const submit = form.handleSubmit(async (values) => {
    if (!request) return;
    try {
      await scheduleTransportRequest({
        requestId: request.id,
        loadDate: values.loadDate,
        loadTime: values.loadTime,
        unloadDate: values.unloadDate,
        unloadTime: values.unloadTime,
        provider: values.provider || null,
        licensePlate: values.licensePlate || null,
        loadingBay: values.loadingBay || null,
        notes: values.notes || null,
      });
      toast({
        title: "Transporte planificado",
        description: request.items.length > 1
          ? `Se han creado los movimientos para ${request.items.length} vehículos.`
          : "Los eventos de carga y descarga han quedado vinculados a la solicitud.",
      });
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "No se pudo planificar el transporte",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="break-words">Planificar transporte</DialogTitle>
          {request && <DialogDescription className="break-words">{request.job_title}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          {request && request.items.length > 1 && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Esta planificación se aplicará a los {request.items.length} vehículos solicitados y creará un par carga/descarga para cada uno. Después puedes ajustar cada movimiento individualmente desde el calendario.
            </div>
          )}

          {request && request.events.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              Al guardar se sustituirán {request.events.length === 1 ? "el movimiento ya planificado" : `los ${request.events.length} movimientos ya planificados`} de esta solicitud.
              Se perderán los ajustes hechos por separado en el calendario (horas, matrículas o muelles distintos por vehículo).
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transport-load-date">Carga · fecha</Label>
              <Input id="transport-load-date" type="date" {...form.register("loadDate")} />
              {form.formState.errors.loadDate && <p className="text-xs text-destructive">{form.formState.errors.loadDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-load-time">Carga · hora</Label>
              <Input id="transport-load-time" type="time" {...form.register("loadTime")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-unload-date">Descarga · fecha</Label>
              <Input id="transport-unload-date" type="date" {...form.register("unloadDate")} />
              {form.formState.errors.unloadDate && <p className="text-xs text-destructive">{form.formState.errors.unloadDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-unload-time">Descarga · hora</Label>
              <Input id="transport-unload-time" type="time" {...form.register("unloadTime")} />
              {form.formState.errors.unloadTime && <p className="text-xs text-destructive">{form.formState.errors.unloadTime.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Select value={form.watch("provider") || "__none"} onValueChange={(value) => form.setValue("provider", value === "__none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin asignar</SelectItem>
                  {Object.entries(TRANSPORT_PROVIDERS).map(([value, provider]) => (
                    <SelectItem key={value} value={value}>{provider.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-plate">Matrícula / identificador</Label>
              <Input id="transport-plate" {...form.register("licensePlate")} placeholder="Opcional" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="transport-bay">Muelle / punto de carga</Label>
              <Input id="transport-bay" {...form.register("loadingBay")} placeholder="Opcional" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transport-plan-notes">Notas operativas</Label>
            <Textarea id="transport-plan-notes" {...form.register("notes")} rows={3} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Guardando…" : "Guardar planificación"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
