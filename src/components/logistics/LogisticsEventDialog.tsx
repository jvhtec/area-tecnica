
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ALL_DEPARTMENTS, type Department } from "@/types/department";
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
import { Trash2 } from "lucide-react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { SimplifiedJobColorPicker } from "@/components/jobs/SimplifiedJobColorPicker";
import { REQUEST_TRANSPORT_OPTIONS } from "@/constants/transportOptions";
import { getLogisticsTransportTypeLabel } from "@/components/technician/details-modal/formatters";
import type { TransportProvider } from "@/constants/transportProviders";
import {
  LOGISTICS_HOJA_CATEGORY_LABELS,
  LOGISTICS_HOJA_CATEGORY_MAX_SELECTION,
  LOGISTICS_HOJA_CATEGORY_OPTIONS,
  type LogisticsHojaCategory,
} from "@/constants/logisticsHojaCategories";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/react-query";
import { LogisticsEventPlaceField } from "./LogisticsEventPlaceField";
import { CrewTransferFields, CrewTransferReturnFields, TransportEndFields, TransportMovementField } from "./LogisticsEventTransportFields";
import { isTransportMovementType, type TransportMovementType } from "@/constants/transportMovementTypes";
import { buildReturnTrip, validateTransportPlan } from "@/features/logistics/events/transportPlan";
import {
  saveLogisticsEventPlan,
  type LogisticsEventSavePayload,
} from "@/features/logistics/events/logisticsEventApi";
import { useJobTimeSpan } from "@/features/logistics/events/useJobTimeSpan";
import { LogisticsProviderSelect } from "./LogisticsProviderSelect";
import { SleeperBusBerthPlanner } from "./fleet/SleeperBusBerthPlanner";
import { useLogisticsEventLocation } from "@/features/logistics/events/useLogisticsEventLocation";
import { deleteLogisticsEvent, notifyDriverAssignmentsForEvent } from "@/features/logistics/fleet/fleetApi";
import { broadcastLogisticsEvent, diffLogisticsEventChanges } from "@/features/logistics/events/logisticsEventBroadcast";
import { isDriverRelevantEventChange } from "@/features/logistics/events/driverRelevantEventChange";
import { getErrorMessage } from '@/utils/errorMessage';
import { useJobCrewCount } from "@/features/logistics/fleet/useLogisticsFleet";
import { LOGISTICS_EVENT_TYPE_OPTIONS, type LogisticsCalendarEvent, type LogisticsEventType } from "@/components/logistics/logisticsEventTypes";
type LogisticsTransportType = Database["public"]["Enums"]["transport_type"];

// Available departments
const departments: Department[] = ["sound", "lights", "video"];

interface LogisticsEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  selectedEvent?: LogisticsCalendarEvent | null;
  // Optional initial values when creating a new event
  initialJobId?: string | null;
  initialDepartments?: Department[];
  initialTransportType?: LogisticsTransportType;
  initialEventType?: LogisticsEventType;
  onCreated?: (details: { id: string; event_type: LogisticsEventType; event_date: string; event_time: string }) => void;
}

export const LogisticsEventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  selectedEvent,
  initialJobId = null,
  initialDepartments = [],
  initialTransportType,
  initialEventType,
  onCreated,
}: LogisticsEventDialogProps) => {
  const [eventType, setEventType] = useState<LogisticsEventType>("load");
  const [transportType, setTransportType] = useState<LogisticsTransportType>("trailer");
  const [time, setTime] = useState("09:00");
  const [date, setDate] = useState(selectedDate ? format(selectedDate, "yyyy-MM-dd") : "");
  const [loadingBay, setLoadingBay] = useState("");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [transportProvider, setTransportProvider] = useState<TransportProvider | null>(null);
  const [berthCount, setBerthCount] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [color, setColor] = useState("#7E69AB");
  const [alsoCreateUnload, setAlsoCreateUnload] = useState(false);
  // Optional end of the transport: the driver/vehicle stay blocked until then.
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  // Crew transfers (traslados de personal).
  const [passengerCount, setPassengerCount] = useState<number | null>(null);
  const [movementType, setMovementType] = useState<TransportMovementType | null>("transfer");
  const [alsoCreateReturn, setAlsoCreateReturn] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [isHojaRelevant, setIsHojaRelevant] = useState(true);
  const [hojaCategories, setHojaCategories] = useState<LogisticsHojaCategory[]>([]);
  // For a crew transfer `location` is the destination and `origin` the pick-up point.
  const location = useLogisticsEventLocation(open);
  const origin = useLogisticsEventLocation(open);
  const isCrewTransfer = eventType === "crew_transfer";

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const normalizeCategories = (categories: unknown): LogisticsHojaCategory[] => {
    if (!Array.isArray(categories)) return [];
    return categories.filter((category): category is LogisticsHojaCategory =>
      LOGISTICS_HOJA_CATEGORY_OPTIONS.includes(category as LogisticsHojaCategory)
    );
  };

  const toggleHojaCategory = (category: LogisticsHojaCategory) => {
    setHojaCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((item) => item !== category);
      }

      if (prev.length >= LOGISTICS_HOJA_CATEGORY_MAX_SELECTION) {
        toast({
          title: "Límite alcanzado",
          description: `Puedes seleccionar hasta ${LOGISTICS_HOJA_CATEGORY_MAX_SELECTION} categorías.`,
          variant: "destructive",
        });
        return prev;
      }

      return [...prev, category];
    });
  };

  // Initialize form state when dialog opens or when switching to a different event
  useEffect(() => {
    if (!open) return;

    if (selectedEvent?.id) {
      setEventType(selectedEvent.event_type);
      setTransportType(selectedEvent.transport_type);
      setTime(selectedEvent.event_time);
      setDate(
        selectedEvent.event_date
          ? format(new Date(selectedEvent.event_date), "yyyy-MM-dd")
          : ""
      );
      setLoadingBay(selectedEvent.loading_bay || "");
      setSelectedJob(selectedEvent.job_id || null);
      setCustomTitle(selectedEvent.title || "");
      setLicensePlate(selectedEvent.license_plate || "");
      setTransportProvider(selectedEvent.transport_provider || null);
      setBerthCount(selectedEvent.berth_count ?? null);
      setEndDate(selectedEvent.end_date ?? "");
      setEndTime(selectedEvent.end_time?.slice(0, 5) ?? "");
      setPassengerCount(selectedEvent.passenger_count ?? null);
      setMovementType(isTransportMovementType(selectedEvent.movement_type) ? selectedEvent.movement_type : null);
      setNotes(selectedEvent.notes || "");
      setSelectedDepartments(
        (selectedEvent.departments || [])
          .map((department) => department.department)
          .filter((department): department is Department => ALL_DEPARTMENTS.includes(department as Department))
      );
      setColor(selectedEvent.color || "#7E69AB");
      setIsHojaRelevant(selectedEvent.is_hoja_relevant ?? true);
      setHojaCategories(normalizeCategories(selectedEvent.hoja_categories));
      location.reset(selectedEvent.location_id ?? null);
      origin.reset(selectedEvent.origin_location_id ?? null);
    } else {
      setEventType(initialEventType || "load");
      setTransportType(initialTransportType || "trailer");
      setTime("09:00");
      setDate(selectedDate ? format(selectedDate, "yyyy-MM-dd") : "");
      setLoadingBay("");
      setSelectedJob(initialJobId || null);
      setCustomTitle("");
      setLicensePlate("");
      setTransportProvider(null);
      setBerthCount(null);
      setEndDate("");
      setEndTime("");
      setPassengerCount(null);
      setMovementType("transfer");
      setAlsoCreateReturn(false);
      setReturnDate("");
      setReturnTime("");
      setNotes("");
      setSelectedDepartments(initialDepartments || []);
      setColor("#7E69AB");
      setAlsoCreateUnload(false);
      setIsHojaRelevant(true);
      setHojaCategories([]);
      location.reset(null);
      origin.reset(null);
      // Ensure job selection is cleared if no initial job is provided
      if (!initialJobId) {
        setSelectedJob(null);
      }
    }
    // Only re-run when dialog opens or we switch to a different event
  }, [open, selectedEvent?.id]);

  // Fetch available Jobs (used for read-only job label and select)
  const monthAnchor = selectedDate || new Date();
  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = endOfMonth(monthAnchor);

  const { data: jobs } = useQuery({
    queryKey: queryKeys.scope("logistics-dialog-jobs", monthStart.toISOString(), monthEnd.toISOString()),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from("jobs")
        .select("id, title, start_time, status, job_type, location_id")
        .in("status", ["Tentativa", "Confirmado"])
        .neq("job_type", "dryhire")
        .gte("start_time", monthStart.toISOString())
        .lte("start_time", monthEnd.toISOString())
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const jobCrew = useJobCrewCount(isCrewTransfer ? selectedJob : null);
  const jobSpan = useJobTimeSpan(selectedJob, open);

  const handleDelete = async () => {
    try {
      if (!selectedEvent) return;

      // One DB transaction: if the assignment guard rejects the event delete,
      // its department links are restored automatically.
      await deleteLogisticsEvent(selectedEvent.id);

      toast({
        title: "Éxito",
        description: "Evento de logística eliminado correctamente.",
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.scope("logistics-events") });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("today-logistics") });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("logistics-transport-inbox") });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("transport-request") });

      await broadcastLogisticsEvent(selectedEvent, {
        type: "logistics.event.cancelled",
        departments: (selectedEvent.departments || []).map((dept) => dept.department),
      });

      // Close both the delete dialog and the main event dialog
      setShowDeleteDialog(false);
      // Small timeout to allow the alert dialog to fully unmount before closing the parent dialog
      // This prevents "Failed to execute 'removeChild' on 'Node'" errors
      setTimeout(() => onOpenChange(false), 100);
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo eliminar el evento de logística"),
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time || (!selectedJob && !customTitle)) {
      toast({
        title: "Error",
        description: "Fecha, hora y título (si no hay trabajo) son obligatorios.",
        variant: "destructive",
      });
      return;
    }
    const validationError = validateTransportPlan({
      eventType,
      transportType,
      date,
      time,
      endDate,
      endTime,
      hasJob: Boolean(selectedJob),
      originInput: origin.input,
      destinationInput: location.input,
      passengerCount,
      createReturn: alsoCreateReturn && !selectedEvent,
      returnDate,
      returnTime,
    });
    if (validationError) {
      toast({ title: "Revisa el transporte", description: validationError, variant: "destructive" });
      return;
    }

    try {
      const resolvedLocationId = await location.resolve();
      const resolvedOriginId = isCrewTransfer ? await origin.resolve() : null;

      if (location.input.trim() && !resolvedLocationId) {
        toast({
          title: "Revisa el transporte",
          description: "Selecciona el destino de la lista para guardar una ubicación válida.",
          variant: "destructive",
        });
        return;
      }
      if (isCrewTransfer && origin.input.trim() && !resolvedOriginId) {
        toast({
          title: "Revisa el transporte",
          description: "Selecciona el punto de encuentro de la lista para guardar una ubicación válida.",
          variant: "destructive",
        });
        return;
      }

      let jobLocationId = jobs?.find((candidate) => candidate.id === selectedJob)?.location_id ?? null;
      if (isCrewTransfer && selectedJob && !resolvedLocationId && !jobLocationId) {
        const { data: selectedJobData, error: selectedJobError } = await dataLayerClient
          .from("jobs")
          .select("location_id")
          .eq("id", selectedJob)
          .maybeSingle();
        if (selectedJobError) throw selectedJobError;
        jobLocationId = selectedJobData?.location_id ?? null;
      }
      const effectiveDestinationId = resolvedLocationId ?? jobLocationId;
      if (isCrewTransfer && !effectiveDestinationId) {
        toast({
          title: "Revisa el transporte",
          description: "El traslado necesita un destino o un trabajo con recinto.",
          variant: "destructive",
        });
        return;
      }
      if (isCrewTransfer && resolvedOriginId === effectiveDestinationId) {
        toast({ title: "Revisa el transporte", description: "El origen y el destino no pueden ser el mismo lugar.", variant: "destructive" });
        return;
      }

      const eventData: LogisticsEventSavePayload = {
        event_type: eventType,
        transport_type: transportType,
        transport_provider: transportProvider || null,
        // Sleeper buses only (the database clears it on any other type).
        berth_count: transportType === "sleeper_bus" ? berthCount : null,
        notes: notes || null,
        event_date: date,
        event_time: time,
        loading_bay: loadingBay || null,
        job_id: selectedJob || null,
        title: customTitle || null,
        license_plate: licensePlate || null,
        color: color,
        is_hoja_relevant: isHojaRelevant,
        hoja_categories: hojaCategories,
        // These postdate the generated types (see logisticsEventTypes.ts).
        location_id: resolvedLocationId,
        end_date: endDate || null,
        end_time: endDate && endTime ? endTime : null,
        // Crew transfers only (the database clears them on loads/unloads).
        origin_location_id: resolvedOriginId,
        passenger_count: isCrewTransfer ? passengerCount : null,
        movement_type: isCrewTransfer ? null : movementType,
      };

      let pairedPayload: LogisticsEventSavePayload | null = null;
      if (!selectedEvent && alsoCreateReturn && isCrewTransfer) {
        const job = jobs?.find((candidate) => candidate.id === selectedJob);
        pairedPayload = buildReturnTrip(eventData, {
          destinationId: effectiveDestinationId,
          returnDate,
          returnTime,
          outboundTitle: customTitle.trim() || job?.title || "Traslado",
        });
      } else if (!selectedEvent && alsoCreateUnload && eventType === "load") {
        pairedPayload = { ...eventData, event_type: "unload" };
      }

      const saved = await saveLogisticsEventPlan({
        eventId: selectedEvent?.id ?? null,
        event: eventData,
        departments: selectedDepartments,
        pairedEvent: pairedPayload,
      });

      if (selectedEvent) {
        await broadcastLogisticsEvent(saved.event, {
          type: "logistics.event.updated",
          departments: selectedDepartments,
          changes: diffLogisticsEventChanges(selectedEvent, eventData, {
            categories: [normalizeCategories(selectedEvent.hoja_categories), normalizeCategories(eventData.hoja_categories)],
            departments: [(selectedEvent.departments || []).map((d) => d.department), selectedDepartments],
          }),
        });
        // Only edits the DB trigger treats as material reset a driver's confirmation;
        // cosmetic ones (colour, departments, plate) must not push "confírmalo".
        if (isDriverRelevantEventChange(selectedEvent, eventData)) {
          void notifyDriverAssignmentsForEvent(selectedEvent.id).catch((notificationError) => {
            console.error("Failed to notify drivers after logistics event update", notificationError);
          });
        }

        toast({
          title: "Éxito",
          description: "Evento de logística actualizado correctamente.",
        });
      } else {
        const newEvent = saved.event;
        const pairedEvent = saved.pairedEvent;

        for (const created of [newEvent, pairedEvent]) {
          if (!created) continue;
          try {
            onCreated?.({
              id: created.id,
              event_type: created.event_type,
              event_date: created.event_date,
              event_time: created.event_time,
            });
          } catch {
            // Optional caller callback; the database save already succeeded.
          }
        }

        if (pairedEvent) {
          const legOf = (event: typeof newEvent) => ({
            event_type: event.event_type,
            event_date: event.event_date,
            event_time: event.event_time,
          });
          await broadcastLogisticsEvent(newEvent, { departments: selectedDepartments, pairedEvent: legOf(pairedEvent) });
          await broadcastLogisticsEvent(pairedEvent, {
            departments: selectedDepartments,
            autoCreatedUnload: pairedEvent.event_type === "unload" || undefined,
            pairedEvent: legOf(newEvent),
          });
        } else {
          await broadcastLogisticsEvent(newEvent, { departments: selectedDepartments });
        }

        toast({
          title: "Éxito",
          description: "Evento de logística creado correctamente.",
        });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.scope("logistics-events") });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("today-logistics") });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("logistics-transport-inbox") });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("transport-request") });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo guardar el evento de logística"),
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent ? "Editar evento de logística" : "Crear evento de logística"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Job Selection or locked job display */}
            {!initialJobId ? (
              <div className="space-y-2">
                <Label>Trabajo</Label>
                <Select
                  value={selectedJob || "no-job"}
                  onValueChange={(value) => {
                    setSelectedJob(value === "no-job" ? null : value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un trabajo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-job">Sin trabajo</SelectItem>
                    {jobs?.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.start_time
                          ? `${job.title} · ${format(new Date(job.start_time), "dd/MM HH:mm")}`
                          : job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Trabajo</Label>
                <div className="px-3 py-2 border rounded bg-muted text-sm">
                  {(() => {
                    const jt = jobs?.find(j => j.id === (selectedEvent?.job_id || initialJobId))?.title;
                    return jt || 'Trabajo asignado';
                  })()}
                </div>
              </div>
            )}

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Color del evento</Label>
              <SimplifiedJobColorPicker
                color={color}
                onChange={setColor}
              />
            </div>

            {/* Custom Title (only required if no job is selected) */}
            {selectedJob === null && (
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Introduce el título del evento"
                  required
                />
              </div>
            )}

            {/* Event Type */}
            <div className="space-y-2">
              <Label>Tipo de evento</Label>
              <Select
                value={eventType}
                onValueChange={(value: LogisticsEventType) => {
                  setEventType(value);
                  // People travel in vans, RVs and sleeper buses, not in trucks.
                  if (value === "crew_transfer" && !selectedEvent && !["furgoneta", "rv", "sleeper_bus"].includes(transportType)) {
                    setTransportType("furgoneta");
                  }
                }}
              >
                <SelectTrigger aria-label="Tipo de evento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOGISTICS_EVENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Time */}
            <div className="space-y-2">
              <Label>{isCrewTransfer ? "Hora de salida" : "Hora"}</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>

            <TransportEndFields
              crewTransfer={isCrewTransfer}
              startDate={date}
              endDate={endDate}
              endTime={endTime}
              onEndDateChange={setEndDate}
              onEndTimeChange={setEndTime}
              jobSpan={jobSpan.data}
              onUseJobSpan={(span) => { setDate(span.startDate); setTime(span.startTime); setEndDate(span.endDate); setEndTime(span.endTime); }}
            />

            {/* Transport Type */}
            <div className="space-y-2">
              <Label>Tipo de vehículo</Label>
              <Select value={transportType} onValueChange={(value) => setTransportType(value as LogisticsTransportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TRANSPORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {getLogisticsTransportTypeLabel(opt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* License Plate */}
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                placeholder="Introduce matrícula (opcional)"
              />
            </div>

            <LogisticsProviderSelect value={transportProvider} onChange={setTransportProvider} />

            {transportType === "sleeper_bus" && (
              <SleeperBusBerthPlanner
                jobId={selectedJob}
                dateKey={date}
                eventType={eventType}
                eventId={selectedEvent?.id ?? null}
                berthCount={berthCount}
                onBerthCountChange={setBerthCount}
                provider={transportProvider}
                onProviderChange={setTransportProvider}
                passengers={isCrewTransfer ? passengerCount : null}
              />
            )}

            {/* Departments */}
            <div className="space-y-2">
              <Label>Departamentos</Label>
              <div className="flex flex-wrap gap-2">
                {departments.map((dept) => (
                  <Button
                    key={dept}
                    type="button"
                    variant={selectedDepartments.includes(dept) ? "default" : "outline"}
                    onClick={() => {
                      setSelectedDepartments((prev) =>
                        prev.includes(dept)
                          ? prev.filter((d) => d !== dept)
                          : [...prev, dept]
                      );
                    }}
                  >
                    {dept}
                  </Button>
                ))}
              </div>
            </div>

            {isCrewTransfer ? (
              <CrewTransferFields
                origin={origin}
                destination={location}
                hasJob={Boolean(selectedJob)}
                passengerCount={passengerCount}
                onPassengerCountChange={setPassengerCount}
                jobCrewTotal={selectedJob ? jobCrew.data?.total ?? null : null}
              />
            ) : (
              <>
                <TransportMovementField value={movementType} onChange={setMovementType} />
                <LogisticsEventPlaceField location={location} hasJob={Boolean(selectedJob)} />

                {/* Loading Bay */}
                <div className="space-y-2">
                  <Label>Muelle de carga</Label>
                  <Input
                    value={loadingBay}
                    onChange={(e) => setLoadingBay(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isHojaRelevant"
                  checked={isHojaRelevant}
                  disabled={!selectedJob}
                  onCheckedChange={(value) => setIsHojaRelevant(value === true)}
                />
                <Label htmlFor="isHojaRelevant">Relevante para Hoja de Ruta</Label>
              </div>
              {!selectedJob && (
                <p className="text-xs text-muted-foreground">
                  Selecciona un trabajo para configurar la relevancia en Hoja de Ruta.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Categorías para Hoja de Ruta</Label>
                <span className="text-xs text-muted-foreground">
                  {hojaCategories.length}/{LOGISTICS_HOJA_CATEGORY_MAX_SELECTION}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {LOGISTICS_HOJA_CATEGORY_OPTIONS.map((category) => (
                  <Button
                    key={category}
                    type="button"
                    size="sm"
                    variant={hojaCategories.includes(category) ? "default" : "outline"}
                    disabled={!selectedJob || !isHojaRelevant}
                    onClick={() => toggleHojaCategory(category)}
                  >
                    {LOGISTICS_HOJA_CATEGORY_LABELS[category]}
                  </Button>
                ))}
              </div>
              {(!selectedJob || !isHojaRelevant) && (
                <p className="text-xs text-muted-foreground">
                  Selecciona un trabajo y marca el evento como relevante para asignar categorías.
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas o instrucciones adicionales…"
                className="resize-none"
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                {notes.length} / 500 caracteres
              </div>
            </div>

            {!selectedEvent && isCrewTransfer && (
              <CrewTransferReturnFields
                enabled={alsoCreateReturn}
                onEnabledChange={setAlsoCreateReturn}
                returnDate={returnDate}
                returnTime={returnTime}
                minDate={endDate || date}
                onReturnDateChange={setReturnDate}
                onReturnTimeChange={setReturnTime}
              />
            )}


            {/* Submit & Delete Buttons */}
            <div className="flex justify-between items-center pt-2">
              {selectedEvent && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              )}
              {!selectedEvent && eventType === 'load' && (
                <div className="flex items-center gap-2">
                  <Checkbox id="alsoCreateUnload" checked={alsoCreateUnload} onCheckedChange={(v) => setAlsoCreateUnload(!!v)} />
                  <Label htmlFor="alsoCreateUnload" className="text-sm">Crear también descarga</Label>
                </div>
              )}
              <Button type="submit">
                {selectedEvent ? "Actualizar" : "Crear"} evento
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete AlertDialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer y eliminará el evento permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
