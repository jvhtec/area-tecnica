import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import {
  AlertTriangle,
  Bed,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
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
  X,
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
import { MultiDayScheduleBuilder } from "@/components/schedule/MultiDayScheduleBuilder";
import { cn } from "@/lib/utils";
import { dataLayerClient } from "@/services/dataLayerClient";
import { MADRID_TIMEZONE, utcToLocalInput } from "@/utils/timezoneUtils";
import type { ProgramDay as HojaProgramDay } from "@/types/hoja-de-ruta";
import type {
  TourGuestLink,
  TourOpsAllowedSections,
  TourOpsAccommodation,
  TourOpsDate,
  TourOpsModel,
  TourOpsProgramDay,
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
import {
  dateTimeInputValue,
  finiteNumberOrNull,
  formatDate,
  formatTime,
  guestLinkUrl,
  hasTourHomeBase,
  roomOccupants,
  sourceLabel,
  syncStatusLabel,
  syncStatusVariant,
  EVENT_TYPE_OPTIONS,
  TRANSPORT_OPTIONS,
} from "@/features/tour-ops/tourOpsManagementUtils";

export const EventDialog = ({
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
                <SelectContent>{EVENT_TYPE_OPTIONS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
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

export const TravelDialog = ({
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
                <SelectContent>{TRANSPORT_OPTIONS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
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

export const HotelDialog = ({
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
