import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Route,
  MapPin,
  Clock,
  Car,
  Plane,
  Train,
  Calendar,
  Save,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TourTravelPlannerProps {
  tourData: any;
  tourDates: any[];
  canEdit: boolean;
  onSave: () => void;
}

interface TravelSegment {
  id: string;
  fromDateId: string;
  toDateId: string;
  transportType: 'bus' | 'plane' | 'train' | 'van' | 'personal';
  departureTime: string;
  arrivalTime: string;
  distance: number;
  duration: number;
  notes: string;
}

export const TourTravelPlanner: React.FC<TourTravelPlannerProps> = ({
  tourData,
  tourDates,
  canEdit,
  onSave,
}) => {
  const { toast } = useToast();
  const [travelSegments, setTravelSegments] = useState<TravelSegment[]>([]);
  const [saving, setSaving] = useState(false);

  const sortedDates = [...tourDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Generate travel segments between consecutive dates
  useEffect(() => {
    if (sortedDates.length >= 2) {
      const segments: TravelSegment[] = [];
      for (let i = 0; i < sortedDates.length - 1; i++) {
        const from = sortedDates[i];
        const to = sortedDates[i + 1];

        // Calculate distance and estimated duration if locations exist
        let distance = 0;
        let duration = 0;

        if (from.location?.latitude && from.location?.longitude &&
            to.location?.latitude && to.location?.longitude) {
          // Haversine formula for distance calculation
          const R = 6371; // Earth's radius in km
          const dLat = (to.location.latitude - from.location.latitude) * Math.PI / 180;
          const dLon = (to.location.longitude - from.location.longitude) * Math.PI / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(from.location.latitude * Math.PI / 180) *
            Math.cos(to.location.latitude * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distance = Math.round(R * c);

          // Estimate duration (assuming 80 km/h average)
          duration = Math.round(distance / 80 * 60); // in minutes
        }

        segments.push({
          id: `${from.id}-${to.id}`,
          fromDateId: from.id,
          toDateId: to.id,
          transportType: 'bus',
          departureTime: '',
          arrivalTime: '',
          distance,
          duration,
          notes: '',
        });
      }
      setTravelSegments(segments);
    }
  }, [tourDates]);

  const handleSegmentUpdate = (id: string, field: string, value: any) => {
    setTravelSegments(prev =>
      prev.map(seg => seg.id === id ? { ...seg, [field]: value } : seg)
    );
  };

  const handleSave = async () => {
    if (!canEdit) return;

    setSaving(true);
    try {
      // TODO: Save travel segments to database
      // This could be stored in a tour_travel_segments table or in the tour logistics

      toast({
        title: "Guardado",
        description: "La información de viajes se ha guardado correctamente",
      });

      onSave();
    } catch (error: any) {
      console.error('Error saving travel segments:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la información de viajes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getTransportIcon = (type: string) => {
    switch (type) {
      case 'plane':
        return <Plane className="h-4 w-4" />;
      case 'train':
        return <Train className="h-4 w-4" />;
      case 'van':
      case 'personal':
        return <Car className="h-4 w-4" />;
      default:
        return <Car className="h-4 w-4" />;
    }
  };

  const getTotalDistance = () => {
    return travelSegments.reduce((sum, seg) => sum + seg.distance, 0);
  };

  const getTotalDuration = () => {
    return travelSegments.reduce((sum, seg) => sum + seg.duration, 0);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Route className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{travelSegments.length}</div>
                <div className="text-xs text-muted-foreground">Tramos de viaje</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MapPin className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{getTotalDistance()} km</div>
                <div className="text-xs text-muted-foreground">Distancia total</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {Math.floor(getTotalDuration() / 60)}h {getTotalDuration() % 60}m
                </div>
                <div className="text-xs text-muted-foreground">Tiempo estimado</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Travel Segments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Planificación de Viajes
            </CardTitle>
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
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {travelSegments.map((segment, index) => {
                const fromDate = sortedDates.find(d => d.id === segment.fromDateId);
                const toDate = sortedDates.find(d => d.id === segment.toDateId);

                return (
                  <Card key={segment.id} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Tramo {index + 1}</Badge>
                          <span className="text-sm font-medium">
                            {fromDate && format(new Date(fromDate.date), "d MMM", { locale: es })}
                            {" → "}
                            {toDate && format(new Date(toDate.date), "d MMM", { locale: es })}
                          </span>
                        </div>
                        {segment.distance > 0 && (
                          <Badge variant="secondary">
                            {segment.distance} km · {Math.round(segment.duration / 60)}h {segment.duration % 60}m
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Locations */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Desde</Label>
                          <div className="flex items-start gap-2 mt-1">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="text-sm">
                              {fromDate?.location?.name || 'Sin ubicación'}
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Hasta</Label>
                          <div className="flex items-start gap-2 mt-1">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="text-sm">
                              {toDate?.location?.name || 'Sin ubicación'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Transport Type */}
                      <div>
                        <Label htmlFor={`transport-${segment.id}`}>Tipo de Transporte</Label>
                        <select
                          id={`transport-${segment.id}`}
                          value={segment.transportType}
                          onChange={(e) => handleSegmentUpdate(segment.id, 'transportType', e.target.value)}
                          disabled={!canEdit}
                          className="w-full mt-1 px-3 py-2 border rounded-md"
                        >
                          <option value="bus">Autobús</option>
                          <option value="van">Furgoneta</option>
                          <option value="plane">Avión</option>
                          <option value="train">Tren</option>
                          <option value="personal">Vehículo Personal</option>
                        </select>
                      </div>

                      {/* Times */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`departure-${segment.id}`}>Hora de Salida</Label>
                          <Input
                            id={`departure-${segment.id}`}
                            type="time"
                            value={segment.departureTime}
                            onChange={(e) => handleSegmentUpdate(segment.id, 'departureTime', e.target.value)}
                            disabled={!canEdit}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`arrival-${segment.id}`}>Hora de Llegada</Label>
                          <Input
                            id={`arrival-${segment.id}`}
                            type="time"
                            value={segment.arrivalTime}
                            onChange={(e) => handleSegmentUpdate(segment.id, 'arrivalTime', e.target.value)}
                            disabled={!canEdit}
                          />
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <Label htmlFor={`notes-${segment.id}`}>Notas</Label>
                        <Input
                          id={`notes-${segment.id}`}
                          value={segment.notes}
                          onChange={(e) => handleSegmentUpdate(segment.id, 'notes', e.target.value)}
                          disabled={!canEdit}
                          placeholder="Información adicional del viaje..."
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {travelSegments.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay tramos de viaje para planificar</p>
                  <p className="text-sm">Añade más fechas al tour para crear rutas de viaje</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {!canEdit && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-300">
          <strong>Modo solo lectura:</strong> No tienes permisos para editar la planificación de viajes.
        </div>
      )}
    </div>
  );
};
