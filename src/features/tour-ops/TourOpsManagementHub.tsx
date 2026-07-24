import { TourDocumentsDialog } from "@/components/tours/TourDocumentsDialog";
import { TourContactsManager } from "@/components/tours/scheduling/TourContactsManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActiveDateSelector, DateContextHeader, DateDetail, DateList } from "@/features/tour-ops/TourOpsDateOverview";
import { EventDialog, HotelDialog, TravelDialog } from "@/features/tour-ops/TourOpsEditorDialogs";
import { ProgramPanel, SharePanel, TourMapPanel } from "@/features/tour-ops/TourOpsManagementPanels";
import {
  formatDate,
  formatTime,
  hasTourHomeBase,
  roomOccupants,
  sourceLabel,
  syncStatusLabel,
  syncStatusVariant,
} from "@/features/tour-ops/tourOpsManagementUtils";
import { generateTourOpsPdf } from "@/features/tour-ops/tourOpsPdf";
import type {
  TourOpsAccommodation,
  TourOpsProgramDay,
  TourOpsTimelineEvent,
  TourOpsTravelSegment
} from "@/features/tour-ops/types";
import {
  useTourOps,
  useTourOpsMutations
} from "@/features/tour-ops/useTourOps";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { ProgramDay as HojaProgramDay } from "@/types/hoja-de-ruta";
import {
  AlertTriangle,
  Bed,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Hotel,
  Loader2,
  Map as MapIcon,
  MapPin,
  Plus,
  Route,
  Trash2,
  Users
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface TourOpsManagementHubProps {
  tourId: string;
  tourName: string;
}

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
  const [activeTab, setActiveTab] = useState("timeline");
  const [programClipboard, setProgramClipboard] = useState<HojaProgramDay[] | null>(null);

  const selectedDate = useMemo(
    () => model?.dates.find((date) => date.id === selectedDateId) ?? null,
    [model, selectedDateId],
  );

  const selectedTravelSegments = useMemo(
    () =>
      selectedDate
        ? model?.travelSegments.filter((segment) =>
            segment.fromTourDateId === selectedDate.id || segment.toTourDateId === selectedDate.id
          ) ?? []
        : model?.travelSegments ?? [],
    [model?.travelSegments, selectedDate],
  );

  const selectedAccommodations = useMemo(
    () =>
      selectedDate
        ? model?.accommodations.filter((hotel) => hotel.tourDateId === selectedDate.id) ?? []
        : model?.accommodations ?? [],
    [model?.accommodations, selectedDate],
  );

  const selectedRoomingHotels = useMemo(
    () => selectedAccommodations.filter((hotel) => hotel.roomAllocation.length > 0),
    [selectedAccommodations],
  );

  const selectedTimelineEvents = useMemo(
    () =>
      selectedDate
        ? model?.timelineEvents.filter((event) => event.date?.slice(0, 10) === selectedDate.date.slice(0, 10)) ?? []
        : model?.timelineEvents ?? [],
    [model?.timelineEvents, selectedDate],
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

  const homeBaseConfigured = useMemo(
    () => Boolean(model && hasTourHomeBase(model.tour.settings)),
    [model],
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

  const saveProgram = async (program: TourOpsProgramDay[]) => {
    if (!selectedDate?.hojaDeRutaId) {
      toast.error("Selecciona una fecha con Hoja de Ruta");
      return;
    }
    await mutations.saveProgram.mutateAsync({ hojaDeRutaId: selectedDate.hojaDeRutaId, program });
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

  const copyProgram = (program: HojaProgramDay[]) => {
    setProgramClipboard(program.map((day) => ({
      ...day,
      rows: day.rows.map((row) => ({ ...row })),
    })));
    toast.success("Programa copiado");
  };

  const pasteProgram = () => {
    if (!programClipboard) return null;
    return programClipboard.map((day) => ({
      ...day,
      rows: day.rows.map((row) => ({ ...row })),
    }));
  };

  const getDocumentUrl = async (document: { filePath: string }) => {
    const { data, error } = await dataLayerClient.storage
      .from("tour-documents")
      .createSignedUrl(document.filePath, 60 * 60);
    if (error || !data?.signedUrl) throw error || new Error("No se pudo generar la URL del documento");
    return data.signedUrl;
  };

  const openDocument = async (document: { filePath: string; fileName: string }) => {
    try {
      const url = await getDocumentUrl(document);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("No se pudo abrir el documento");
    }
  };

  const downloadDocument = async (document: { filePath: string; fileName: string }) => {
    try {
      const url = await getDocumentUrl(document);
      const link = globalThis.document.createElement("a");
      link.href = url;
      link.download = document.fileName;
      globalThis.document.body.appendChild(link);
      link.click();
      globalThis.document.body.removeChild(link);
    } catch {
      toast.error("No se pudo descargar el documento");
    }
  };

  const openSelectedHoja = () => {
    if (!selectedDate?.jobId) {
      toast.error("Selecciona una fecha con Hoja de Ruta vinculada");
      return;
    }
    window.open(`/hoja-de-ruta?jobId=${selectedDate.jobId}`, "_blank", "noopener,noreferrer");
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="timeline">Cronograma</TabsTrigger>
          <TabsTrigger value="map"><MapIcon className="h-4 w-4 mr-1" />Mapa</TabsTrigger>
          <TabsTrigger value="program">Programa</TabsTrigger>
          <TabsTrigger value="travel">Viajes</TabsTrigger>
          <TabsTrigger value="hotels"><Hotel className="h-4 w-4 mr-1" />Hoteles</TabsTrigger>
          <TabsTrigger value="rooming"><Bed className="h-4 w-4 mr-1" />Rooming</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="h-4 w-4 mr-1" />Contactos</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="share">Externo</TabsTrigger>
          <TabsTrigger value="health">Avisos</TabsTrigger>
        </TabsList>

        <ActiveDateSelector dates={model.dates} selectedDate={selectedDate} onSelect={setSelectedDateId} />
        <DateContextHeader
          model={model}
          selectedDate={selectedDate}
          onOpenHoja={openSelectedHoja}
          onAddTravel={() => {
            setEditingSegment(null);
            setTravelDialogOpen(true);
          }}
          onAddHotel={() => {
            setEditingHotel(null);
            setHotelDialogOpen(true);
          }}
          onOpenDocs={() => setDocsOpen(true)}
        />

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
              {selectedDate ? (
                <DateDetail model={model} date={selectedDate} />
              ) : (
                <TourMapPanel
                  model={model}
                  selectedDate={null}
                  onDateSelect={setSelectedDateId}
                  onSettingsSave={() => void refetch()}
                  showSettings={false}
                />
              )}

              <Card>
                <CardHeader><CardTitle className="text-base">Eventos adicionales</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {selectedTimelineEvents.length ? selectedTimelineEvents.map((event) => (
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
          <TourMapPanel
            model={model}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDateId}
            onSettingsSave={() => void refetch()}
          />
        </TabsContent>

        <TabsContent value="program" className="m-0">
          <ProgramPanel
            selectedDate={selectedDate}
            onSave={saveProgram}
            clipboard={programClipboard}
            onCopy={copyProgram}
            onPaste={pasteProgram}
          />
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
              {!homeBaseConfigured && (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 md:flex-row md:items-center md:justify-between">
                  <span>Base de operaciones pendiente. Configurala para rutas de salida/regreso y calculo de distancias.</span>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab("map")}>
                    Configurar base
                  </Button>
                </div>
              )}
              {selectedTravelSegments.length ? selectedTravelSegments.map((segment) => (
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
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{sourceLabel(segment.source)}</Badge>
                        <Badge variant={syncStatusVariant(segment.syncStatus)}>{syncStatusLabel(segment.syncStatus)}</Badge>
                      </div>
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
              )) : <div className="text-sm text-muted-foreground">Sin viajes definidos para la fecha seleccionada.</div>}
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
              {selectedAccommodations.length ? selectedAccommodations.map((hotel) => {
                const tourDate = model.dates.find((date) => date.id === hotel.tourDateId);
                return (
                  <div key={`${hotel.source}-${hotel.id}`} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{hotel.hotelName}</div>
                          <Badge variant="outline">{sourceLabel(hotel.source)}</Badge>
                          <Badge variant={syncStatusVariant(hotel.syncStatus)}>{syncStatusLabel(hotel.syncStatus)}</Badge>
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
              }) : <div className="text-sm text-muted-foreground">Sin alojamientos definidos para la fecha seleccionada.</div>}
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
              {selectedRoomingHotels.length ? (
                selectedRoomingHotels
                  .map((hotel) => {
                    const tourDate = model.dates.find((date) => date.id === hotel.tourDateId);
                    return (
                      <div key={`rooming-${hotel.source}-${hotel.id}`} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium">{hotel.hotelName}</div>
                              <Badge variant="outline">{sourceLabel(hotel.source)}</Badge>
                              <Badge variant={syncStatusVariant(hotel.syncStatus)}>{syncStatusLabel(hotel.syncStatus)}</Badge>
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
                <div className="text-sm text-muted-foreground">Sin rooming definido para la fecha seleccionada.</div>
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
                <Button
                  variant="outline"
                  disabled={!selectedDate}
                  onClick={() => selectedDate && generateTourOpsPdf(model, "management", { dateId: selectedDate.id })}
                >
                  Day sheet
                </Button>
                <Button variant="outline" onClick={() => setDocsOpen(true)}>Subir docs</Button>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openDocument(document)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadDocument(document)}>
                      <Download className="h-4 w-4 mr-1" />
                      Descargar
                    </Button>
                    <label className="flex items-center gap-2 rounded-md border px-2 py-1">
                      <span className="text-xs text-muted-foreground">Externo</span>
                      <Switch
                        checked={document.visibleToGuest}
                        onCheckedChange={(visibleToGuest) => mutations.setGuestDocumentVisibility.mutate({ documentId: document.id, visibleToGuest })}
                      />
                    </label>
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
            <CardHeader>
              <CardTitle>
                Avisos {selectedDate ? `- ${formatDate(selectedDate.date)}` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!selectedDate ? (
                <div className="text-sm text-muted-foreground">Selecciona una fecha para ver sus avisos.</div>
              ) : selectedDate.health.length ? selectedDate.health.map((issue) => (
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
                  Sin avisos para la fecha seleccionada.
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
