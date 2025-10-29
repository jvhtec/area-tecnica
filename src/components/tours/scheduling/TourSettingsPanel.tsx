import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Save, Loader2, Navigation, Search } from "lucide-react";
import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";

interface TourSettingsProps {
  tourId: string;
  onSave?: () => void;
}

interface TourSettings {
  home_base_name?: string;
  home_base_address?: string;
  home_base_coordinates?: {
    lat: number;
    lng: number;
  };
  default_departure_time?: string;
  default_return_time?: string;
}

export const TourSettingsPanel: React.FC<TourSettingsProps> = ({
  tourId,
  onSave,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TourSettings>({
    default_departure_time: "09:00",
    default_return_time: "18:00",
  });

  useEffect(() => {
    loadSettings();
  }, [tourId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tours')
        .select('tour_settings')
        .eq('id', tourId)
        .single();

      if (error) throw error;

      if (data?.tour_settings) {
        setSettings(data.tour_settings as TourSettings);
      }
    } catch (error: any) {
      console.error('Error loading tour settings:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las configuraciones del tour",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tours')
        .update({ tour_settings: settings })
        .eq('id', tourId);

      if (error) throw error;

      toast({
        title: "Guardado",
        description: "Configuraciones guardadas correctamente",
      });

      onSave?.();
    } catch (error: any) {
      console.error('Error saving tour settings:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar las configuraciones",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePlaceSelect = (place: any) => {
    setSettings(prev => ({
      ...prev,
      home_base_name: place.name,
      home_base_address: place.formatted_address || place.address,
      home_base_coordinates: place.coordinates,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Base de Operaciones
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configura la ubicación desde donde el equipo parte y regresa
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="home-base">Buscar Ubicación</Label>
            <PlaceAutocomplete
              onPlaceSelect={handlePlaceSelect}
              placeholder="Buscar base de operaciones..."
            />
          </div>

          {settings.home_base_name && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <Navigation className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-semibold">{settings.home_base_name}</div>
                  {settings.home_base_address && (
                    <div className="text-sm text-muted-foreground">
                      {settings.home_base_address}
                    </div>
                  )}
                  {settings.home_base_coordinates && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Coordenadas: {settings.home_base_coordinates.lat.toFixed(6)}, {settings.home_base_coordinates.lng.toFixed(6)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="departure-time">Hora de Salida por Defecto</Label>
              <Input
                id="departure-time"
                type="time"
                value={settings.default_departure_time || ""}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  default_departure_time: e.target.value
                }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Hora habitual de salida desde la base
              </p>
            </div>
            <div>
              <Label htmlFor="return-time">Hora de Regreso por Defecto</Label>
              <Input
                id="return-time"
                type="time"
                value={settings.default_return_time || ""}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  default_return_time: e.target.value
                }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Hora habitual de regreso a la base
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
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
    </div>
  );
};
