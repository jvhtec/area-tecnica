import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
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
import { formatInJobTimezone } from "@/utils/timezoneUtils";
import { getLogisticsTransportTypeLabel } from "@/components/technician/details-modal/formatters";

const schema = z.object({
  loadDate: z.string().min(1, "La fecha de carga es obligatoria"),
  loadTime: z.string().min(1, "La hora de carga es obligatoria"),
  unloadDate: z.string().min(1, "La fecha de descarga es obligatoria"),
  unloadTime: z.string().min(1, "La hora de descarga es obligatoria"),
  provider: z.string().optional(),
  licensePlate: z.string().max(40, "Máximo 40 caracteres").optional(),
  loadingBay: z.string().max(120, "Máximo 120 caracteres").optional(),
  notes: z.string().max(2000, "Máximo 2000 caracteres").optional(),
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
    const neededDate = request.needed_at ? formatInJobTimezone(request.needed_at, "yyyy-MM-dd") : "";
    form.reset({
      loadDate: load?.event_date || neededDate,
      loadTime: load?.event_time?.slice(0, 5) || "",
      unloadDate: unload?.event_date || neededDate,
      unloadTime: unload?.event_time?.slice(0, 5) || (request.needed_at ? formatInJobTimezone(request.needed_at, "HH:mm") : ""),
      provider: load?.transport_provider || unload?.transport_provider || "",
      licensePlate: load?.license_plate || unload?.license_plate || "",
      loadingBay: load?.loading_bay || unload?.loading_bay || "",
      notes: request.events.length ? (load ?? unload)?.notes ?? "" : request.note || "",
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
        title: request.events.length ? "Planificación actualizada" : "Transporte planificado",
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
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-2xl p-0 sm:p-6">
        <div className="min-w-0 space-y-5 px-4 pb-4 pt-2 sm:p-0">
          <ResponsiveDialogHeader className="pr-10 sm:pr-8">
            <ResponsiveDialogTitle className="break-words">
              {request?.events.length ? "Editar planificación" : "Planificar transporte"}
            </ResponsiveDialogTitle>
            {request && (
              <ResponsiveDialogDescription className="break-words">
                {request.job_title}
              </ResponsiveDialogDescription>
            )}
          </ResponsiveDialogHeader>

          <form onSubmit={submit} className="min-w-0 space-y-5">
            {request && <section className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm" aria-label="Resumen de la petición">
              <p className="font-medium">Lo que te han pedido</p>
              {request.description && <p className="break-words">{request.description}</p>}
              {request.note && <p className="break-words text-muted-foreground">Indicaciones: {request.note}</p>}
              <p className="break-words">{request.origin || "Origen pendiente"} → {request.destination || "Destino pendiente"}</p>
              <p>{request.items.map((item) => getLogisticsTransportTypeLabel(item.transport_type)).join(" · ")}</p>
              {request.needed_at && <p>Necesario el {formatInJobTimezone(request.needed_at, "dd/MM/yyyy 'a las' HH:mm")} (Madrid)</p>}
            </section>}
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

            <section className="space-y-3" aria-label="Horario del transporte">
              <div><h3 className="font-medium">1. Indica cuándo se recoge y se entrega</h3><p className="text-sm text-muted-foreground">Horario de Madrid. Revisa las fechas sugeridas a partir de la petición.</p></div>
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <p className="text-sm font-medium sm:col-span-2">Recogida / carga{request?.origin ? ` · ${request.origin}` : ""}</p>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="transport-load-date">Carga · fecha</Label>
                <Input id="transport-load-date" type="date" {...form.register("loadDate")} />
                {form.formState.errors.loadDate && <p className="text-xs text-destructive">{form.formState.errors.loadDate.message}</p>}
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="transport-load-time">Carga · hora</Label>
                <Input id="transport-load-time" type="time" {...form.register("loadTime")} />
                {form.formState.errors.loadTime && <p className="text-xs text-destructive">{form.formState.errors.loadTime.message}</p>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2"><p className="text-sm font-medium">Entrega / descarga{request?.destination ? ` · ${request.destination}` : ""}</p><Button type="button" size="sm" variant="outline" disabled={!form.watch("loadDate")} onClick={() => form.setValue("unloadDate", form.getValues("loadDate"), { shouldDirty: true, shouldValidate: true })}>Entrega el mismo día</Button></div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="transport-unload-date">Descarga · fecha</Label>
                <Input id="transport-unload-date" type="date" {...form.register("unloadDate")} />
                {form.formState.errors.unloadDate && <p className="text-xs text-destructive">{form.formState.errors.unloadDate.message}</p>}
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="transport-unload-time">Descarga · hora</Label>
                <Input id="transport-unload-time" type="time" {...form.register("unloadTime")} />
                {form.formState.errors.unloadTime && <p className="text-xs text-destructive">{form.formState.errors.unloadTime.message}</p>}
              </div>
            </div>
            </section>

            <details key={`${request?.id}-${open}`} open={Boolean(request?.events.some((event) => event.transport_provider || event.license_plate || event.loading_bay || event.notes))} className="rounded-lg border p-3">
              <summary className="cursor-pointer font-medium">2. Añadir proveedor, matrícula o instrucciones (opcional)</summary>
              <p className="mt-2 text-sm text-muted-foreground">Puedes guardar el horario y completar estos datos más adelante.</p>
              <div className="mt-4 space-y-4">
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="transport-provider">Proveedor</Label>
                <Select value={form.watch("provider") || "__none"} onValueChange={(value) => form.setValue("provider", value === "__none" ? "" : value, { shouldDirty: true })}>
                  <SelectTrigger id="transport-provider" className="w-full min-w-0"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sin asignar</SelectItem>
                    {Object.entries(TRANSPORT_PROVIDERS).map(([value, provider]) => (
                      <SelectItem key={value} value={value}>{provider.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="transport-plate">Matrícula / identificador</Label>
                <Input id="transport-plate" {...form.register("licensePlate")} placeholder="Opcional" />
                {form.formState.errors.licensePlate && <p className="text-xs text-destructive">{form.formState.errors.licensePlate.message}</p>}
              </div>
              <div className="min-w-0 space-y-2 sm:col-span-2">
                <Label htmlFor="transport-bay">Muelle / punto de carga</Label>
                <Input id="transport-bay" {...form.register("loadingBay")} placeholder="Opcional" />
                {form.formState.errors.loadingBay && <p className="text-xs text-destructive">{form.formState.errors.loadingBay.message}</p>}
              </div>
            </div>

            <div className="min-w-0 space-y-2">
              <Label htmlFor="transport-plan-notes">Notas operativas</Label>
              <Textarea id="transport-plan-notes" {...form.register("notes")} rows={3} />
              {form.formState.errors.notes && <p className="text-xs text-destructive">{form.formState.errors.notes.message}</p>}
            </div>
              </div>
            </details>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Guardando…" : request?.events.length ? "Actualizar planificación" : "Guardar planificación"}
              </Button>
            </div>
          </form>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
