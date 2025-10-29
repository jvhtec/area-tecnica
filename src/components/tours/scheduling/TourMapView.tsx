import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Map, MapPin, Home, Route as RouteIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TourMapViewProps {
  tourData: any;
  tourDates: any[];
  homeBase?: any;
}

declare global {
  interface Window {
    google: any;
  }
}

export const TourMapView: React.FC<TourMapViewProps> = ({
  tourData,
  tourDates,
  homeBase,
}) => {
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string>("");

  const sortedDates = [...tourDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  useEffect(() => {
    loadMapApiKey();
  }, []);

  useEffect(() => {
    if (apiKey && mapRef.current) {
      initializeMap();
    }
  }, [apiKey, sortedDates, homeBase]);

  const loadMapApiKey = async () => {
    try {
      const response = await fetch('/api/get-google-maps-key');
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.key);
      }
    } catch (error) {
      console.error('Error loading Google Maps API key:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la API de mapas",
        variant: "destructive",
      });
    }
  };

  const initializeMap = () => {
    if (!window.google || !mapRef.current) return;

    const bounds = new window.google.maps.LatLngBounds();

    // Initialize map
    const mapInstance = new window.google.maps.Map(mapRef.current, {
      zoom: 6,
      center: { lat: 40.4168, lng: -3.7038 }, // Madrid center as default
      mapTypeId: 'roadmap',
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    // Add home base marker
    if (homeBase?.home_base_coordinates) {
      const homeMarker = new window.google.maps.Marker({
        position: homeBase.home_base_coordinates,
        map: mapInstance,
        title: homeBase.home_base_name || 'Base',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        label: {
          text: '🏠',
          fontSize: '16px',
        }
      });

      const homeInfoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h3 style="font-weight: bold; margin-bottom: 4px;">Base de Operaciones</h3>
            <p style="margin: 0;">${homeBase.home_base_name}</p>
            ${homeBase.home_base_address ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${homeBase.home_base_address}</p>` : ''}
          </div>
        `
      });

      homeMarker.addListener('click', () => {
        homeInfoWindow.open(mapInstance, homeMarker);
      });

      bounds.extend(homeBase.home_base_coordinates);
    }

    // Add venue markers
    sortedDates.forEach((date, index) => {
      if (date.location?.latitude && date.location?.longitude) {
        const position = {
          lat: date.location.latitude,
          lng: date.location.longitude,
        };

        const marker = new window.google.maps.Marker({
          position,
          map: mapInstance,
          title: date.location.name,
          label: {
            text: `${index + 1}`,
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
          },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: '#7d0101',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; max-width: 250px;">
              <div style="font-weight: bold; color: #7d0101; margin-bottom: 4px;">Día ${index + 1}</div>
              <h3 style="font-weight: bold; margin: 0 0 4px 0;">${date.location.name}</h3>
              <p style="margin: 0; font-size: 14px;">${format(new Date(date.date), "EEEE, d 'de' MMMM", { locale: es })}</p>
              ${date.location.address ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${date.location.address}</p>` : ''}
              ${date.notes ? `<p style="margin: 4px 0 0 0; font-size: 12px; font-style: italic;">${date.notes}</p>` : ''}
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(mapInstance, marker);
        });

        bounds.extend(position);
      }
    });

    // Draw route lines
    if (homeBase?.home_base_coordinates) {
      // Home to first venue
      if (sortedDates[0]?.location?.latitude) {
        const path = [
          homeBase.home_base_coordinates,
          { lat: sortedDates[0].location.latitude, lng: sortedDates[0].location.longitude }
        ];

        new window.google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#10b981',
          strokeOpacity: 0.6,
          strokeWeight: 3,
          map: mapInstance,
        });
      }

      // Between venues
      for (let i = 0; i < sortedDates.length - 1; i++) {
        const current = sortedDates[i];
        const next = sortedDates[i + 1];

        if (current.location?.latitude && next.location?.latitude) {
          const path = [
            { lat: current.location.latitude, lng: current.location.longitude },
            { lat: next.location.latitude, lng: next.location.longitude }
          ];

          new window.google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#7d0101',
            strokeOpacity: 0.6,
            strokeWeight: 3,
            map: mapInstance,
          });
        }
      }

      // Last venue to home
      const lastDate = sortedDates[sortedDates.length - 1];
      if (lastDate?.location?.latitude) {
        const path = [
          { lat: lastDate.location.latitude, lng: lastDate.location.longitude },
          homeBase.home_base_coordinates
        ];

        new window.google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#3b82f6',
          strokeOpacity: 0.6,
          strokeWeight: 3,
          map: mapInstance,
        });
      }
    }

    // Fit map to bounds
    if (!bounds.isEmpty()) {
      mapInstance.fitBounds(bounds);
      const padding = { top: 50, right: 50, bottom: 50, left: 50 };
      mapInstance.fitBounds(bounds, padding);
    }

    setMap(mapInstance);
    setLoading(false);
  };

  // Load Google Maps script
  useEffect(() => {
    if (!apiKey) return;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoading(false);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [apiKey]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Mapa del Tour
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Visualiza la ruta completa del tour y todas las ubicaciones
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50">
                <Home className="h-3 w-3 mr-1" />
                Base
              </Badge>
              <Badge variant="outline" className="bg-red-50">
                <MapPin className="h-3 w-3 mr-1" />
                {sortedDates.length} Venues
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-[600px] bg-muted rounded-lg">
              <div className="text-center">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Cargando mapa...</p>
              </div>
            </div>
          ) : (
            <div
              ref={mapRef}
              className="w-full h-[600px] rounded-lg border"
              style={{ minHeight: '600px' }}
            />
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Leyenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
              <span className="text-sm">Base de Operaciones</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#7d0101] border-2 border-white"></div>
              <span className="text-sm">Venues del Tour</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-8 h-0.5 bg-[#7d0101] opacity-60"></div>
                <RouteIcon className="h-4 w-4 text-[#7d0101]" />
              </div>
              <span className="text-sm">Rutas entre venues</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!homeBase?.home_base_coordinates && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>Tip:</strong> Configura la base de operaciones en la pestaña "Configuración" para ver las rutas desde/hacia la base.
        </div>
      )}
    </div>
  );
};
