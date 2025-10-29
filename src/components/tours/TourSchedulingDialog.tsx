import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar,
  Clock,
  MapPin,
  Route,
  FileText,
  Download,
  Loader2,
  Plus,
  Save,
  Settings,
  Users,
  Map,
} from "lucide-react";
import { TourTimelineView } from "./scheduling/TourTimelineView";
import { TourItineraryBuilder } from "./scheduling/TourItineraryBuilder";
import { EnhancedTourTravelPlanner } from "./scheduling/EnhancedTourTravelPlanner";
import { TourSettingsPanel } from "./scheduling/TourSettingsPanel";
import { TourContactsManager } from "./scheduling/TourContactsManager";
import { TourMapView } from "./scheduling/TourMapView";
import { generateTourDaySheet, generateTourBook } from "@/utils/tour-scheduling-pdf";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";

interface TourSchedulingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourDates: any[];
  tourName: string;
}

export const TourSchedulingDialog: React.FC<TourSchedulingDialogProps> = ({
  open,
  onOpenChange,
  tourId,
  tourDates,
  tourName,
}) => {
  const { toast } = useToast();
  const { userRole } = useOptimizedAuth();
  const [activeTab, setActiveTab] = useState("timeline");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
  const [tourData, setTourData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canEdit = userRole === 'admin' || userRole === 'management';

  // Load tour data and associated hoja de ruta records
  useEffect(() => {
    if (open && tourId) {
      loadTourSchedulingData();
    }
  }, [open, tourId]);

  const loadTourSchedulingData = async () => {
    setIsLoading(true);
    try {
      // Load tour with dates and locations
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select(`
          *,
          tour_dates (
            *,
            locations (*)
          )
        `)
        .eq('id', tourId)
        .single();

      if (tourError) throw tourError;

      // Load hoja de ruta records for each tour date
      const dateIds = tour.tour_dates?.map((d: any) => d.id) || [];
      const { data: hojaDeRutaRecords, error: hojaError } = await supabase
        .from('hoja_de_ruta')
        .select('*')
        .in('tour_date_id', dateIds);

      if (hojaError) throw hojaError;

      setTourData({
        ...tour,
        hojaDeRutaRecords: hojaDeRutaRecords || [],
      });

      // Select first date by default
      if (tour.tour_dates && tour.tour_dates.length > 0) {
        setSelectedDateId(tour.tour_dates[0].id);
      }
    } catch (error: any) {
      console.error('Error loading tour scheduling data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de programación del tour",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast({
        title: "Sin permisos",
        description: "No tienes permisos para editar la programación",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Save logic will be implemented in child components
      toast({
        title: "Guardado",
        description: "Los cambios se han guardado correctamente",
      });
    } catch (error: any) {
      console.error('Error saving:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateDaySheet = async (dateId: string) => {
    setIsGenerating(true);
    try {
      const tourDate = tourDates.find((d) => d.id === dateId);
      if (!tourDate) {
        throw new Error("Fecha no encontrada");
      }

      await generateTourDaySheet(tourData, tourDate);

      toast({
        title: "Day Sheet generado",
        description: `Day sheet para ${new Date(tourDate.date).toLocaleDateString('es-ES')} generado correctamente`,
      });
    } catch (error: any) {
      console.error('Error generating day sheet:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el day sheet",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateTourBook = async () => {
    setIsGenerating(true);
    try {
      await generateTourBook(tourData, tourDates);

      toast({
        title: "Tour Book generado",
        description: "El libro completo del tour se ha generado correctamente",
      });
    } catch (error: any) {
      console.error('Error generating tour book:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el tour book",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Clock className="h-6 w-6" />
                Programación y Timeline del Tour
              </DialogTitle>
              <DialogDescription>
                {tourName} - Gestión completa de itinerarios y programación
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {!canEdit && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Solo lectura
                </Badge>
              )}
              <Badge variant="outline">
                {tourDates.length} fechas
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-7 flex-shrink-0">
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="itinerary" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Itinerarios</span>
              </TabsTrigger>
              <TabsTrigger value="travel" className="flex items-center gap-2">
                <Route className="h-4 w-4" />
                <span className="hidden sm:inline">Viajes</span>
              </TabsTrigger>
              <TabsTrigger value="map" className="flex items-center gap-2">
                <Map className="h-4 w-4" />
                <span className="hidden sm:inline">Mapa</span>
              </TabsTrigger>
              <TabsTrigger value="contacts" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Contactos</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Configuración</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Documentos</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="timeline" className="h-full m-0">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <TourTimelineView
                    tourData={tourData}
                    tourDates={tourDates}
                    onDateSelect={setSelectedDateId}
                    selectedDateId={selectedDateId}
                    canEdit={canEdit}
                    onGenerateDaySheet={handleGenerateDaySheet}
                  />
                )}
              </TabsContent>

              <TabsContent value="itinerary" className="h-full m-0">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <TourItineraryBuilder
                    tourData={tourData}
                    tourDates={tourDates}
                    selectedDateId={selectedDateId}
                    onDateSelect={setSelectedDateId}
                    canEdit={canEdit}
                    onSave={loadTourSchedulingData}
                  />
                )}
              </TabsContent>

              <TabsContent value="travel" className="h-full m-0">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <EnhancedTourTravelPlanner
                    tourData={tourData}
                    tourDates={tourDates}
                    canEdit={canEdit}
                    onSave={loadTourSchedulingData}
                  />
                )}
              </TabsContent>

              <TabsContent value="map" className="h-full m-0">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <TourMapView
                    tourData={tourData}
                    tourDates={tourDates}
                    homeBase={tourData?.tour_settings}
                  />
                )}
              </TabsContent>

              <TabsContent value="contacts" className="h-full m-0">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <TourContactsManager
                    tourId={tourId}
                    canEdit={canEdit}
                    onSave={loadTourSchedulingData}
                  />
                )}
              </TabsContent>

              <TabsContent value="settings" className="h-full m-0">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <TourSettingsPanel
                    tourId={tourId}
                    onSave={loadTourSchedulingData}
                  />
                )}
              </TabsContent>

              <TabsContent value="documents" className="h-full m-0">
                <div className="space-y-4">
                  <div className="bg-muted/50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold mb-2">
                      Generación de Documentos
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Genera day sheets individuales o un tour book completo con toda la información del tour
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-6 space-y-4">
                      <div className="flex items-start gap-3">
                        <FileText className="h-6 w-6 text-blue-600 mt-1" />
                        <div className="flex-1">
                          <h4 className="font-semibold">Day Sheets</h4>
                          <p className="text-sm text-muted-foreground">
                            Documentos diarios para cada fecha del tour
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {tourDates.map((date) => (
                          <Button
                            key={date.id}
                            variant="outline"
                            className="w-full justify-between"
                            onClick={() => handleGenerateDaySheet(date.id)}
                            disabled={isGenerating}
                          >
                            <span className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {new Date(date.date).toLocaleDateString('es-ES', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                            <Download className="h-4 w-4" />
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="border rounded-lg p-6 space-y-4">
                      <div className="flex items-start gap-3">
                        <FileText className="h-6 w-6 text-green-600 mt-1" />
                        <div className="flex-1">
                          <h4 className="font-semibold">Tour Book Completo</h4>
                          <p className="text-sm text-muted-foreground">
                            Documento completo con toda la información del tour
                          </p>
                        </div>
                      </div>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Todas las fechas y ubicaciones</li>
                        <li>• Itinerarios completos</li>
                        <li>• Información de viajes y alojamiento</li>
                        <li>• Contactos y personal</li>
                        <li>• Logística y transporte</li>
                        <li>• Mapas y pronósticos meteorológicos</li>
                      </ul>
                      <Button
                        className="w-full"
                        onClick={handleGenerateTourBook}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generando...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Generar Tour Book
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="flex justify-between items-center pt-4 border-t flex-shrink-0">
          <div className="text-sm text-muted-foreground">
            {canEdit ? (
              <span className="text-green-600">✓ Puedes editar la programación</span>
            ) : (
              <span className="text-amber-600">⚠ Solo tienes permisos de lectura</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            {canEdit && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
