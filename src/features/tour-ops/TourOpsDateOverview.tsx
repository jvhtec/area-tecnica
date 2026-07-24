import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatDate,
  formatTime,
  roomOccupants,
  sourceLabel,
  syncStatusLabel,
  syncStatusVariant
} from "@/features/tour-ops/tourOpsManagementUtils";
import { generateTourOpsPdf } from "@/features/tour-ops/tourOpsPdf";
import type {
  TourOpsDate,
  TourOpsModel
} from "@/features/tour-ops/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Hotel,
  MapPin,
  Route,
  X
} from "lucide-react";

export const DateList = ({
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
          <span className="line-clamp-2">{date.venueName || date.location?.name || "Recinto pendiente"}</span>
        </div>
      </button>
    ))}
  </div>
);

export const ActiveDateSelector = ({
  dates,
  selectedDate,
  onSelect,
}: {
  dates: TourOpsDate[];
  selectedDate: TourOpsDate | null;
  onSelect: (id: string | null) => void;
}) => {
  const selectedIndex = selectedDate ? dates.findIndex((date) => date.id === selectedDate.id) : -1;
  const previousDate = selectedIndex > 0 ? dates[selectedIndex - 1] : null;
  const nextDate = selectedIndex === -1 ? dates[0] ?? null : selectedIndex < dates.length - 1 ? dates[selectedIndex + 1] : null;

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Fecha activa</div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="truncate font-medium">
              {selectedDate ? formatDate(selectedDate.date) : "Vista general del tour"}
            </div>
            {selectedDate?.health.length ? (
              <Badge variant="destructive" className="shrink-0 text-[10px]">{selectedDate.health.length} avisos</Badge>
            ) : selectedDate ? (
              <Badge variant="outline" className="shrink-0 text-[10px]">Completo</Badge>
            ) : null}
          </div>
          <div className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="line-clamp-2">
              {selectedDate
                ? selectedDate.venueName || selectedDate.location?.name || "Recinto pendiente"
                : `${dates.length} fechas en la gira`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-[40px_1fr_40px_auto] gap-2 md:min-w-[520px]">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!previousDate}
            onClick={() => previousDate && onSelect(previousDate.id)}
            aria-label="Fecha anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={selectedDate?.id ?? "__tour_overview__"} onValueChange={(value) => onSelect(value === "__tour_overview__" ? null : value)}>
            <SelectTrigger className="min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__tour_overview__">Vista general del tour</SelectItem>
              {dates.map((date, index) => (
                <SelectItem key={date.id} value={date.id}>
                  Dia {index + 1} · {formatDate(date.date)} · {date.venueName || date.location?.name || "Pendiente"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!nextDate}
            onClick={() => nextDate && onSelect(nextDate.id)}
            aria-label="Fecha siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => onSelect(null)} aria-label="Ver tour completo">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const DateContextHeader = ({
  model,
  selectedDate,
  onOpenHoja,
  onAddTravel,
  onAddHotel,
  onOpenDocs,
}: {
  model: TourOpsModel;
  selectedDate: TourOpsDate | null;
  onOpenHoja: () => void;
  onAddTravel: () => void;
  onAddHotel: () => void;
  onOpenDocs: () => void;
}) => {
  if (!selectedDate) return null;

  const travelCount = selectedDate.travelIn.length + selectedDate.travelOut.length;
  const hotelCount = selectedDate.accommodations.length;
  const roomCount = selectedDate.accommodations.reduce((total, hotel) => total + hotel.roomAllocation.length, 0);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={selectedDate.jobId ? "default" : "outline"}>
              {selectedDate.jobId ? "Trabajo vinculado" : "Sin trabajo"}
            </Badge>
            <Badge variant={selectedDate.hojaDeRutaId ? "default" : "outline"}>
              {selectedDate.hojaDeRutaId ? "Hoja vinculada" : "Sin hoja para la fecha"}
            </Badge>
            <Badge variant={travelCount ? "secondary" : "outline"}>{travelCount} viajes</Badge>
            <Badge variant={hotelCount ? "secondary" : "outline"}>{hotelCount} hoteles</Badge>
            <Badge variant={roomCount ? "secondary" : "outline"}>{roomCount} habitaciones</Badge>
            {selectedDate.health.length ? (
              <Badge variant="destructive">{selectedDate.health.length} avisos</Badge>
            ) : (
              <Badge variant="outline">Completo</Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedDate.venueName || selectedDate.location?.name || "Recinto pendiente"}
            {selectedDate.jobTitle ? ` · ${selectedDate.jobTitle}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => generateTourOpsPdf(model, "management", { dateId: selectedDate.id })}>
            <Download className="h-4 w-4 mr-1" />
            Hoja del día
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenHoja} disabled={!selectedDate.jobId}>
            <ExternalLink className="h-4 w-4 mr-1" />
            Abrir Hoja
          </Button>
          <Button variant="outline" size="sm" onClick={onAddTravel}>
            <Route className="h-4 w-4 mr-1" />
            Viaje
          </Button>
          <Button variant="outline" size="sm" onClick={onAddHotel}>
            <Hotel className="h-4 w-4 mr-1" />
            Hotel
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenDocs}>
            <FileText className="h-4 w-4 mr-1" />
            Docs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const DateDetail = ({ model, date }: { model: TourOpsModel; date: TourOpsDate | null }) => {
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
                {date.venueName || date.location?.name || "Recinto pendiente"}
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
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Programa</CardTitle>
                <p className="text-xs text-muted-foreground">Resumen desde Hoja de Ruta. Edita en la pestaña Programa.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!date.jobId}
                onClick={() => date.jobId && window.open(`/hoja-de-ruta?jobId=${date.jobId}`, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir Hoja
              </Button>
            </div>
          </CardHeader>
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
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{sourceLabel(segment.source)}</Badge>
                    <Badge variant={syncStatusVariant(segment.syncStatus)}>{syncStatusLabel(segment.syncStatus)}</Badge>
                  </div>
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
                    <Badge variant={syncStatusVariant(hotel.syncStatus)}>{syncStatusLabel(hotel.syncStatus)}</Badge>
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

        <Card>
          <CardHeader><CardTitle className="text-base">Contactos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {model.tour.contacts.length ? model.tour.contacts.slice(0, 8).map((contact, index) => (
              <div key={contact.id ?? index} className="rounded-md border p-3 text-sm">
                <div className="font-medium">{contact.name}</div>
                <div className="text-xs text-muted-foreground">{[contact.role, contact.company].filter(Boolean).join(" · ")}</div>
                <div className="mt-1 text-xs">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</div>
              </div>
            )) : (
              <div className="text-sm text-muted-foreground">Sin contactos de tour definidos.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Documentos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {model.documents.length ? model.documents.slice(0, 6).map((document) => (
              <div key={document.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{document.fileName}</div>
                  <div className="text-xs text-muted-foreground">{document.visibleToTech ? "Visible técnicos" : "Interno"}</div>
                </div>
                <Badge variant={document.visibleToGuest ? "secondary" : "outline"}>
                  {document.visibleToGuest ? "Externo" : "No externo"}
                </Badge>
              </div>
            )) : (
              <div className="text-sm text-muted-foreground">Sin documentos para esta gira.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
