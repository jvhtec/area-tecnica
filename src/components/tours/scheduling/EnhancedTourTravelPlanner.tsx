import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Route,
  MapPin,
  Clock,
  Car,
  Plane,
  Train,
  Home,
  AlertTriangle,
  Save,
  Loader2,
  Navigation,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

interface EnhancedTourTravelPlannerProps {
  tourData: any;
  tourDates: any[];
  canEdit: boolean;
  onSave: () => void;
}

interface TravelSegment {
  id: string;
  type: 'venue_to_venue' | 'home_to_venue' | 'venue_to_home';
  fromDateId?: string;
  toDateId?: string;
  fromLocation: string;
  toLocation: string;
  fromCoordinates?: { lat: number; lng: number };
  toCoordinates?: { lat: number; lng: number };
  transportType: 'bus' | 'plane' | 'train' | 'van' | 'personal';
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  distance: number;
  duration: number;
  notes: string;
  crewReturnsHome?: boolean;
}

const calculateDistance = (
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * Math.PI / 180) *
    Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

export const EnhancedTourTravelPlanner: React.FC<EnhancedTourTravelPlannerProps> = ({
  tourData,
  tourDates,
  canEdit,
  onSave,
}) => {
  const { toast } = useToast();
  const [travelSegments, setTravelSegments] = useState<TravelSegment[]>([]);
  const [saving, setSaving] = useState(false);
  const [homeBase, setHomeBase] = useState<any>(null);

  const sortedDates = [...tourDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  useEffect(() => {
    loadTourSettings();
  }, [tourData]);

  useEffect(() => {
    if (homeBase) {
      generateTravelSegments();
    }
  }, [sortedDates, homeBase]);

  const loadTourSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('tours')
        .select('tour_settings')
        .eq('id', tourData.id)
        .single();

      if (error) throw error;

      if (data?.tour_settings) {
        setHomeBase(data.tour_settings);
      }
    } catch (error) {
      console.error('Error loading tour settings:', error);
    }
  };

  const generateTravelSegments = () => {
    const segments: TravelSegment[] = [];
    const GAP_THRESHOLD = 2; // Days - if gap is 2+ days, crew returns home

    if (sortedDates.length === 0) return;

    // First segment: Home to first venue
    const firstDate = sortedDates[0];
    if (homeBase?.home_base_coordinates && firstDate.location?.latitude) {
      const distance = calculateDistance(
        homeBase.home_base_coordinates,
        { lat: firstDate.location.latitude, lng: firstDate.location.longitude }
      );

      segments.push({
        id: `home-to-${firstDate.id}`,
        type: 'home_to_venue',
        toDateId: firstDate.id,
        fromLocation: homeBase.home_base_name || 'Base',
        toLocation: firstDate.location.name,
        fromCoordinates: homeBase.home_base_coordinates,
        toCoordinates: { lat: firstDate.location.latitude, lng: firstDate.location.longitude },
        transportType: 'bus',
        departureDate: firstDate.date,
        departureTime: homeBase.default_departure_time || '09:00',
        arrivalDate: firstDate.date,
        arrivalTime: '',
        distance,
        duration: Math.round(distance / 80 * 60),
        notes: '',
      });
    }

    // Segments between venues (with gap detection)
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const currentDate = sortedDates[i];
      const nextDate = sortedDates[i + 1];

      const dayGap = differenceInDays(
        new Date(nextDate.date),
        new Date(currentDate.date)
      );

      if (dayGap >= GAP_THRESHOLD && homeBase?.home_base_coordinates) {
        // Gap detected - add return home and departure again

        // Return to home
        if (currentDate.location?.latitude) {
          const distanceToHome = calculateDistance(
            { lat: currentDate.location.latitude, lng: currentDate.location.longitude },
            homeBase.home_base_coordinates
          );

          segments.push({
            id: `${currentDate.id}-to-home`,
            type: 'venue_to_home',
            fromDateId: currentDate.id,
            fromLocation: currentDate.location.name,
            toLocation: homeBase.home_base_name || 'Base',
            fromCoordinates: { lat: currentDate.location.latitude, lng: currentDate.location.longitude },
            toCoordinates: homeBase.home_base_coordinates,
            transportType: 'bus',
            departureDate: currentDate.date,
            departureTime: homeBase.default_return_time || '18:00',
            arrivalDate: currentDate.date,
            arrivalTime: '',
            distance: distanceToHome,
            duration: Math.round(distanceToHome / 80 * 60),
            notes: `Regreso a base - ${dayGap} días de descanso`,
            crewReturnsHome: true,
          });
        }

        // Departure from home to next venue
        if (nextDate.location?.latitude) {
          const distanceFromHome = calculateDistance(
            homeBase.home_base_coordinates,
            { lat: nextDate.location.latitude, lng: nextDate.location.longitude }
          );

          segments.push({
            id: `home-to-${nextDate.id}`,
            type: 'home_to_venue',
            toDateId: nextDate.id,
            fromLocation: homeBase.home_base_name || 'Base',
            toLocation: nextDate.location.name,
            fromCoordinates: homeBase.home_base_coordinates,
            toCoordinates: { lat: nextDate.location.latitude, lng: nextDate.location.longitude },
            transportType: 'bus',
            departureDate: nextDate.date,
            departureTime: homeBase.default_departure_time || '09:00',
            arrivalDate: nextDate.date,
            arrivalTime: '',
            distance: distanceFromHome,
            duration: Math.round(distanceFromHome / 80 * 60),
            notes: `Salida después de ${dayGap} días de descanso`,
          });
        }
      } else if (dayGap === 1) {
        // Consecutive or next-day - direct venue to venue
        if (currentDate.location?.latitude && nextDate.location?.latitude) {
          const distance = calculateDistance(
            { lat: currentDate.location.latitude, lng: currentDate.location.longitude },
            { lat: nextDate.location.latitude, lng: nextDate.location.longitude }
          );

          segments.push({
            id: `${currentDate.id}-to-${nextDate.id}`,
            type: 'venue_to_venue',
            fromDateId: currentDate.id,
            toDateId: nextDate.id,
            fromLocation: currentDate.location.name,
            toLocation: nextDate.location.name,
            fromCoordinates: { lat: currentDate.location.latitude, lng: currentDate.location.longitude },
            toCoordinates: { lat: nextDate.location.latitude, lng: nextDate.location.longitude },
            transportType: 'bus',
            departureDate: currentDate.date,
            departureTime: '20:00',
            arrivalDate: nextDate.date,
            arrivalTime: '08:00',
            distance,
            duration: Math.round(distance / 80 * 60),
            notes: 'Viaje nocturno entre fechas consecutivas',
          });
        }
      }
    }

    // Last segment: Final venue to home
    const lastDate = sortedDates[sortedDates.length - 1];
    if (homeBase?.home_base_coordinates && lastDate.location?.latitude) {
      const distance = calculateDistance(
        { lat: lastDate.location.latitude, lng: lastDate.location.longitude },
        homeBase.home_base_coordinates
      );

      segments.push({
        id: `${lastDate.id}-to-home`,
        type: 'venue_to_home',
        fromDateId: lastDate.id,
        fromLocation: lastDate.location.name,
        toLocation: homeBase.home_base_name || 'Base',
        fromCoordinates: { lat: lastDate.location.latitude, lng: lastDate.location.longitude },
        toCoordinates: homeBase.home_base_coordinates,
        transportType: 'bus',
        departureDate: lastDate.date,
        departureTime: homeBase.default_return_time || '18:00',
        arrivalDate: lastDate.date,
        arrivalTime: '',
        distance,
        duration: Math.round(distance / 80 * 60),
        notes: 'Regreso final a base',
      });
    }

    setTravelSegments(segments);
  };

  const handleSegmentUpdate = (id: string, field: string, value: any) => {
    setTravelSegments(prev =>
      prev.map(seg => seg.id === id ? { ...seg, [field]: value } : seg)
    );
  };

  const handleSave = async () => {
    if (!canEdit) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tours')
        .update({ travel_plan: travelSegments })
        .eq('id', tourData.id);

      if (error) throw error;

      toast({
        title: "Guardado",
        description: "Plan de viajes guardado correctamente",
      });

      onSave();
    } catch (error: any) {
      console.error('Error saving travel plan:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el plan de viajes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getTotalDistance = () => {
    return travelSegments.reduce((sum, seg) => sum + seg.distance, 0);
  };

  const getTotalDuration = () => {
    return travelSegments.reduce((sum, seg) => sum + seg.duration, 0);
  };

  const getSegmentIcon = (type: string) => {
    switch (type) {
      case 'home_to_venue':
        return <Navigation className="h-4 w-4 text-green-600" />;
      case 'venue_to_home':
        return <Home className="h-4 w-4 text-blue-600" />;
      default:
        return <Route className="h-4 w-4 text-orange-600" />;
    }
  };

  const getSegmentBadge = (type: string) => {
    switch (type) {
      case 'home_to_venue':
        return <Badge variant="outline" className="bg-green-50">Desde Base</Badge>;
      case 'venue_to_home':
        return <Badge variant="outline" className="bg-blue-50">Regreso a Base</Badge>;
      default:
        return <Badge variant="outline" className="bg-orange-50">Entre Venues</Badge>;
    }
  };

  if (!homeBase?.home_base_coordinates) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <h3 className="text-lg font-semibold mb-2">
            Configura la Base de Operaciones
          </h3>
          <p className="text-muted-foreground mb-4">
            Para planificar los viajes del tour, primero debes configurar la ubicación de la base desde donde el equipo parte y regresa.
          </p>
          <p className="text-sm text-muted-foreground">
            Ve a la pestaña "Configuración" para establecer la base de operaciones.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Route className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{travelSegments.length}</div>
                <div className="text-xs text-muted-foreground">Tramos totales</div>
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

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Home className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {travelSegments.filter(s => s.crewReturnsHome).length}
                </div>
                <div className="text-xs text-muted-foreground">Regresos a base</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Travel Segments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Plan de Viajes del Tour
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Los tramos incluyen viajes desde/hacia la base y entre venues considerando gaps de descanso
              </p>
            </div>
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
              {travelSegments.map((segment, index) => (
                <Card key={segment.id} className={`border-2 ${segment.crewReturnsHome ? 'border-blue-300 bg-blue-50/30' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getSegmentIcon(segment.type)}
                        <Badge variant="outline">Tramo {index + 1}</Badge>
                        {getSegmentBadge(segment.type)}
                        {segment.crewReturnsHome && (
                          <Badge variant="outline" className="bg-blue-100 border-blue-300">
                            <Home className="h-3 w-3 mr-1" />
                            Regreso a casa
                          </Badge>
                        )}
                      </div>
                      <Badge variant="secondary">
                        {segment.distance} km · {Math.round(segment.duration / 60)}h {segment.duration % 60}m
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Route Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Desde</Label>
                        <div className="flex items-start gap-2 mt-1">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="text-sm font-medium">{segment.fromLocation}</div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Hasta</Label>
                        <div className="flex items-start gap-2 mt-1">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="text-sm font-medium">{segment.toLocation}</div>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor={`dep-date-${segment.id}`}>Fecha Salida</Label>
                        <Input
                          id={`dep-date-${segment.id}`}
                          type="date"
                          value={segment.departureDate}
                          onChange={(e) => handleSegmentUpdate(segment.id, 'departureDate', e.target.value)}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`dep-time-${segment.id}`}>Hora Salida</Label>
                        <Input
                          id={`dep-time-${segment.id}`}
                          type="time"
                          value={segment.departureTime}
                          onChange={(e) => handleSegmentUpdate(segment.id, 'departureTime', e.target.value)}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`arr-date-${segment.id}`}>Fecha Llegada</Label>
                        <Input
                          id={`arr-date-${segment.id}`}
                          type="date"
                          value={segment.arrivalDate}
                          onChange={(e) => handleSegmentUpdate(segment.id, 'arrivalDate', e.target.value)}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`arr-time-${segment.id}`}>Hora Llegada</Label>
                        <Input
                          id={`arr-time-${segment.id}`}
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
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>Modo solo lectura:</strong> No tienes permisos para editar la planificación de viajes.
        </div>
      )}
    </div>
  );
};
