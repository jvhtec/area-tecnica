import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Home,
  MapPin,
  Clock,
  Save,
  Loader2,
  Search,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (tourData?.tour_settings) {
      setSettings({
        name: tourData.tour_settings.homeBase?.name || "",
        address: tourData.tour_settings.homeBase?.address || "",
        latitude: tourData.tour_settings.homeBase?.latitude || null,
        longitude: tourData.tour_settings.homeBase?.longitude || null,
        defaultDepartureTime: tourData.tour_settings.defaultDepartureTime || "08:00",
        defaultReturnTime: tourData.tour_settings.defaultReturnTime || "18:00",
      });
    }
  }, [tourData]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Use Google Places API for location search
      // Note: This requires the API key to be configured in the environment
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          searchQuery
        )}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setSearchResults(data.results || []);

      if (data.results.length === 0) {
        toast({
          title: "Sin resultados",
          description: "No se encontraron ubicaciones para tu búsqueda",
        });
      }
    } catch (error: any) {
      console.error("Error searching location:", error);
      toast({
        title: "Error",
        description: "No se pudo buscar la ubicación",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLocation = (place: any) => {
    setSettings({
      ...settings,
      name: place.name,
      address: place.formatted_address,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
    });
    setSearchResults([]);
    setSearchQuery("");

    toast({
      title: "Ubicación seleccionada",
      description: `${place.name} - ${place.formatted_address}`,
    });
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
        .update({ tour_settings: tourSettings })
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
          <div className="space-y-2">
            <Label htmlFor="location-search">Buscar Ubicación</Label>
            <div className="flex gap-2">
              <Input
                id="location-search"
                placeholder="Buscar ciudad, dirección o lugar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                disabled={!canEdit}
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !canEdit || !searchQuery.trim()}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {searchResults.map((place, index) => (
                <button
                  key={index}
                  className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-start gap-3"
                  onClick={() => handleSelectLocation(place)}
                  disabled={!canEdit}
                >
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{place.name}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {place.formatted_address}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {settings.latitude && settings.longitude && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-700 font-medium">
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
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          ⚠ No tienes permisos para editar la configuración del tour
        </div>
      )}
    </div>
  );
};
