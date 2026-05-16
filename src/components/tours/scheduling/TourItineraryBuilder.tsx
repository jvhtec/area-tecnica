import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { dataLayerClient } from "@/services/dataLayerClient";
import {
  Calendar,
  Clock,
  Save,
  Loader2,
  FileText,
  Plus,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MultiDayScheduleBuilder } from "@/components/schedule/MultiDayScheduleBuilder";
import { ProgramDay } from "@/types/hoja-de-ruta";
import type { Database, Json } from "@/integrations/supabase/types";

type HojaDeRutaRow = Database["public"]["Tables"]["hoja_de_ruta"]["Row"];
type HojaDeRutaInsert = Database["public"]["Tables"]["hoja_de_ruta"]["Insert"];

interface TourDateOption {
  id: string;
  date: string;
  location?: {
    name?: string | null;
  } | null;
}

interface TourItineraryData {
  hojaDeRutaRecords?: Array<{ tour_date_id: string | null }>;
}

interface TourItineraryBuilderProps {
  tourData: TourItineraryData | null | undefined;
  tourDates: TourDateOption[];
  selectedDateId: string | null;
  onDateSelect: (dateId: string) => void;
  canEdit: boolean;
  onSave: () => void;
}

const defaultProgramSchedule = (): ProgramDay[] => [{ label: 'Día 1', rows: [] }];

const isProgramSchedule = (value: unknown): value is ProgramDay[] =>
  Array.isArray(value) && value.every((day) => {
    if (!day || typeof day !== "object") return false;
    const maybeDay = day as Partial<ProgramDay>;
    return Array.isArray(maybeDay.rows);
  });

export const TourItineraryBuilder: React.FC<TourItineraryBuilderProps> = ({
  tourData,
  tourDates,
  selectedDateId,
  onDateSelect,
  canEdit,
  onSave,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hojaDeRuta, setHojaDeRuta] = useState<HojaDeRutaRow | null>(null);
  const [programSchedule, setProgramSchedule] = useState<ProgramDay[]>(defaultProgramSchedule);

  const sortedDates = [...tourDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const selectedDate = sortedDates.find(d => d.id === selectedDateId);

  // Load hoja de ruta for selected date
  useEffect(() => {
    if (selectedDateId) {
      loadHojaDeRuta();
    }
  }, [selectedDateId]);

  const loadHojaDeRuta = async () => {
    if (!selectedDateId) return;

    setLoading(true);
    try {
      // First, try to find existing hoja de ruta for this tour date
      const { data: existingHoja, error: fetchError } = await dataLayerClient.from('hoja_de_ruta')
        .select('*')
        .eq('tour_date_id', selectedDateId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingHoja) {
        setHojaDeRuta(existingHoja);

        // Load program schedule
        if (isProgramSchedule(existingHoja.program_schedule_json)) {
          setProgramSchedule(existingHoja.program_schedule_json);
        } else {
          setProgramSchedule(defaultProgramSchedule());
        }
      } else {
        // No hoja de ruta exists yet
        setHojaDeRuta(null);
        setProgramSchedule(defaultProgramSchedule());
      }
    } catch (error: unknown) {
      console.error('Error loading hoja de ruta:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el itinerario",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedDateId || !canEdit) return;

    setSaving(true);
    try {
      // Get the job associated with this tour date
      const { data: job, error: jobError } = await dataLayerClient.from('jobs')
        .select('id')
        .eq('tour_date_id', selectedDateId)
        .maybeSingle();

      if (jobError && jobError.code !== 'PGRST116') {
        throw jobError;
      }

      const hojaData: HojaDeRutaInsert = {
        job_id: job?.id || null,
        tour_date_id: selectedDateId,
        program_schedule_json: programSchedule as unknown as Json,
        status: 'draft',
        last_modified: new Date().toISOString(),
      };

      if (hojaDeRuta?.id) {
        // Update existing
        const { error: updateError } = await dataLayerClient.from('hoja_de_ruta')
          .update(hojaData)
          .eq('id', hojaDeRuta.id);

        if (updateError) throw updateError;
      } else {
        // Create new
        const { data: newHoja, error: insertError } = await dataLayerClient.from('hoja_de_ruta')
          .insert(hojaData)
          .select()
          .single();

        if (insertError) throw insertError;
        setHojaDeRuta(newHoja);
      }

      toast({
        title: "Guardado",
        description: "El itinerario se ha guardado correctamente",
      });

      onSave();
    } catch (error: unknown) {
      console.error('Error saving itinerary:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el itinerario",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateForAllDates = async () => {
    if (!canEdit) return;

    setSaving(true);
    try {
      const promises = sortedDates.map(async (date) => {
        // Check if hoja de ruta exists
        const result = await dataLayerClient.from('hoja_de_ruta')
          .select('id')
          .eq('tour_date_id', date.id)
          .maybeSingle();

        if (result.error) throw result.error;
        
        const { data: existing } = result;

        if (existing) return; // Skip if already exists

        // Get job
        const { data: job, error: jobError } = await dataLayerClient.from('jobs')
          .select('id')
          .eq('tour_date_id', date.id)
          .maybeSingle();

        if (jobError) throw jobError;

        // Create hoja de ruta with empty schedule
        const { error: insertError } = await dataLayerClient.from('hoja_de_ruta')
          .insert({
            job_id: job?.id || null,
            tour_date_id: date.id,
            program_schedule_json: defaultProgramSchedule() as unknown as Json,
            status: 'draft',
          });

        if (insertError) throw insertError;
      });

      await Promise.all(promises);

      toast({
        title: "Itinerarios creados",
        description: `Se han creado itinerarios para todas las fechas del tour`,
      });

      onSave();
      loadHojaDeRuta();
    } catch (error: unknown) {
      console.error('Error creating itineraries:', error);
      toast({
        title: "Error",
        description: "No se pudieron crear los itinerarios",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
      {/* Date Selector */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Fechas del Tour
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="p-4 space-y-2">
                {sortedDates.map((date, index) => {
                  const isSelected = selectedDateId === date.id;
                  const hasItinerary = tourData?.hojaDeRutaRecords?.some(
                    (h) => h.tour_date_id === date.id
                  );

                  return (
                    <button
                      key={date.id}
                      onClick={() => onDateSelect(date.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 hover:bg-muted border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">Día {index + 1}</span>
                        {hasItinerary && (
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            Creado
                          </Badge>
                        )}
                      </div>
                      <div className="font-semibold text-sm mb-1">
                        {format(new Date(date.date), "d MMM", { locale: es })}
                      </div>
                      {date.location && (
                        <div className="flex items-start gap-1 text-xs opacity-90">
                          <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{date.location.name}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleCreateForAllDates}
          disabled={!canEdit || saving}
        >
          <Plus className="h-4 w-4 mr-2" />
          Crear para todas
        </Button>
      </div>

      {/* Itinerary Builder */}
      <div className="lg:col-span-3 space-y-4">
        {selectedDate ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Itinerario -{" "}
                      {format(new Date(selectedDate.date), "EEEE, d 'de' MMMM yyyy", {
                        locale: es,
                      })}
                    </CardTitle>
                    {selectedDate.location && (
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {selectedDate.location.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hojaDeRuta && (
                      <Badge variant="outline">
                        {hojaDeRuta.status === 'draft' ? 'Borrador' :
                         hojaDeRuta.status === 'review' ? 'En Revisión' :
                         hojaDeRuta.status === 'approved' ? 'Aprobado' : 'Final'}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadHojaDeRuta}
                      disabled={loading}
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    {canEdit && (
                      <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Guardar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <MultiDayScheduleBuilder
                value={programSchedule}
                onChange={setProgramSchedule}
                dayTitle="Programa del Día"
                subtitle={`Itinerario para ${format(new Date(selectedDate.date), "d 'de' MMMM", { locale: es })}`}
              />
            )}

            {!canEdit && (
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-300">
                <strong>Modo solo lectura:</strong> No tienes permisos para editar el itinerario.
                Solo usuarios con rol de administrador o management pueden hacer cambios.
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                Selecciona una fecha
              </h3>
              <p className="text-muted-foreground">
                Elige una fecha del tour para crear o editar su itinerario
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
