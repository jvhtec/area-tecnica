import { useEffect, useMemo, useState } from "react";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import {
  Bed,
  Calendar,
  ChevronDown,
  CloudSun,
  Download,
  FileText,
  MapPin,
  Navigation,
  Route,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { dataLayerClient } from "@/services/dataLayerClient";
import { cn } from "@/lib/utils";
import { formatInJobTimezone, MADRID_TIMEZONE } from "@/utils/timezoneUtils";
import { toast } from "sonner";
import type { TourOpsDate, TourOpsDocument, TourOpsModel, TourOpsProjection } from "@/features/tour-ops/types";
import { generateTourOpsPdf } from "@/features/tour-ops/tourOpsPdf";

interface TourOpsMobileItineraryProps {
  model: TourOpsModel;
  projection: TourOpsProjection;
  shareToken?: string;
  className?: string;
}

const dateOnlyAsMadridNoon = (value: string) => (value.includes("T") ? value : `${value}T12:00:00`);
const madridDateKey = (value: string) =>
  value.includes("T") ? formatInJobTimezone(value, "yyyy-MM-dd", MADRID_TIMEZONE) : value.slice(0, 10);

const formatDate = (value: string) =>
  formatInTimeZone(dateOnlyAsMadridNoon(value), MADRID_TIMEZONE, "EEE d MMM", { locale: es });

const formatTime = (value?: string | null) => {
  if (!value) return "";
  if (value.includes("T")) {
    return formatInTimeZone(value, MADRID_TIMEZONE, "HH:mm", { locale: es });
  }
  return value.slice(0, 5);
};

const openTourDocument = async (document: TourOpsDocument, shareToken?: string) => {
  try {
    if (shareToken) {
      const { data, error } = await dataLayerClient.functions.invoke("tour-guest-document-url", {
        body: { token: shareToken, documentId: document.id },
      });
      if (error || !data?.signedUrl) throw error || new Error("No signed URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const { data, error } = await dataLayerClient.storage
      .from("tour-documents")
      .createSignedUrl(document.filePath, 300);
    if (error || !data?.signedUrl) throw error || new Error("No signed URL");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    console.error("Unable to open tour document", error);
    toast.error("No se pudo abrir el documento");
  }
};

const getNextDate = (dates: TourOpsDate[]) => {
  const todayKey = formatInJobTimezone(new Date(), "yyyy-MM-dd", MADRID_TIMEZONE);
  return dates.find((date) => madridDateKey(date.date) >= todayKey) ?? dates[0] ?? null;
};

const roomOccupants = (room: TourOpsDate["accommodations"][number]["roomAllocation"][number]) =>
  [room.staffMember1Name || room.staffMember1Id, room.staffMember2Name || room.staffMember2Id]
    .filter(Boolean)
    .join(" / ");

const DateDetail = ({
  date,
  projection,
  model,
}: {
  date: TourOpsDate;
  projection: TourOpsProjection;
  model: TourOpsModel;
}) => (
  <div className="space-y-3">
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0">
            <div className="font-medium">{date.venueName || date.location?.name || "Venue por confirmar"}</div>
            <div className="text-sm text-muted-foreground break-words">
              {date.venueAddress || date.location?.formattedAddress || "Dirección pendiente"}
            </div>
          </div>
        </div>

        {date.type && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{date.type}</Badge>
            {date.rehearsalDays ? <Badge variant="secondary">{date.rehearsalDays} días</Badge> : null}
            {date.isTourPackOnly ? <Badge variant="secondary">Solo pack</Badge> : null}
          </div>
        )}
      </CardContent>
    </Card>

    <Collapsible defaultOpen>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Programa
              </span>
              <ChevronDown className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {date.program.length ? (
              <div className="space-y-3">
                {date.program.map((day, index) => (
                  <div key={`${day.label}-${index}`} className="space-y-2">
                    {day.label && <div className="text-xs font-semibold text-muted-foreground uppercase">{day.label}</div>}
                    {day.rows.map((row, rowIndex) => (
                      <div key={rowIndex} className="grid grid-cols-[56px_1fr] gap-3 text-sm">
                        <div className="font-mono text-muted-foreground">{row.time || "--:--"}</div>
                        <div>
                          <div className="font-medium">{row.item || "Actividad"}</div>
                          <div className="text-xs text-muted-foreground">
                            {[row.dept, row.notes].filter(Boolean).join(" - ")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Programa pendiente.</div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>

    <Collapsible defaultOpen={date.travelIn.length + date.travelOut.length > 0}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Route className="h-4 w-4" />
                Viajes
              </span>
              <ChevronDown className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {[...date.travelIn, ...date.travelOut].length ? (
              [...date.travelIn, ...date.travelOut].map((segment) => (
                <div key={segment.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-muted-foreground" />
                    {segment.fromLabel} {"->"} {segment.toLabel}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {[segment.transportationType, formatTime(segment.departureTime), formatTime(segment.arrivalTime)]
                      .filter(Boolean)
                      .join(" - ")}
                  </div>
                  {segment.routeNotes && <div className="text-xs mt-2">{segment.routeNotes}</div>}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Sin viajes definidos.</div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>

    {projection !== "guest" && (
      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer py-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Equipo
                </span>
                <ChevronDown className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-2">
              {date.crew.length ? (
                date.crew.map((member) => (
                  <div key={`${member.id}-${member.role}`} className="flex justify-between gap-3 rounded-lg bg-muted/50 p-2 text-sm">
                    <span>{member.name}</span>
                    <span className="text-muted-foreground">{member.role || member.department || "Equipo"}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">Sin equipo confirmado.</div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    )}

    <Collapsible defaultOpen={date.accommodations.length > 0}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bed className="h-4 w-4" />
                Alojamiento
              </span>
              <ChevronDown className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {date.accommodations.length ? (
              date.accommodations.map((hotel) => (
                <div key={hotel.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{hotel.hotelName}</div>
                  <div className="text-xs text-muted-foreground">{hotel.hotelAddress}</div>
                  <div className="text-xs mt-1">
                    {[hotel.checkInDate, hotel.checkOutDate].filter(Boolean).join(" -> ")}
                  </div>
                  {hotel.roomAllocation.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {hotel.roomAllocation.map((room, index) => (
                        <div key={room.id ?? index} className="rounded bg-muted/50 px-2 py-1 text-xs">
                          {[room.roomType || "Habitacion", room.roomNumber, roomOccupants(room)].filter(Boolean).join(" · ")}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Sin alojamiento definido.</div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>

    {date.weather ? (
      <Card>
        <CardContent className="p-4 text-sm flex items-center gap-2">
          <CloudSun className="h-4 w-4 text-muted-foreground" />
          Previsión disponible en hoja de ruta.
        </CardContent>
      </Card>
    ) : null}

    {model.tour.contacts.length > 0 && (
      <Collapsible defaultOpen={projection === "guest"}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer py-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Contactos
                </span>
                <ChevronDown className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-2">
              {model.tour.contacts.map((contact, index) => (
                <div key={contact.id ?? index} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{contact.name}</div>
                  <div className="text-xs text-muted-foreground">{[contact.role, contact.company].filter(Boolean).join(" · ")}</div>
                  <div className="mt-1 text-xs">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</div>
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    )}
  </div>
);

export function TourOpsMobileItinerary({ model, projection, shareToken, className }: TourOpsMobileItineraryProps) {
  const nextDate = getNextDate(model.dates);
  const [filter, setFilter] = useState("next");
  const [selectedDateId, setSelectedDateId] = useState(nextDate?.id ?? model.dates[0]?.id ?? null);

  const visibleDates = useMemo(() => {
    const todayKey = formatInJobTimezone(new Date(), "yyyy-MM-dd", MADRID_TIMEZONE);
    if (filter === "all") return model.dates;
    if (filter === "today") return model.dates.filter((date) => madridDateKey(date.date) === todayKey);
    return nextDate ? [nextDate] : [];
  }, [filter, model.dates, nextDate]);

  useEffect(() => {
    if (!visibleDates.some((date) => date.id === selectedDateId)) {
      setSelectedDateId(visibleDates[0]?.id ?? null);
    }
  }, [selectedDateId, visibleDates]);

  const selectedDate = visibleDates.find((date) => date.id === selectedDateId) ?? visibleDates[0] ?? null;

  return (
    <div className={cn("space-y-4", className)}>
      {nextDate && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Próxima llamada</div>
            <div className="mt-1 flex items-end justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{nextDate.venueName || nextDate.location?.name || "Venue por confirmar"}</div>
                <div className="text-sm text-muted-foreground">{formatDate(nextDate.date)}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setSelectedDateId(nextDate.id)}>
                Ver
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="today">Hoy</TabsTrigger>
            <TabsTrigger value="next">Próxima</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="icon" variant="outline" onClick={() => generateTourOpsPdf(model, projection)}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {visibleDates.map((date) => (
          <button
            key={date.id}
            type="button"
            onClick={() => setSelectedDateId(date.id)}
            className={cn(
              "min-w-[112px] rounded-lg border px-3 py-2 text-left",
              selectedDate?.id === date.id ? "border-primary bg-primary/10" : "bg-background",
            )}
          >
            <div className="text-xs text-muted-foreground">{formatDate(date.date)}</div>
            <div className="truncate text-sm font-medium">{date.venueName || date.location?.name || "Pendiente"}</div>
          </button>
        ))}
      </div>

      {selectedDate ? (
        <DateDetail date={selectedDate} projection={projection} model={model} />
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No hay fechas para este filtro.
          </CardContent>
        </Card>
      )}

      {model.documents.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {model.documents.map((document) => (
              <Button
                key={document.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => openTourDocument(document, shareToken)}
              >
                <FileText className="h-4 w-4 mr-2" />
                <span className="truncate">{document.fileName}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
