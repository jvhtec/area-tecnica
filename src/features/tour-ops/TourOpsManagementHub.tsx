import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Route,
  Save,
  Share2,
  Trash2,
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
import { cn } from "@/lib/utils";
import type {
  TourGuestLink,
  TourOpsAllowedSections,
  TourOpsDate,
  TourOpsModel,
  TourOpsTimelineEvent,
  TourOpsTravelSegment,
} from "./types";
import { DEFAULT_TOUR_OPS_SECTIONS } from "./types";
import {
  useTourGuestLinkMutations,
  useTourGuestLinks,
  useTourOps,
  useTourOpsMutations,
} from "./useTourOps";
import { generateTourOpsPdf } from "./tourOpsPdf";

interface TourOpsManagementHubProps {
  tourId: string;
  tourName: string;
}

const eventTypeOptions = ["show", "rehearsal", "travel", "load_in", "show_call", "meeting", "day_off", "hotel", "note", "other"];
const transportOptions = ["bus", "van", "plane", "train", "ferry", "truck", "personal"];

const formatDate = (value: string) => format(new Date(value), "EEE d MMM yyyy", { locale: es });
const formatTime = (value?: string | null) => {
  if (!value) return "";
  if (value.includes("T")) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : format(date, "d MMM HH:mm", { locale: es });
  }
  return value.slice(0, 5);
};

const dateTimeInputValue = (value?: string | null) => {
  if (!value) return "";
  if (!value.includes("T")) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

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
            <Badge variant="outline" className="text-[10px]">OK</Badge>
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
              Day sheet
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
            <div className="text-xs uppercase text-muted-foreground">Crew</div>
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
          <CardHeader><CardTitle className="text-base">Crew y alojamiento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {date.crew.length ? date.crew.slice(0, 8).map((member) => (
                <div key={`${member.id}-${member.role}`} className="flex justify-between gap-3 rounded-md bg-muted/50 p-2 text-sm">
                  <span>{member.name}</span>
                  <span className="text-muted-foreground">{member.role || member.department}</span>
                </div>
              )) : <div className="text-sm text-muted-foreground">Sin crew confirmado.</div>}
            </div>
            <div className="border-t pt-3 space-y-2">
              {date.accommodations.length ? date.accommodations.map((hotel) => (
                <div key={hotel.id} className="text-sm">
                  <div className="font-medium">{hotel.hotelName}</div>
                  <div className="text-muted-foreground">{hotel.checkInDate} {"->"} {hotel.checkOutDate}</div>
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
    await onSave({
      id: editingSegment?.id,
      source: editingSegment?.source,
      tourId: model.tour.id,
      fromTourDateId: form.fromTourDateId || null,
      toTourDateId: form.toTourDateId || null,
      fromLocationId: model.dates.find((date) => date.id === form.fromTourDateId)?.location?.id ?? null,
      toLocationId: model.dates.find((date) => date.id === form.toTourDateId)?.location?.id ?? null,
      transportationType: form.transportationType,
      departureTime: form.departureTime || null,
      arrivalTime: form.arrivalTime || null,
      carrierName: form.carrierName || null,
      distanceKm: form.distanceKm ? Number(form.distanceKm) : null,
      estimatedDurationMinutes: form.estimatedDurationMinutes ? Number(form.estimatedDurationMinutes) : null,
      routeNotes: form.routeNotes || null,
      status: form.status,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingSegment ? "Editar viaje" : "Nuevo viaje"}</DialogTitle>
          <DialogDescription>Los viajes se guardan en tour_travel_segments.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Desde</Label>
              <Select value={form.fromTourDateId || "none"} onValueChange={(value) => setForm({ ...form, fromTourDateId: value === "none" ? "" : value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Base / externo</SelectItem>
                  {model.dates.map((date) => <SelectItem key={date.id} value={date.id}>{formatDate(date.date)} - {date.venueName || "TBC"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Select value={form.toTourDateId || "none"} onValueChange={(value) => setForm({ ...form, toTourDateId: value === "none" ? "" : value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Base / externo</SelectItem>
                  {model.dates.map((date) => <SelectItem key={date.id} value={date.id}>{formatDate(date.date)} - {date.venueName || "TBC"}</SelectItem>)}
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

const SharePanel = ({ model }: { model: TourOpsModel }) => {
  const { data: links = [], isLoading } = useTourGuestLinks(model.tour.id);
  const { createLink, revokeLink } = useTourGuestLinkMutations(model.tour.id);
  const [label, setLabel] = useState("External tour manager");
  const [expiresAt, setExpiresAt] = useState("");
  const [sections, setSections] = useState<TourOpsAllowedSections>(DEFAULT_TOUR_OPS_SECTIONS);
  const [lastToken, setLastToken] = useState<string | null>(null);

  const create = async () => {
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
    }
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
                <div key={link.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{link.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {link.expires_at ? `Caduca ${format(new Date(link.expires_at), "d MMM yyyy HH:mm", { locale: es })}` : "Sin caducidad"}
                    </div>
                    {link.revoked_at && <Badge variant="destructive" className="mt-1">Revocado</Badge>}
                  </div>
                  <div className="flex gap-2">
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

export function TourOpsManagementHub({ tourId, tourName }: TourOpsManagementHubProps) {
  const { data: model, isLoading, error } = useTourOps(tourId, "management");
  const mutations = useTourOpsMutations(tourId);
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TourOpsTimelineEvent | null>(null);
  const [travelDialogOpen, setTravelDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<TourOpsTravelSegment | null>(null);
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

  if (isLoading) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error || !model) {
    return <div className="p-6 text-destructive">No se pudo cargar Tour Ops.</div>;
  }

  const saveEvent = async (input: Partial<TourOpsTimelineEvent> & { tourId: string; date: string; title: string }) => {
    await mutations.saveEvent.mutateAsync(input);
    toast.success("Evento guardado");
  };

  const saveTravel = async (input: Partial<TourOpsTravelSegment> & { tourId: string }) => {
    await mutations.saveTravel.mutateAsync(input);
    toast.success("Viaje guardado");
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
          <p className="text-sm text-muted-foreground">Tour Ops Hub: programacion, viajes, documentos y acceso externo.</p>
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
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="travel">Viajes</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="share">Guest</TabsTrigger>
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

        <TabsContent value="travel" className="m-0">
          <Card>
            <CardHeader className="flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Plan de viajes</CardTitle>
                {model.tour.hasLegacyTravelPlan && (
                  <p className="text-sm text-amber-600">Este tour tiene travel_plan legacy pendiente de normalizar.</p>
                )}
              </div>
              <div className="flex gap-2">
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
                      {segment.source === "legacy" && <Badge variant="outline" className="mt-2">legacy</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingSegment(segment); setTravelDialogOpen(true); }}>Editar</Button>
                      {segment.source !== "legacy" && (
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

        <TabsContent value="documents" className="m-0">
          <Card>
            <CardHeader className="flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>Documentos y exportacion</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => generateTourOpsPdf(model, "technician")}>PDF tech</Button>
                <Button variant="outline" onClick={() => generateTourOpsPdf(model, "guest")}>PDF externo</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {model.documents.length ? model.documents.map((document) => (
                <div key={document.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{document.fileName}</div>
                    <div className="text-xs text-muted-foreground">{document.visibleToTech ? "Visible tech" : "Interno"} · {document.visibleToGuest ? "Visible guest" : "No guest"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Guest</span>
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
      <TourDocumentsDialog open={docsOpen} onOpenChange={setDocsOpen} tourId={tourId} tourName={tourName} />
    </div>
  );
}
