import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import {
  AlertTriangle,
  Bed,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Hotel,
  Loader2,
  Map as MapIcon,
  MapPin,
  Plus,
  Route,
  Save,
  Send,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TourDocumentsDialog } from "@/components/tours/TourDocumentsDialog";
import { TourContactsManager } from "@/components/tours/scheduling/TourContactsManager";
import { TourMapViewMapbox } from "@/components/tours/scheduling/TourMapViewMapbox";
import { TourSettingsPanel } from "@/components/tours/scheduling/TourSettingsPanel";
import { cn } from "@/lib/utils";
import { dataLayerClient } from "@/services/dataLayerClient";
import { MADRID_TIMEZONE, utcToLocalInput } from "@/utils/timezoneUtils";
import type {
  TourGuestLink,
  TourOpsAllowedSections,
  TourOpsAccommodation,
  TourOpsDate,
  TourOpsModel,
  TourOpsRoomAssignment,
  TourOpsTimelineEvent,
  TourOpsTravelSegment,
} from "@/features/tour-ops/types";
import { DEFAULT_TOUR_OPS_SECTIONS } from "@/features/tour-ops/types";
import {
  useTourGuestLinkMutations,
  useTourGuestLinks,
  useTourOps,
  useTourOpsMutations,
} from "@/features/tour-ops/useTourOps";
import { generateTourOpsPdf } from "@/features/tour-ops/tourOpsPdf";

interface TourOpsManagementHubProps {
  tourId: string;
  tourName: string;
}

const eventTypeOptions = ["show", "rehearsal", "travel", "load_in", "show_call", "meeting", "day_off", "hotel", "note", "other"];
const transportOptions = ["bus", "van", "plane", "train", "ferry", "truck", "personal"];

const dateOnlyAsMadridNoon = (value: string) => (value.includes("T") ? value : `${value}T12:00:00`);
const formatDate = (value: string) =>
  formatInTimeZone(dateOnlyAsMadridNoon(value), MADRID_TIMEZONE, "EEE d MMM yyyy", { locale: es });
const formatTime = (value?: string | null) => {
  if (!value) return "";
  if (value.includes("T")) {
    return formatInTimeZone(value, MADRID_TIMEZONE, "d MMM HH:mm", { locale: es });
  }
  return value.slice(0, 5);
};

const dateTimeInputValue = (value?: string | null) => {
  if (!value) return "";
  if (!value.includes("T")) return value;
  try {
    return utcToLocalInput(value, MADRID_TIMEZONE);
  } catch {
    return "";
  }
};

const finiteNumberOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const sourceLabel = (source?: string) =>
  source === "hoja" ? "hoja de ruta" : source === "legacy" ? "legacy" : "ops";

const guestLinkUrl = (link: Pick<TourGuestLink, "token">) =>
  link.token && typeof window !== "undefined" ? `${window.location.origin}/tour-share/${link.token}` : null;

const roomOccupants = (room: TourOpsRoomAssignment) =>
  [room.staffMember1Name, room.staffMember2Name, room.staffMember1Id, room.staffMember2Id]
    .filter(Boolean)
    .join(" / ");

const DateList = ({
  dates,
  selectedDateId,
  onSelect,
}: {
  dates: TourOpsDate[];
  selectedDateId: string | null;
  onSelect: (id: string) => void;
}) => (
  <div className="space-y-2">
    {dates.map((date, index) => (
      <button
        key={date.id}
        type="button"
        className={cn(
          "w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/60",
          selectedDateId === date.id && "border-primary bg-primary/10",
        )}
        onClick={() => onSelect(date.id)}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted-foreground">Dia {index + 1}</span>
          {date.health.length ? (
            <Badge variant="destructive" className="text-[10px]">{date.health.length} avisos</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Completo</Badge>
          )}
        </div>
        <div className="mt-1 font-medium">{formatDate(date.date)}</div>
        <div className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 mt-0.5" />
          <span className="line-clamp-2">{date.venueName || date.location?.name || "Venue pendiente"}</span>
        </div>
      </button>
    ))}
  </div>
);

const DateDetail = ({ model, date }: { model: TourOpsModel; date: TourOpsDate | null }) => {
  if (!date) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">Selecciona una fecha.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {formatDate(date.date)}
              </CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">
                {date.venueName || date.location?.name || "Venue pendiente"}
              </div>
            </div>
            <Button variant="outline" onClick={() => generateTourOpsPdf(model, "management", { dateId: date.id })}>
              <Download className="h-4 w-4 mr-2" />
              PDF hoja diaria
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs uppercase text-muted-foreground">Venue</div>
            <div className="mt-1 font-medium">{date.venueName || date.location?.name || "Por confirmar"}</div>
            <div className="text-sm text-muted-foreground">{date.venueAddress || date.location?.formattedAddress || ""}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs uppercase text-muted-foreground">Equipo</div>
            <div className="mt-1 font-medium">{date.crew.length} personas</div>
            <div className="text-sm text-muted-foreground">{date.jobTitle || date.jobId || "Sin job vinculado"}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs uppercase text-muted-foreground">Ops</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant={date.program.length ? "default" : "outline"}>Programa</Badge>
              <Badge variant={date.travelIn.length + date.travelOut.length ? "default" : "outline"}>Viajes</Badge>
              <Badge variant={date.accommodations.length ? "default" : "outline"}>Hotel</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {date.health.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-4 space-y-2">
            {date.health.map((issue) => (
              <div key={issue.id} className="flex gap-2 text-sm text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  <div className="font-medium">{issue.label}</div>
                  <div>{issue.detail}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Programa</CardTitle></CardHeader>
          <CardContent>
            {date.program.length ? (
              <div className="space-y-3">
                {date.program.map((day, index) => (
                  <div key={`${day.label}-${index}`} className="space-y-2">
                    {day.label && <div className="text-xs font-semibold uppercase text-muted-foreground">{day.label}</div>}
                    {day.rows.map((row, rowIndex) => (
                      <div key={rowIndex} className="grid grid-cols-[58px_1fr] gap-3 text-sm">
                        <div className="font-mono text-muted-foreground">{row.time || "--:--"}</div>
                        <div>
                          <div className="font-medium">{row.item || "Actividad"}</div>
                          <div className="text-xs text-muted-foreground">{[row.dept, row.notes].filter(Boolean).join(" - ")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sin programa definido.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Viajes y transporte</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[...date.travelIn, ...date.travelOut].length ? [...date.travelIn, ...date.travelOut].map((segment) => (
              <div key={`${segment.source}-${segment.id}`} className="rounded-md border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{segment.fromLabel} {"->"} {segment.toLabel}</div>
                    <div className="text-muted-foreground">
                      {[segment.transportationType, formatTime(segment.departureTime), formatTime(segment.arrivalTime), segment.carrierName]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <Badge variant="outline">{sourceLabel(segment.source)}</Badge>
                </div>
                {segment.routeNotes && <div className="mt-2 text-muted-foreground">{segment.routeNotes}</div>}
              </div>
            )) : (
              <div className="text-sm text-muted-foreground">Sin viajes definidos.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Equipo y alojamiento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {date.crew.length ? date.crew.slice(0, 8).map((member) => (
                <div key={member.id} className="flex justify-between gap-3 rounded-md bg-muted/50 p-2 text-sm">
                  <span>{member.name}</span>
                  <span className="text-muted-foreground">{member.role || member.department}</span>
                </div>
              )) : <div className="text-sm text-muted-foreground">Sin crew confirmado.</div>}
            </div>
            <div className="border-t pt-3 space-y-2">
              {date.accommodations.length ? date.accommodations.map((hotel) => (
                <div key={`${hotel.source}-${hotel.id}`} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{hotel.hotelName}</span>
                    <Badge variant="outline">{sourceLabel(hotel.source)}</Badge>
                  </div>
                  <div className="text-muted-foreground">{hotel.checkInDate} {"->"} {hotel.checkOutDate}</div>
                  {hotel.roomAllocation.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {hotel.roomAllocation.map((room, index) => (
                        <div key={room.id ?? index} className="rounded bg-muted/50 px-2 py-1 text-xs">
                          {[room.roomType || "habitacion", room.roomNumber, roomOccupants(room)].filter(Boolean).join(" · ")}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )) : <div className="text-sm text-muted-foreground">Sin alojamiento definido.</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const EventDialog = ({
  model,
  open,
  onOpenChange,
  editingEvent,
  selectedDate,
  onSave,
}: {
  model: TourOpsModel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEvent: TourOpsTimelineEvent | null;
  selectedDate: TourOpsDate | null;
  onSave: (input: Partial<TourOpsTimelineEvent> & { tourId: string; date: string; title: string }) => Promise<void>;
}) => {
  const [form, setForm] = useState({
    title: "",
    eventType: "other",
    date: selectedDate?.date?.slice(0, 10) ?? "",
    startTime: "",
    endTime: "",
    description: "",
    locationDetails: "",
    visibleToCrew: true,
  });

  useEffect(() => {
    if (editingEvent) {
      setForm({
        title: editingEvent.title,
        eventType: editingEvent.eventType,
        date: editingEvent.date,
        startTime: editingEvent.startTime ?? "",
        endTime: editingEvent.endTime ?? "",
        description: editingEvent.description ?? "",
        locationDetails: editingEvent.locationDetails ?? "",
        visibleToCrew: editingEvent.visibleToCrew,
      });
    } else {
      setForm({
        title: "",
        eventType: "other",
        date: selectedDate?.date?.slice(0, 10) ?? model.dates[0]?.date?.slice(0, 10) ?? "",
        startTime: "",
        endTime: "",
        description: "",
        locationDetails: selectedDate?.venueName ?? "",
        visibleToCrew: true,
      });
    }
  }, [editingEvent, model.dates, selectedDate, open]);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.date) {
      toast.error("Titulo y fecha son obligatorios");
      return;
    }
    await onSave({
      id: editingEvent?.id,
      tourId: model.tour.id,
      title: form.title.trim(),
      eventType: form.eventType,
      date: form.date,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      description: form.description || null,
      locationDetails: form.locationDetails || null,
      visibleToCrew: form.visibleToCrew,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingEvent ? "Editar evento" : "Nuevo evento"}</DialogTitle>
          <DialogDescription>Eventos adicionales al calendario fijo del tour.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Titulo</Label>
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.eventType} onValueChange={(eventType) => setForm({ ...form, eventType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{eventTypeOptions.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Visible a crew</Label>
              <div className="h-10 flex items-center">
                <Switch checked={form.visibleToCrew} onCheckedChange={(visibleToCrew) => setForm({ ...form, visibleToCrew })} />
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Inicio</Label>
              <Input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Fin</Label>
              <Input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ubicacion / punto de encuentro</Label>
            <Input value={form.locationDetails} onChange={(event) => setForm({ ...form, locationDetails: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}><Save className="h-4 w-4 mr-2" />Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TravelDialog = ({
  model,
  open,
  onOpenChange,
  editingSegment,
  onSave,
}: {
  model: TourOpsModel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSegment: TourOpsTravelSegment | null;
  onSave: (input: Partial<TourOpsTravelSegment> & { tourId: string }) => Promise<void>;
}) => {
  const [form, setForm] = useState({
    fromTourDateId: "",
    toTourDateId: "",
    transportationType: "bus",
    departureTime: "",
    arrivalTime: "",
    carrierName: "",
    distanceKm: "",
    estimatedDurationMinutes: "",
    routeNotes: "",
    status: "planned",
  });

  useEffect(() => {
    setForm({
      fromTourDateId: editingSegment?.fromTourDateId ?? "",
      toTourDateId: editingSegment?.toTourDateId ?? "",
      transportationType: editingSegment?.transportationType ?? "bus",
      departureTime: dateTimeInputValue(editingSegment?.departureTime),
      arrivalTime: dateTimeInputValue(editingSegment?.arrivalTime),
      carrierName: editingSegment?.carrierName ?? "",
      distanceKm: editingSegment?.distanceKm != null ? String(editingSegment.distanceKm) : "",
      estimatedDurationMinutes: editingSegment?.estimatedDurationMinutes != null ? String(editingSegment.estimatedDurationMinutes) : "",
      routeNotes: editingSegment?.routeNotes ?? "",
      status: editingSegment?.status ?? "planned",
    });
  }, [editingSegment, open]);

  const handleSubmit = async () => {
    const fromDate = model.dates.find((date) => date.id === form.fromTourDateId);
    const toDate = model.dates.find((date) => date.id === form.toTourDateId);
    await onSave({
      id: editingSegment?.id,
      source: editingSegment?.source,
      sourceTable: editingSegment?.sourceTable,
      hojaDeRutaId: editingSegment?.hojaDeRutaId,
      tourId: model.tour.id,
      fromTourDateId: form.fromTourDateId || null,
      toTourDateId: form.toTourDateId || null,
      fromLocationId: fromDate?.location?.id ?? null,
      toLocationId: toDate?.location?.id ?? null,
      fromLabel: editingSegment?.fromLabel ?? fromDate?.venueName ?? fromDate?.location?.name ?? "Base",
      toLabel: editingSegment?.toLabel ?? toDate?.venueName ?? toDate?.location?.name ?? "Base",
      transportationType: form.transportationType,
      departureTime: form.departureTime || null,
      arrivalTime: form.arrivalTime || null,
      carrierName: form.carrierName || null,
      vehicleDetails: editingSegment?.vehicleDetails ?? null,
      distanceKm: finiteNumberOrNull(form.distanceKm),
      estimatedDurationMinutes: finiteNumberOrNull(form.estimatedDurationMinutes),
      routeNotes: form.routeNotes || null,
      stops: editingSegment?.stops ?? [],
      crewManifest: editingSegment?.crewManifest ?? [],
      luggageTruck: editingSegment?.luggageTruck ?? false,
      status: form.status,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingSegment ? "Editar viaje" : "Nuevo viaje"}</DialogTitle>
          <DialogDescription>
            Los viajes nuevos se guardan en operaciones y se sincronizan con hoja de ruta cuando exista una hoja vinculada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Desde</Label>
              <Select value={form.fromTourDateId || "none"} onValueChange={(value) => setForm({ ...form, fromTourDateId: value === "none" ? "" : value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Base / externo</SelectItem>
                  {model.dates.map((date) => <SelectItem key={date.id} value={date.id}>{formatDate(date.date)} - {date.venueName || "Pendiente"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Select value={form.toTourDateId || "none"} onValueChange={(value) => setForm({ ...form, toTourDateId: value === "none" ? "" : value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Base / externo</SelectItem>
                  {model.dates.map((date) => <SelectItem key={date.id} value={date.id}>{formatDate(date.date)} - {date.venueName || "Pendiente"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Transporte</Label>
              <Select value={form.transportationType} onValueChange={(transportationType) => setForm({ ...form, transportationType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{transportOptions.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Salida</Label>
              <Input type="datetime-local" value={form.departureTime} onChange={(event) => setForm({ ...form, departureTime: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Llegada</Label>
              <Input type="datetime-local" value={form.arrivalTime} onChange={(event) => setForm({ ...form, arrivalTime: event.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Input value={form.carrierName} onChange={(event) => setForm({ ...form, carrierName: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Km</Label>
              <Input inputMode="numeric" value={form.distanceKm} onChange={(event) => setForm({ ...form, distanceKm: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Minutos</Label>
              <Input inputMode="numeric" value={form.estimatedDurationMinutes} onChange={(event) => setForm({ ...form, estimatedDurationMinutes: event.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.routeNotes} onChange={(event) => setForm({ ...form, routeNotes: event.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}><Save className="h-4 w-4 mr-2" />Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const HotelDialog = ({
  model,
  open,
  onOpenChange,
  editingHotel,
  selectedDate,
  onSave,
}: {
  model: TourOpsModel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingHotel: TourOpsAccommodation | null;
  selectedDate: TourOpsDate | null;
  onSave: (input: Partial<TourOpsAccommodation> & { tourId: string }) => Promise<void>;
}) => {
  const [form, setForm] = useState({
    tourDateId: "",
    hotelName: "",
    hotelAddress: "",
    checkInDate: "",
    checkOutDate: "",
    confirmationNumber: "",
    roomsBooked: "",
    notes: "",
  });
  const [rooms, setRooms] = useState<TourOpsRoomAssignment[]>([]);

  useEffect(() => {
    setForm({
      tourDateId: editingHotel?.tourDateId ?? selectedDate?.id ?? model.dates[0]?.id ?? "",
      hotelName: editingHotel?.hotelName ?? "",
      hotelAddress: editingHotel?.hotelAddress ?? "",
      checkInDate: editingHotel?.checkInDate ?? selectedDate?.date?.slice(0, 10) ?? "",
      checkOutDate: editingHotel?.checkOutDate ?? selectedDate?.date?.slice(0, 10) ?? "",
      confirmationNumber: editingHotel?.confirmationNumber ?? "",
      roomsBooked: editingHotel?.roomsBooked != null ? String(editingHotel.roomsBooked) : "",
      notes: editingHotel?.notes ?? "",
    });
    setRooms(editingHotel?.roomAllocation ?? []);
  }, [editingHotel, model.dates, open, selectedDate]);

  const updateRoom = (index: number, patch: Partial<TourOpsRoomAssignment>) => {
    setRooms((current) => current.map((room, roomIndex) => (roomIndex === index ? { ...room, ...patch } : room)));
  };

  const addRoom = () => {
    setRooms((current) => [
      ...current,
      {
        roomType: "single",
        roomNumber: "",
        staffMember1Id: "",
        staffMember2Id: "",
        staffMember1Name: "",
        staffMember2Name: "",
      },
    ]);
  };

  const removeRoom = (index: number) => {
    setRooms((current) => current.filter((_, roomIndex) => roomIndex !== index));
  };

  const handleSubmit = async () => {
    if (!form.hotelName.trim() || !form.checkInDate || !form.checkOutDate) {
      toast.error("Hotel, check-in y check-out son obligatorios");
      return;
    }

    await onSave({
      id: editingHotel?.id,
      source: editingHotel?.source,
      tourId: model.tour.id,
      tourDateId: form.tourDateId || null,
      hojaDeRutaId: editingHotel?.hojaDeRutaId,
      locationId: editingHotel?.locationId ?? null,
      hotelName: form.hotelName.trim(),
      hotelAddress: form.hotelAddress || null,
      latitude: editingHotel?.latitude ?? null,
      longitude: editingHotel?.longitude ?? null,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      confirmationNumber: form.confirmationNumber || null,
      roomAllocation: rooms,
      roomsBooked: finiteNumberOrNull(form.roomsBooked) ?? rooms.length,
      notes: form.notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingHotel ? "Editar hotel" : "Nuevo hotel"}</DialogTitle>
          <DialogDescription>
            Los hoteles se guardan en operaciones y se sincronizan con hoja de ruta cuando la fecha tenga hoja vinculada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Select value={form.tourDateId || "none"} onValueChange={(tourDateId) => setForm({ ...form, tourDateId: tourDateId === "none" ? "" : tourDateId })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tour general</SelectItem>
                {model.dates.map((date) => <SelectItem key={date.id} value={date.id}>{formatDate(date.date)} - {date.venueName || "Pendiente"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Hotel</Label>
              <Input value={form.hotelName} onChange={(event) => setForm({ ...form, hotelName: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Confirmacion</Label>
              <Input value={form.confirmationNumber} onChange={(event) => setForm({ ...form, confirmationNumber: event.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Direccion</Label>
            <Input value={form.hotelAddress} onChange={(event) => setForm({ ...form, hotelAddress: event.target.value })} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Check-in</Label>
              <Input type="date" value={form.checkInDate} onChange={(event) => setForm({ ...form, checkInDate: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Check-out</Label>
              <Input type="date" value={form.checkOutDate} onChange={(event) => setForm({ ...form, checkOutDate: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Habitaciones</Label>
              <Input inputMode="numeric" value={form.roomsBooked} onChange={(event) => setForm({ ...form, roomsBooked: event.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Rooming</Label>
                <p className="text-xs text-muted-foreground">Habitaciones y ocupantes sincronizados con hoja de ruta.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addRoom}>
                <Plus className="h-4 w-4 mr-1" />
                Habitacion
              </Button>
            </div>
            {rooms.length ? (
              <div className="space-y-3">
                {rooms.map((room, index) => (
                  <div key={room.id ?? index} className="grid gap-3 rounded-md bg-muted/40 p-3 md:grid-cols-[120px_120px_1fr_1fr_auto]">
                    <Select value={room.roomType || "single"} onValueChange={(roomType) => updateRoom(index, { roomType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Individual</SelectItem>
                        <SelectItem value="double">Doble</SelectItem>
                        <SelectItem value="twin">Twin</SelectItem>
                        <SelectItem value="triple">Triple</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={room.roomNumber ?? ""}
                      onChange={(event) => updateRoom(index, { roomNumber: event.target.value })}
                      placeholder="Hab."
                    />
                    <Input
                      value={room.staffMember1Name || room.staffMember1Id || ""}
                      onChange={(event) => updateRoom(index, { staffMember1Name: event.target.value, staffMember1Id: event.target.value, rawStaffMember1Id: null })}
                      placeholder="Ocupante 1"
                    />
                    <Input
                      value={room.staffMember2Name || room.staffMember2Id || ""}
                      onChange={(event) => updateRoom(index, { staffMember2Name: event.target.value, staffMember2Id: event.target.value, rawStaffMember2Id: null })}
                      placeholder="Ocupante 2"
                    />
                    <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removeRoom(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sin habitaciones definidas.</div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}><Save className="h-4 w-4 mr-2" />Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SharePanel = ({ model }: { model: TourOpsModel }) => {
  const { data: links = [], isLoading } = useTourGuestLinks(model.tour.id);
  const { createLink, revokeLink } = useTourGuestLinkMutations(model.tour.id);
  const [label, setLabel] = useState("External tour manager");
  const [expiresAt, setExpiresAt] = useState("");
  const [sections, setSections] = useState<TourOpsAllowedSections>(DEFAULT_TOUR_OPS_SECTIONS);
  const [lastToken, setLastToken] = useState<string | null>(null);

  const create = async () => {
    try {
      const link = await createLink.mutateAsync({
        label,
        allowedSections: sections,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      if (link?.token) {
        const url = `${window.location.origin}/tour-share/${link.token}`;
        setLastToken(url);
        await navigator.clipboard?.writeText(url).catch(() => undefined);
        toast.success("Link creado y copiado");
        return;
      }
      toast.error("No se recibio el token del link externo");
    } catch (err) {
      const message = err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message)
        : "No se pudo crear el link externo";
      toast.error(message);
    }
  };

  const copyLink = async (url: string) => {
    await navigator.clipboard?.writeText(url);
    toast.success("Link copiado");
  };

  const shareLink = async (link: TourGuestLink, url: string) => {
    const title = `${model.tour.name} - ${link.label}`;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`, "_blank");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader><CardTitle className="text-base">Nuevo link externo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Etiqueta</Label>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Caduca</Label>
            <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Secciones visibles</Label>
            {Object.keys(DEFAULT_TOUR_OPS_SECTIONS).map((key) => (
              <div key={key} className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm">{key}</span>
                <Switch checked={sections[key as keyof TourOpsAllowedSections]} onCheckedChange={(checked) => setSections({ ...sections, [key]: checked })} />
              </div>
            ))}
          </div>
          <Button className="w-full" onClick={create} disabled={createLink.isPending}>
            {createLink.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
            Crear link
          </Button>
          {lastToken && (
            <div className="rounded-lg border bg-muted/50 p-3 text-xs break-all">
              {lastToken}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Links activos</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : links.length ? (
            <div className="space-y-2">
              {links.map((link: TourGuestLink) => (
                <div key={link.id} className="flex flex-col gap-3 rounded-lg border p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                    <div className="font-medium">{link.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {link.expires_at ? `Caduca ${format(new Date(link.expires_at), "d MMM yyyy HH:mm", { locale: es })}` : "Sin caducidad"}
                    </div>
                    {link.revoked_at && <Badge variant="destructive" className="mt-1">Revocado</Badge>}
                    {!link.token && !link.revoked_at && (
                      <div className="mt-1 text-xs text-amber-600">
                        Link antiguo sin token recuperable. Revocalo y crea uno nuevo para copiarlo.
                      </div>
                    )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {guestLinkUrl(link) && !link.revoked_at && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => window.open(guestLinkUrl(link) ?? "", "_blank")}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            Ver
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => copyLink(guestLinkUrl(link) ?? "")}>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copiar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => shareLink(link, guestLinkUrl(link) ?? "")}>
                            <Send className="h-3.5 w-3.5 mr-1" />
                            Enviar
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={Boolean(link.revoked_at)}
                        onClick={() => revokeLink.mutate(link)}
                      >
                        Revocar
                      </Button>
                    </div>
                  </div>
                  {guestLinkUrl(link) && !link.revoked_at && (
                    <div className="rounded-md bg-muted/50 px-2 py-1 font-mono text-xs break-all">
                      {guestLinkUrl(link)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No hay links externos.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const TourMapPanel = ({
  model,
  onSettingsSave,
}: {
  model: TourOpsModel;
  onSettingsSave: () => void;
}) => {
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [mapboxError, setMapboxError] = useState<string | null>(null);
  const [mapboxLoading, setMapboxLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadToken = async () => {
      setMapboxLoading(true);
      setMapboxError(null);
      try {
        const { data, error } = await dataLayerClient.functions.invoke("get-mapbox-token");
        if (error) throw new Error(error.message);
        if (!data?.token) throw new Error("No se encontro el token de Mapbox.");
        if (!cancelled) setMapboxToken(data.token);
      } catch (err) {
        if (!cancelled) {
          setMapboxError(err instanceof Error ? err.message : "No se pudo cargar Mapbox.");
        }
      } finally {
        if (!cancelled) setMapboxLoading(false);
      }
    };

    loadToken();
    return () => {
      cancelled = true;
    };
  }, []);

  const mapTourData = useMemo(
    () => ({
      id: model.tour.id,
      name: model.tour.name,
      tour_settings: model.tour.settings,
      travel_plan: model.travelSegments.map((segment) => ({
        id: segment.id,
        fromDateId: segment.fromTourDateId,
        toDateId: segment.toTourDateId,
        fromTourDateId: segment.fromTourDateId,
        toTourDateId: segment.toTourDateId,
        fromType: segment.fromTourDateId ? "venue" : "home",
        toType: segment.toTourDateId ? "venue" : "home",
        transportType: segment.transportationType,
        transportation_type: segment.transportationType,
        departureTime: segment.departureTime,
        arrivalTime: segment.arrivalTime,
        fromLocation: segment.fromLocationId ? null : undefined,
        toLocation: segment.toLocationId ? null : undefined,
      })),
    }),
    [model],
  );

  const mapDates = useMemo(
    () =>
      model.dates.map((date) => {
        const location = date.location
          ? {
              id: date.location.id,
              name: date.venueName || date.location.name,
              venue_name: date.venueName || date.location.name,
              formatted_address: date.venueAddress || date.location.formattedAddress,
              address: date.venueAddress || date.location.formattedAddress,
              latitude: date.location.latitude,
              longitude: date.location.longitude,
            }
          : null;

        return {
          ...date,
          location,
          locations: location,
          call_time: date.program[0]?.rows[0]?.time ?? null,
        };
      }),
    [model],
  );

  const mapAccommodations = useMemo(
    () =>
      model.accommodations.map((hotel) => ({
        id: hotel.id,
        hotel_name: hotel.hotelName,
        hotel_address: hotel.hotelAddress,
        check_in_date: hotel.checkInDate,
        check_out_date: hotel.checkOutDate,
        rooms_booked: hotel.roomsBooked,
        latitude: hotel.latitude,
        longitude: hotel.longitude,
      })),
    [model],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <TourSettingsPanel
        tourId={model.tour.id}
        tourData={{ tour_settings: model.tour.settings }}
        canEdit
        onSave={onSettingsSave}
      />
      <div className="min-w-0">
        {mapboxLoading ? (
          <Card>
            <CardContent className="flex h-[360px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </CardContent>
          </Card>
        ) : mapboxError ? (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">{mapboxError}</CardContent>
          </Card>
        ) : mapboxToken ? (
          <TourMapViewMapbox
            tourData={mapTourData}
            tourDates={mapDates}
            accommodations={mapAccommodations}
            mapboxToken={mapboxToken}
          />
        ) : null}
      </div>
    </div>
  );
};

export function TourOpsManagementHub({ tourId, tourName }: TourOpsManagementHubProps) {
  const { data: model, isLoading, error, refetch } = useTourOps(tourId, "management");
  const mutations = useTourOpsMutations(tourId);
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TourOpsTimelineEvent | null>(null);
  const [travelDialogOpen, setTravelDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<TourOpsTravelSegment | null>(null);
  const [hotelDialogOpen, setHotelDialogOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<TourOpsAccommodation | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);

  useEffect(() => {
    if (!selectedDateId && model?.dates[0]?.id) {
      setSelectedDateId(model.dates[0].id);
    }
  }, [model, selectedDateId]);

  const selectedDate = useMemo(
    () => model?.dates.find((date) => date.id === selectedDateId) ?? null,
    [model, selectedDateId],
  );

  const contactsTourData = useMemo(
    () => ({
      tour_contacts: (model?.tour.contacts ?? []).map((contact) => ({
        id: contact.id,
        name: contact.name,
        role: contact.role ?? "",
        phone: contact.phone ?? "",
        email: contact.email ?? "",
        isPrimary: Boolean(contact.isPrimary),
        notes: contact.notes ?? "",
      })),
    }),
    [model?.tour.contacts],
  );

  if (isLoading) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error || !model) {
    return <div className="p-6 text-destructive">No se pudieron cargar las operaciones de gira.</div>;
  }

  const saveEvent = async (input: Partial<TourOpsTimelineEvent> & { tourId: string; date: string; title: string }) => {
    await mutations.saveEvent.mutateAsync(input);
    toast.success("Evento guardado");
  };

  const saveTravel = async (input: Partial<TourOpsTravelSegment> & { tourId: string }) => {
    await mutations.saveTravel.mutateAsync(input);
    toast.success("Viaje guardado");
  };

  const saveHotel = async (input: Partial<TourOpsAccommodation> & { tourId: string }) => {
    await mutations.saveHotel.mutateAsync(input);
    toast.success("Hotel guardado");
  };

  const syncHojaOps = async () => {
    const result = await mutations.syncHojaOps.mutateAsync(model);
    const total =
      result.insertedTravelSegments +
      result.insertedHojaTravelRows +
      result.insertedAccommodations +
      result.insertedHojaAccommodations;
    toast.success(
      total
        ? `Sincronizacion completada: ${total} cambios.`
        : "Hoja de ruta y operaciones ya estaban sincronizadas.",
    );
  };

  const statCards = [
    { label: "Fechas", value: model.stats.totalDates, Icon: Calendar },
    { label: "Venues", value: model.stats.venueCount, Icon: MapPin },
    { label: "Viajes", value: model.stats.travelSegments, Icon: Route },
    { label: "Docs", value: model.documents.length, Icon: FileText },
    { label: "Avisos", value: model.stats.healthWarnings, Icon: AlertTriangle },
  ];

  return (
    <div className="h-full min-h-0 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{tourName}</h2>
          <p className="text-sm text-muted-foreground">Centro de operaciones: programación, viajes, documentos y acceso externo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => generateTourOpsPdf(model, "management")}>
            <Download className="h-4 w-4 mr-2" />
            Tour book
          </Button>
          <Button variant="outline" onClick={() => setDocsOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Subir docs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {statCards.map(({ label, value, Icon }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {label}
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-1 text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="timeline">Cronograma</TabsTrigger>
          <TabsTrigger value="map"><MapIcon className="h-4 w-4 mr-1" />Mapa</TabsTrigger>
          <TabsTrigger value="travel">Viajes</TabsTrigger>
          <TabsTrigger value="hotels"><Hotel className="h-4 w-4 mr-1" />Hoteles</TabsTrigger>
          <TabsTrigger value="rooming"><Bed className="h-4 w-4 mr-1" />Rooming</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="h-4 w-4 mr-1" />Contactos</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="share">Externo</TabsTrigger>
          <TabsTrigger value="health">Avisos</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="m-0">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Fechas</CardTitle>
                <Button size="sm" onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" />Evento
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[56vh] pr-3">
                  <DateList dates={model.dates} selectedDateId={selectedDateId} onSelect={setSelectedDateId} />
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <DateDetail model={model} date={selectedDate} />

              <Card>
                <CardHeader><CardTitle className="text-base">Eventos adicionales</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {model.timelineEvents.length ? model.timelineEvents.map((event) => (
                    <div key={event.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium">{event.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {event.date} {event.startTime ? `- ${event.startTime}` : ""} · {event.eventType}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditingEvent(event); setEventDialogOpen(true); }}>Editar</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => mutations.removeEvent.mutate(event.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">Sin eventos adicionales.</div>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="map" className="m-0">
          <TourMapPanel model={model} onSettingsSave={() => void refetch()} />
        </TabsContent>

        <TabsContent value="travel" className="m-0">
          <Card>
            <CardHeader className="flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Plan de viajes</CardTitle>
                {model.tour.hasLegacyTravelPlan && (
                  <p className="text-sm text-amber-600">Este tour tiene travel_plan legacy pendiente de normalizar.</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Incluye viajes de operaciones y de hoja de ruta. La sincronizacion mantiene ambos lados alineados.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={syncHojaOps} disabled={mutations.syncHojaOps.isPending}>
                  {mutations.syncHojaOps.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Route className="h-4 w-4 mr-2" />}
                  Sincronizar hoja
                </Button>
                {model.tour.hasLegacyTravelPlan && (
                  <Button variant="outline" onClick={() => mutations.migrateTravel.mutate(model)}>
                    Migrar legacy
                  </Button>
                )}
                <Button onClick={() => { setEditingSegment(null); setTravelDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Viaje
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {model.travelSegments.length ? model.travelSegments.map((segment) => (
                <div key={segment.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-medium">{segment.fromLabel} {"->"} {segment.toLabel}</div>
                      <div className="text-sm text-muted-foreground">
                        {[segment.transportationType, formatTime(segment.departureTime), formatTime(segment.arrivalTime), segment.carrierName]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      {segment.routeNotes && <div className="mt-2 text-sm">{segment.routeNotes}</div>}
                      <Badge variant="outline" className="mt-2">{sourceLabel(segment.source)}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingSegment(segment); setTravelDialogOpen(true); }}>Editar</Button>
                      {segment.source === "normalized" && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => mutations.removeTravel.mutate(segment.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )) : <div className="text-sm text-muted-foreground">Sin viajes definidos.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hotels" className="m-0">
          <Card>
            <CardHeader className="flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Hoteles y alojamientos</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Incluye alojamientos de operaciones y hoja de ruta. Los cambios se sincronizan en ambos sentidos.
                </p>
              </div>
              <Button onClick={() => { setEditingHotel(null); setHotelDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Hotel
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {model.accommodations.length ? model.accommodations.map((hotel) => {
                const tourDate = model.dates.find((date) => date.id === hotel.tourDateId);
                return (
                  <div key={`${hotel.source}-${hotel.id}`} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{hotel.hotelName}</div>
                          <Badge variant="outline">{sourceLabel(hotel.source)}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {[tourDate ? formatDate(tourDate.date) : null, hotel.checkInDate, hotel.checkOutDate].filter(Boolean).join(" · ")}
                        </div>
                        {hotel.hotelAddress && <div className="mt-1 text-sm">{hotel.hotelAddress}</div>}
                        {hotel.confirmationNumber && <div className="mt-1 text-xs text-muted-foreground">Confirmacion: {hotel.confirmationNumber}</div>}
                        {hotel.roomsBooked != null && <div className="mt-1 text-xs text-muted-foreground">Habitaciones: {hotel.roomsBooked}</div>}
                        {hotel.notes && <div className="mt-2 text-sm">{hotel.notes}</div>}
                        {hotel.roomAllocation.length > 0 && (
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {hotel.roomAllocation.map((room, index) => (
                              <div key={room.id ?? index} className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                                <div className="font-medium">
                                  {[room.roomType || "Habitacion", room.roomNumber].filter(Boolean).join(" ")}
                                </div>
                                <div className="text-muted-foreground">{roomOccupants(room) || "Sin ocupantes"}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditingHotel(hotel); setHotelDialogOpen(true); }}>Editar</Button>
                        {!hotel.id.startsWith("hotel-info:") && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => mutations.removeHotel.mutate({ id: hotel.id, source: hotel.source })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }) : <div className="text-sm text-muted-foreground">Sin alojamientos definidos.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooming" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle>Rooming</CardTitle>
              <p className="text-sm text-muted-foreground">
                Habitaciones por fecha y hotel desde operaciones y hoja de ruta.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {model.accommodations.some((hotel) => hotel.roomAllocation.length > 0) ? (
                model.accommodations
                  .filter((hotel) => hotel.roomAllocation.length > 0)
                  .map((hotel) => {
                    const tourDate = model.dates.find((date) => date.id === hotel.tourDateId);
                    return (
                      <div key={`rooming-${hotel.source}-${hotel.id}`} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium">{hotel.hotelName}</div>
                              <Badge variant="outline">{sourceLabel(hotel.source)}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {[tourDate ? formatDate(tourDate.date) : null, hotel.checkInDate, hotel.checkOutDate].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => { setEditingHotel(hotel); setHotelDialogOpen(true); }}>Editar rooming</Button>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {hotel.roomAllocation.map((room, index) => (
                            <div key={room.id ?? index} className="rounded-md bg-muted/50 p-3 text-sm">
                              <div className="font-medium">
                                {[room.roomType || "Habitacion", room.roomNumber].filter(Boolean).join(" ")}
                              </div>
                              <div className="text-muted-foreground">{roomOccupants(room) || "Sin ocupantes"}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="text-sm text-muted-foreground">Sin rooming definido.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="m-0">
          <TourContactsManager
            tourId={model.tour.id}
            tourData={contactsTourData}
            canEdit
            onSave={() => void refetch()}
          />
        </TabsContent>

        <TabsContent value="documents" className="m-0">
          <Card>
            <CardHeader className="flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>Documentos y exportacion</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => generateTourOpsPdf(model, "technician")}>PDF equipo</Button>
                <Button variant="outline" onClick={() => generateTourOpsPdf(model, "guest")}>PDF externo</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {model.documents.length ? model.documents.map((document) => (
                <div key={document.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{document.fileName}</div>
                    <div className="text-xs text-muted-foreground">{document.visibleToTech ? "Visible técnicos" : "Interno"} · {document.visibleToGuest ? "Visible externo" : "No externo"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Externo</span>
                    <Switch
                      checked={document.visibleToGuest}
                      onCheckedChange={(visibleToGuest) => mutations.setGuestDocumentVisibility.mutate({ documentId: document.id, visibleToGuest })}
                    />
                  </div>
                </div>
              )) : <div className="text-sm text-muted-foreground">Sin documentos.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="share" className="m-0">
          <SharePanel model={model} />
        </TabsContent>

        <TabsContent value="health" className="m-0">
          <Card>
            <CardHeader><CardTitle>Avisos de planificacion</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {model.health.length ? model.health.map((issue) => (
                <div key={issue.id} className="flex gap-3 rounded-lg border p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div>
                    <div className="font-medium">{issue.label}</div>
                    <div className="text-sm text-muted-foreground">{issue.detail}</div>
                  </div>
                </div>
              )) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Sin avisos principales.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EventDialog
        model={model}
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        editingEvent={editingEvent}
        selectedDate={selectedDate}
        onSave={saveEvent}
      />
      <TravelDialog
        model={model}
        open={travelDialogOpen}
        onOpenChange={setTravelDialogOpen}
        editingSegment={editingSegment}
        onSave={saveTravel}
      />
      <HotelDialog
        model={model}
        open={hotelDialogOpen}
        onOpenChange={setHotelDialogOpen}
        editingHotel={editingHotel}
        selectedDate={selectedDate}
        onSave={saveHotel}
      />
      <TourDocumentsDialog open={docsOpen} onOpenChange={setDocsOpen} tourId={tourId} tourName={tourName} />
    </div>
  );
}
