import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";
import {
  Home,
  MapPin,
  Clock,
  Save,
  Loader2,
} from "lucide-react";

interface TourSettingsPanelProps {
  tourId: string;
  tourData: any;
  canEdit: boolean;
  onSave: () => void;
}

interface HomeBaseSettings {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  defaultDepartureTime: string;
  defaultReturnTime: string;
}

export const TourSettingsPanel: React.FC<TourSettingsPanelProps> = ({
  tourId,
  tourData,
  canEdit,
  onSave,
}) => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<HomeBaseSettings>({
    name: "",
    address: "",
    latitude: null,
    longitude: null,
    defaultDepartureTime: "08:00",
    defaultReturnTime: "18:00",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [locationInput, setLocationInput] = useState("");

  useEffect(() => {
    if (tourData?.tour_settings) {
      const homeBase = tourData.tour_settings.homeBase;
      setSettings({
        name: homeBase?.name || "",
        address: homeBase?.address || "",
        latitude: homeBase?.latitude || null,
        longitude: homeBase?.longitude || null,
        defaultDepartureTime: tourData.tour_settings.defaultDepartureTime || "08:00",
        defaultReturnTime: tourData.tour_settings.defaultReturnTime || "18:00",
      });
      // Set initial location input if address exists
      if (homeBase?.address) {
        setLocationInput(homeBase.address);
      }
    }
  }, [tourData]);

  const handlePlaceSelect = (details: {
    name: string;
    address: string;
    coordinates?: { lat: number; lng: number };
    place_id?: string;
  }) => {
    if (details.coordinates) {
      setSettings({
        ...settings,
        name: details.name,
        address: details.address,
        latitude: details.coordinates.lat,
        longitude: details.coordinates.lng,
      });
      setLocationInput(details.address);

      toast({
        title: "Ubicación seleccionada",
        description: `${details.name} - ${details.address}`,
      });
    }
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast({
        title: "Sin permisos",
        description: "No tienes permisos para editar la configuración",
        variant: "destructive",
      });
      return;
    }

    if (!settings.name || !settings.latitude || !settings.longitude) {
      toast({
        title: "Datos incompletos",
        description: "Debes seleccionar una ubicación base para el tour",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const tourSettings = {
        homeBase: {
          name: settings.name,
          address: settings.address,
          latitude: settings.latitude,
          longitude: settings.longitude,
        },
        defaultDepartureTime: settings.defaultDepartureTime,
        defaultReturnTime: settings.defaultReturnTime,
      };

      const { error } = await supabase
        .from("tours")
        .update({ tour_settings: tourSettings } as any)
        .eq("id", tourId);

      if (error) throw error;

      toast({
        title: "Guardado",
        description: "La configuración se ha guardado correctamente",
      });

      onSave();
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Base de Operaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit ? (
            <div className="space-y-2">
              <PlaceAutocomplete
                value={locationInput}
                onInputChange={(value) => setLocationInput(value)}
                onSelect={handlePlaceSelect}
                placeholder="Buscar ciudad, dirección o lugar..."
                label="Buscar Ubicación"
              />
              <p className="text-xs text-muted-foreground">
                Busca y selecciona la ubicación base de operaciones del tour
              </p>
            </div>
          ) : settings.address && (
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <div className="text-sm text-muted-foreground">{settings.address}</div>
            </div>
          )}

          {settings.latitude && settings.longitude && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium">
                <MapPin className="h-4 w-4" />
                Ubicación Base Configurada
              </div>
              <div className="text-sm">
                <div className="font-medium">{settings.name}</div>
                <div className="text-muted-foreground">{settings.address}</div>
                <div className="text-xs mt-1">
                  GPS: {settings.latitude.toFixed(6)}, {settings.longitude.toFixed(6)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horarios por Defecto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departure-time">Hora de Salida por Defecto</Label>
              <Input
                id="departure-time"
                type="time"
                value={settings.defaultDepartureTime}
                onChange={(e) =>
                  setSettings({ ...settings, defaultDepartureTime: e.target.value })
                }
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Hora habitual de salida desde la base
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="return-time">Hora de Regreso por Defecto</Label>
              <Input
                id="return-time"
                type="time"
                value={settings.defaultReturnTime}
                onChange={(e) =>
                  setSettings({ ...settings, defaultReturnTime: e.target.value })
                }
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Hora habitual de regreso a la base
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Configuración
              </>
            )}
          </Button>
        </div>
      )}

      {!canEdit && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-300">
          ⚠ No tienes permisos para editar la configuración del tour
        </div>
      )}
    </div>
  );
};
