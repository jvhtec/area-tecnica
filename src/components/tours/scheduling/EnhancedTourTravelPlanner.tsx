import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Route,
  MapPin,
  Clock,
  Car,
  Plane,
  Train,
  Calendar,
  Save,
  Home,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EnhancedTourTravelPlannerProps {
  tourId: string;
  tourData: any;
  tourDates: any[];
  canEdit: boolean;
  onSave: () => void;
}

interface TravelSegment {
  id: string;
  type: "home_to_venue" | "venue_to_venue" | "venue_to_home" | "home_return";
  fromType: "home" | "venue";
  toType: "home" | "venue";
  fromDateId?: string;
  toDateId?: string;
  fromLocation?: any;
  toLocation?: any;
  transportType: "bus" | "plane" | "train" | "van" | "personal";
  departureTime: string;
  arrivalTime: string;
  distance: number;
  duration: number;
  notes: string;
  isGapReturn?: boolean;
  gapDays?: number;
}

export const EnhancedTourTravelPlanner: React.FC<
  EnhancedTourTravelPlannerProps
> = ({ tourId, tourData, tourDates, canEdit, onSave }) => {
  const { toast } = useToast();
  const [travelPlan, setTravelPlan] = useState<TravelSegment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const sortedDates = [...tourDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const homeBase = tourData?.tour_settings?.homeBase;
  const defaultDepartureTime = tourData?.tour_settings?.defaultDepartureTime || "08:00";
  const defaultReturnTime = tourData?.tour_settings?.defaultReturnTime || "18:00";

  useEffect(() => {
    if (Array.isArray(tourData?.travel_plan) && tourData.travel_plan.length > 0) {
      setTravelPlan(tourData.travel_plan);
    } else if (homeBase && sortedDates.length > 0) {
      // Auto-generate initial travel plan when none saved
      generateIntelligentTravelPlan();
    }
  }, [tourData, tourDates]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const generateIntelligentTravelPlan = () => {
    if (!homeBase || sortedDates.length === 0) {
      toast({
        title: "Configuración incompleta",
        description: "Configura la base de operaciones primero",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    const segments: TravelSegment[] = [];

    try {
      // 1. Travel from home to the first date that has coordinates
      const firstDate = sortedDates.find(d => d.location?.latitude != null && d.location?.longitude != null);
      const firstLoc = firstDate?.location;
      if (firstDate && firstLoc) {
        const distance = calculateDistance(
          homeBase.latitude,
          homeBase.longitude,
          firstLoc.latitude,
          firstLoc.longitude
        );

        segments.push({
          id: `home-to-${firstDate.id}`,
          type: "home_to_venue",
          fromType: "home",
          toType: "venue",
          toDateId: firstDate.id,
          toLocation: firstLoc,
          transportType: "bus",
          departureTime: defaultDepartureTime,
          arrivalTime: "",
          distance,
          duration: Math.round((distance / 80) * 60), // Assuming 80 km/h
          notes: "Salida desde la base de operaciones",
        });
      }

      // 2. Travel between venues with gap detection
      for (let i = 0; i < sortedDates.length - 1; i++) {
        const currentDate = sortedDates[i];
        const nextDate = sortedDates[i + 1];

        const currentLocation = currentDate.location;
        const nextLocation = nextDate.location;

        if (
          currentLocation?.latitude == null ||
          currentLocation?.longitude == null ||
          nextLocation?.latitude == null ||
          nextLocation?.longitude == null
        ) {
          continue;
        }

        const dayGap = differenceInDays(
          new Date(nextDate.date),
          new Date(currentDate.date)
        );

        // Gap of 2+ days: Return home and then travel to next venue
        if (dayGap >= 2) {
          // Return to home
          const distanceToHome = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            homeBase.latitude,
            homeBase.longitude
          );

          segments.push({
            id: `${currentDate.id}-to-home`,
            type: "venue_to_home",
            fromType: "venue",
            toType: "home",
            fromDateId: currentDate.id,
            fromLocation: currentLocation,
            transportType: "bus",
            departureTime: defaultReturnTime,
            arrivalTime: "",
            distance: distanceToHome,
            duration: Math.round((distanceToHome / 80) * 60),
            notes: `Regreso a casa (${dayGap} días de descanso)`,
            isGapReturn: true,
            gapDays: dayGap,
          });

          // Travel from home to next venue
          const distanceFromHome = calculateDistance(
            homeBase.latitude,
            homeBase.longitude,
            nextLocation.latitude,
            nextLocation.longitude
          );

          segments.push({
            id: `home-to-${nextDate.id}`,
            type: "home_to_venue",
            fromType: "home",
            toType: "venue",
            toDateId: nextDate.id,
            toLocation: nextLocation,
            transportType: "bus",
            departureTime: defaultDepartureTime,
            arrivalTime: "",
            distance: distanceFromHome,
            duration: Math.round((distanceFromHome / 80) * 60),
            notes: `Salida desde casa después de ${dayGap} días`,
          });
        } else {
          // Consecutive dates: Direct travel between venues
          const distance = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            nextLocation.latitude,
            nextLocation.longitude
          );

          segments.push({
            id: `${currentDate.id}-to-${nextDate.id}`,
            type: "venue_to_venue",
            fromType: "venue",
            toType: "venue",
            fromDateId: currentDate.id,
            toDateId: nextDate.id,
            fromLocation: currentLocation,
            toLocation: nextLocation,
            transportType: "bus",
            departureTime: "",
            arrivalTime: "",
            distance,
            duration: Math.round((distance / 80) * 60),
            notes: "Viaje directo entre venues",
          });
        }
      }

      // 3. Return home from the last date that has coordinates
      const lastDate = [...sortedDates].reverse().find(d => d.location?.latitude != null && d.location?.longitude != null);
      const lastLoc = lastDate?.location;
      if (lastDate && lastLoc) {
        const distance = calculateDistance(
          lastLoc.latitude,
          lastLoc.longitude,
          homeBase.latitude,
          homeBase.longitude
        );

        segments.push({
          id: `${lastDate.id}-to-home-final`,
          type: "venue_to_home",
          fromType: "venue",
          toType: "home",
          fromDateId: lastDate.id,
          fromLocation: lastLoc,
          transportType: "bus",
          departureTime: defaultReturnTime,
          arrivalTime: "",
          distance,
          duration: Math.round((distance / 80) * 60),
          notes: "Regreso final a la base",
        });
      }

      setTravelPlan(segments);

      toast({
        title: "Plan de viajes generado",
        description: `Se generaron ${segments.length} segmentos de viaje con detección inteligente de descansos`,
      });
    } catch (error: any) {
      console.error("Error generating travel plan:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el plan de viajes",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSegmentUpdate = (id: string, field: string, value: any) => {
    setTravelPlan((prev) =>
      prev.map((seg) => (seg.id === id ? { ...seg, [field]: value } : seg))
    );
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast({
        title: "Sin permisos",
        description: "No tienes permisos para editar el plan de viajes",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("tours")
        .update({ travel_plan: travelPlan })
        .eq("id", tourId);

      if (error) throw error;

      toast({
        title: "Guardado",
        description: "El plan de viajes se ha guardado correctamente",
      });

      onSave();
    } catch (error: any) {
      console.error("Error saving travel plan:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el plan de viajes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getTransportIcon = (type: string) => {
    switch (type) {
      case "plane":
        return <Plane className="h-4 w-4" />;
      case "train":
        return <Train className="h-4 w-4" />;
      default:
        return <Car className="h-4 w-4" />;
    }
  };

  const getSegmentTitle = (segment: TravelSegment) => {
    if (segment.type === "home_to_venue") {
      return "🏠 → 📍 Base a Venue";
    } else if (segment.type === "venue_to_home") {
      return "📍 → 🏠 Venue a Base";
    } else if (segment.type === "venue_to_venue") {
      return "📍 → 📍 Entre Venues";
    }
    return "Viaje";
  };

  const getTotalDistance = () => {
    return travelPlan.reduce((sum, seg) => sum + seg.distance, 0);
  };

  const getTotalDuration = () => {
    return travelPlan.reduce((sum, seg) => sum + seg.duration, 0);
  };

  const getGapCount = () => {
    return travelPlan.filter((seg) => seg.isGapReturn).length;
  };

  if (!homeBase) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          Configura la Base de Operaciones
        </h3>
        <p className="text-muted-foreground max-w-md">
          Para utilizar el planificador de viajes inteligente, primero debes
          configurar la base de operaciones en la pestaña de Configuración
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Plan de Viajes Inteligente
            </CardTitle>
            {canEdit && (
              <Button onClick={generateIntelligentTravelPlan} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  "Regenerar Plan"
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">
                Total Segmentos
              </div>
              <div className="text-2xl font-bold">{travelPlan.length}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">
                Distancia Total
              </div>
              <div className="text-2xl font-bold">{getTotalDistance()} km</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">
                Tiempo Total
              </div>
              <div className="text-2xl font-bold">
                {Math.round(getTotalDuration() / 60)}h
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">
                Regresos a Casa
              </div>
              <div className="text-2xl font-bold">{getGapCount()}</div>
            </div>
          </div>

          {travelPlan.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Route className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay plan de viajes generado</p>
              <p className="text-sm mt-1">
                Haz clic en "Regenerar Plan" para crear uno automáticamente
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {travelPlan.map((segment, index) => (
                  <Card key={segment.id} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                          {getTransportIcon(segment.transportType)}
                        </div>

                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">
                              {getSegmentTitle(segment)}
                            </h4>
                            {segment.isGapReturn && (
                              <Badge variant="default" className="bg-amber-500">
                                {segment.gapDays} días de descanso
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Desde: </span>
                              <span className="font-medium">
                                {segment.fromType === "home"
                                  ? homeBase.name
                                  : segment.fromLocation?.name || "Venue"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Hasta: </span>
                              <span className="font-medium">
                                {segment.toType === "home"
                                  ? homeBase.name
                                  : segment.toLocation?.name || "Venue"}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Transporte</Label>
                              <Select
                                value={segment.transportType}
                                onValueChange={(value) =>
                                  handleSegmentUpdate(segment.id, "transportType", value)
                                }
                                disabled={!canEdit}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="bus">Bus</SelectItem>
                                  <SelectItem value="van">Van</SelectItem>
                                  <SelectItem value="personal">Personal</SelectItem>
                                  <SelectItem value="plane">Avión</SelectItem>
                                  <SelectItem value="train">Tren</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Salida</Label>
                              <Input
                                type="time"
                                value={segment.departureTime}
                                onChange={(e) =>
                                  handleSegmentUpdate(
                                    segment.id,
                                    "departureTime",
                                    e.target.value
                                  )
                                }
                                disabled={!canEdit}
                                className="h-8"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Llegada</Label>
                              <Input
                                type="time"
                                value={segment.arrivalTime}
                                onChange={(e) =>
                                  handleSegmentUpdate(
                                    segment.id,
                                    "arrivalTime",
                                    e.target.value
                                  )
                                }
                                disabled={!canEdit}
                                className="h-8"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Distancia</Label>
                              <div className="h-8 px-3 bg-muted rounded-md flex items-center text-sm">
                                {segment.distance} km ({Math.round(segment.duration / 60)}h)
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Notas</Label>
                            <Input
                              value={segment.notes}
                              onChange={(e) =>
                                handleSegmentUpdate(segment.id, "notes", e.target.value)
                              }
                              disabled={!canEdit}
                              placeholder="Información adicional del viaje"
                              className="h-8"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {canEdit && travelPlan.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Plan de Viajes
              </>
            )}
          </Button>
        </div>
      )}

      {!canEdit && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-300">
          ⚠ No tienes permisos para editar el plan de viajes
        </div>
      )}
    </div>
  );
};
