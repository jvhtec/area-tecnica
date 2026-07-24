import { MultiDayScheduleBuilder } from "@/components/schedule/MultiDayScheduleBuilder";
import { TourMapViewMapbox } from "@/components/tours/scheduling/TourMapViewMapbox";
import { TourSettingsPanel } from "@/components/tours/scheduling/TourSettingsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  formatDate,
  guestLinkUrl,
  hasTourHomeBase
} from "@/features/tour-ops/tourOpsManagementUtils";
import type {
  TourGuestLink,
  TourOpsAllowedSections,
  TourOpsDate,
  TourOpsModel,
  TourOpsProgramDay
} from "@/features/tour-ops/types";
import { DEFAULT_TOUR_OPS_SECTIONS } from "@/features/tour-ops/types";
import {
  useTourGuestLinkMutations,
  useTourGuestLinks
} from "@/features/tour-ops/useTourOps";
import { cn } from "@/lib/utils";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { ProgramDay as HojaProgramDay } from "@/types/hoja-de-ruta";
import { MADRID_TIMEZONE } from "@/utils/timezoneUtils";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import {
  Copy,
  ExternalLink,
  Loader2,
  Save,
  Send,
  Share2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const toHojaProgramDays = (
  program: TourOpsProgramDay[] | null | undefined,
  selectedDate: TourOpsDate | null,
): HojaProgramDay[] => {
  if (program?.length) {
    return program.map((day, index) => ({
      label: day.label || `Dia ${index + 1}`,
      date: day.date || undefined,
      rows: day.rows.map((row) => ({
        time: row.time || "",
        item: row.item || "",
        dept: row.dept || "",
        notes: row.notes || "",
      })),
    }));
  }

  return [{
    label: selectedDate ? formatDate(selectedDate.date) : "Dia 1",
    date: selectedDate?.date.slice(0, 10),
    rows: [],
  }];
};

const cleanProgramDays = (program: HojaProgramDay[]): TourOpsProgramDay[] =>
  program
    .map((day, index) => ({
      label: day.label?.trim() || `Dia ${index + 1}`,
      date: day.date || null,
      rows: (day.rows || [])
        .map((row) => ({
          time: row.time?.trim() || null,
          item: row.item?.trim() || null,
          dept: row.dept?.trim() || null,
          notes: row.notes?.trim() || null,
        }))
        .filter((row) => row.time || row.item || row.dept || row.notes),
    }))
    .filter((day) => day.label || day.rows.length > 0);

export const ProgramPanel = ({
  selectedDate,
  onSave,
  clipboard,
  onCopy,
  onPaste,
}: {
  selectedDate: TourOpsDate | null;
  onSave: (program: TourOpsProgramDay[]) => Promise<void>;
  clipboard: HojaProgramDay[] | null;
  onCopy: (program: HojaProgramDay[]) => void;
  onPaste: () => HojaProgramDay[] | null;
}) => {
  const [program, setProgram] = useState<HojaProgramDay[]>(() => toHojaProgramDays(selectedDate?.program, selectedDate));

  useEffect(() => {
    setProgram(toHojaProgramDays(selectedDate?.program, selectedDate));
  }, [selectedDate]);

  if (!selectedDate) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Selecciona una fecha para ver y editar el programa.
        </CardContent>
      </Card>
    );
  }

  const save = async () => {
    if (!selectedDate.hojaDeRutaId) {
      toast.error("Esta fecha no tiene Hoja de Ruta vinculada");
      return;
    }
    await onSave(cleanProgramDays(program));
    toast.success("Programa guardado en la Hoja de Ruta");
  };

  const paste = () => {
    const copied = onPaste();
    if (!copied) {
      toast.error("No hay programa copiado");
      return;
    }
    setProgram(copied.map((day) => ({ ...day, rows: day.rows.map((row) => ({ ...row })) })));
    toast.success("Programa pegado. Revisa y guarda los cambios.");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Programa</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edita el programa de {formatDate(selectedDate.date)} y guarda directamente en su Hoja de Ruta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onCopy(program)}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
            <Button variant="outline" disabled={!clipboard} onClick={paste}>
              Pegar
            </Button>
            <Button onClick={save} disabled={!selectedDate.hojaDeRutaId}>
              <Save className="h-4 w-4 mr-2" />
              Guardar programa
            </Button>
          </div>
        </CardHeader>
      </Card>

      <MultiDayScheduleBuilder
        value={program}
        onChange={setProgram}
        dayTitle="Programa"
        subtitle={selectedDate.venueName || selectedDate.location?.name || undefined}
      />
    </div>
  );
};

export const SharePanel = ({ model }: { model: TourOpsModel }) => {
  const { data: links = [], isLoading } = useTourGuestLinks(model.tour.id);
  const { createLink, revokeLink, setLinkAccess } = useTourGuestLinkMutations(model.tour.id);
  const [label, setLabel] = useState("External tour manager");
  const [expiresAt, setExpiresAt] = useState("");
  const [sections, setSections] = useState<TourOpsAllowedSections>(DEFAULT_TOUR_OPS_SECTIONS);
  const [accessLevel, setAccessLevel] = useState<"view" | "edit">("view");
  const [lastToken, setLastToken] = useState<string | null>(null);

  const create = async () => {
    try {
      const link = await createLink.mutateAsync({
        label,
        allowedSections: sections,
        accessLevel,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      if (link?.token) {
        const url = `${window.location.origin}/tour-share/${link.token}`;
        setLastToken(url);
        const copied = navigator.clipboard
          ? await navigator.clipboard.writeText(url).then(() => true).catch(() => false)
          : false;
        toast.success(copied ? "Link creado y copiado" : "Link creado");
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

  const linkAccessValue = (link: TourGuestLink): "disabled" | "view" | "edit" =>
    link.revoked_at ? "disabled" : link.access_level === "edit" ? "edit" : "view";

  const copyLink = async (url: string) => {
    await navigator.clipboard?.writeText(url);
    toast.success("Link copiado");
  };

  const shareLink = async (link: TourGuestLink, url: string) => {
    const title = `${model.tour.name} - ${link.label}`;
    if (navigator.share) {
      await navigator.share({ title, url }).catch((): void => undefined);
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
            <Label>Permiso</Label>
            <Select value={accessLevel} onValueChange={(value) => setAccessLevel(value as "view" | "edit")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Solo lectura</SelectItem>
                <SelectItem value="edit">Puede editar</SelectItem>
              </SelectContent>
            </Select>
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
                      {link.expires_at ? `Caduca ${formatInTimeZone(link.expires_at, MADRID_TIMEZONE, "d MMM yyyy HH:mm", { locale: es })}` : "Sin caducidad"}
                    </div>
                    {link.revoked_at && <Badge variant="destructive" className="mt-1">Revocado</Badge>}
                    {!link.revoked_at && (
                      <Badge variant={link.access_level === "edit" ? "default" : "outline"} className="mt-1">
                        {link.access_level === "edit" ? "Puede editar" : "Solo lectura"}
                      </Badge>
                    )}
                    {!link.token && !link.revoked_at && (
                      <div className="mt-1 text-xs text-amber-600">
                        Link antiguo sin token recuperable. Revocalo y crea uno nuevo para copiarlo.
                      </div>
                    )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Select
                        value={linkAccessValue(link)}
                        onValueChange={(value) =>
                          setLinkAccess.mutate({
                            linkId: link.id,
                            accessLevel: value as "disabled" | "view" | "edit",
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disabled">Desactivado</SelectItem>
                          <SelectItem value="view">Solo lectura</SelectItem>
                          <SelectItem value="edit">Puede editar</SelectItem>
                        </SelectContent>
                      </Select>
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

export const TourMapPanel = ({
  model,
  selectedDate,
  onDateSelect,
  onSettingsSave,
  showSettings = true,
}: {
  model: TourOpsModel;
  selectedDate: TourOpsDate | null;
  onDateSelect: (dateId: string) => void;
  onSettingsSave: () => void;
  showSettings?: boolean;
}) => {
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [mapboxError, setMapboxError] = useState<string | null>(null);
  const [mapboxLoading, setMapboxLoading] = useState(false);
  const homeBaseConfigured = hasTourHomeBase(model.tour.settings);

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
      travel_plan: model.travelSegments
        .filter((segment) =>
          selectedDate
            ? segment.fromTourDateId === selectedDate.id || segment.toTourDateId === selectedDate.id
            : true
        )
        .map((segment) => ({
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
          fromLocation: segment.fromLocationId ? (null as null) : undefined,
          toLocation: segment.toLocationId ? (null as null) : undefined,
        })),
    }),
    [model, selectedDate],
  );

  const mapDates = useMemo(
    () =>
      model.dates
        .filter((date) => (selectedDate ? date.id === selectedDate.id : true))
        .map((date) => {
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
    [model, selectedDate],
  );

  const mapAccommodations = useMemo(
    () =>
      model.accommodations
        .filter((hotel) => (selectedDate ? hotel.tourDateId === selectedDate.id : true))
        .map((hotel) => ({
          id: hotel.id,
          hotel_name: hotel.hotelName,
          hotel_address: hotel.hotelAddress,
          check_in_date: hotel.checkInDate,
          check_out_date: hotel.checkOutDate,
          rooms_booked: hotel.roomsBooked,
          latitude: hotel.latitude,
          longitude: hotel.longitude,
        })),
    [model, selectedDate],
  );

  return (
    <div className={cn("grid gap-4", showSettings ? "xl:grid-cols-[380px_1fr]" : "grid-cols-1")}>
      {showSettings && (
        <div className="space-y-3">
          {!homeBaseConfigured && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="p-3 text-sm text-amber-900 dark:text-amber-200">
                Configura la base de operaciones para mostrar rutas desde/hacia casa y calcular distancias.
              </CardContent>
            </Card>
          )}
          <TourSettingsPanel
            tourId={model.tour.id}
            tourData={{ tour_settings: model.tour.settings }}
            canEdit
            onSave={onSettingsSave}
          />
        </div>
      )}
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
            selectedTourDateId={selectedDate?.id ?? null}
            onTourDateSelect={onDateSelect}
          />
        ) : null}
      </div>
    </div>
  );
};
