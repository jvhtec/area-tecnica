import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Map, MapPin, Home, Loader2, AlertCircle } from "lucide-react";

interface TourMapViewProps {
  tourData: any;
  tourDates: any[];
}

export const TourMapView: React.FC<TourMapViewProps> = ({
  tourData,
  tourDates,
}) => {
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const sortedDates = [...tourDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Fetch Google Maps API key from Supabase
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-google-maps-key');

        if (error) {
          console.error('Failed to fetch Google Maps API key:', error);
          setError('Failed to load Google Maps API key');
          setIsLoading(false);
          return;
        }

        if (data?.apiKey) {
          setApiKey(data.apiKey);
        } else {
          setError('Google Maps API key not found');
          setIsLoading(false);
        }
      } catch (err) {
        setError('Failed to fetch Google Maps API key');
        setIsLoading(false);
        console.error('Error fetching API key:', err);
      }
    };

    fetchApiKey();
  }, []);

  useEffect(() => {
    if (apiKey) {
      loadGoogleMaps();
    }
  }, [apiKey]);

  useEffect(() => {
    if (mapInstance && tourData && tourDates.length > 0) {
      renderMapContent();
    }
  }, [mapInstance, tourData, tourDates]);

  const loadGoogleMaps = async () => {
    try {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      // Load Google Maps script with the fetched API key
      if (!apiKey) {
        throw new Error("Google Maps API key not configured");
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => initializeMap();
      script.onerror = () => {
        setError("Failed to load Google Maps");
        setIsLoading(false);
      };

      document.head.appendChild(script);
    } catch (error: any) {
      console.error("Error loading Google Maps:", error);
      setError(error.message);
      setIsLoading(false);
    }
  };

  const initializeMap = () => {
    if (!mapRef.current) return;

    try {
      const map = new google.maps.Map(mapRef.current, {
        zoom: 6,
        center: { lat: 40.4168, lng: -3.7038 }, // Madrid, Spain as default
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      });

      setMapInstance(map);
      setIsLoading(false);
    } catch (error: any) {
      console.error("Error initializing map:", error);
      setError("Failed to initialize map");
      setIsLoading(false);
    }
  };

  const renderMapContent = () => {
    if (!mapInstance) return;

    // Clear existing markers and polylines
    markersRef.current.forEach((marker) => marker.setMap(null));
    polylinesRef.current.forEach((polyline) => polyline.setMap(null));
    markersRef.current = [];
    polylinesRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    // Add home base marker if configured
    const homeBase = tourData?.tour_settings?.homeBase;
    if (homeBase?.latitude != null && homeBase?.longitude != null) {
      const homeMarker = new google.maps.Marker({
        position: { lat: homeBase.latitude, lng: homeBase.longitude },
        map: mapInstance,
        title: "Base de Operaciones",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: "#10b981",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        label: {
          text: "🏠",
          color: "white",
          fontSize: "16px",
        },
      });

      const homeInfoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h3 style="font-weight: bold; margin-bottom: 4px;">🏠 Base de Operaciones</h3>
            <p style="margin: 4px 0;">${homeBase.name}</p>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">${homeBase.address}</p>
          </div>
        `,
      });

      homeMarker.addListener("click", () => {
        homeInfoWindow.open(mapInstance, homeMarker);
      });

      markersRef.current.push(homeMarker);
      bounds.extend({ lat: homeBase.latitude, lng: homeBase.longitude });
    }

    // Add venue markers
    sortedDates.forEach((date, index) => {
      const location = date.locations;
      if (location?.latitude == null || location?.longitude == null) return;

      const venueMarker = new google.maps.Marker({
        position: { lat: location.latitude, lng: location.longitude },
        map: mapInstance,
        title: `${index + 1}. ${location.venue_name || "Venue"}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        label: {
          text: `${index + 1}`,
          color: "white",
          fontSize: "12px",
          fontWeight: "bold",
        },
      });

      const dateStr = new Date(date.date).toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const venueInfoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 250px;">
            <h3 style="font-weight: bold; margin-bottom: 4px;">📍 Fecha ${index + 1}</h3>
            <p style="margin: 4px 0; font-weight: 600;">${location.venue_name || "Venue"}</p>
            <p style="margin: 4px 0; font-size: 12px;">${dateStr}</p>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">${location.city || ""}, ${location.state || ""}</p>
            ${date.call_time ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Call:</strong> ${date.call_time}</p>` : ""}
          </div>
        `,
      });

      venueMarker.addListener("click", () => {
        venueInfoWindow.open(mapInstance, venueMarker);
      });

      markersRef.current.push(venueMarker);
      bounds.extend({ lat: location.latitude, lng: location.longitude });
    });

    // Draw route lines
    const routePoints: google.maps.LatLng[] = [];

    // Line from home to first venue with coordinates
    if (homeBase?.latitude != null && homeBase?.longitude != null) {
      const firstDateWithLoc = sortedDates.find(d => d.locations?.latitude != null && d.locations?.longitude != null);
      const firstVenue = firstDateWithLoc?.locations;
      if (firstVenue && firstVenue.latitude != null && firstVenue.longitude != null) {
        const homeLine = new google.maps.Polyline({
          path: [
            { lat: homeBase.latitude, lng: homeBase.longitude },
            { lat: firstVenue.latitude, lng: firstVenue.longitude },
          ],
          geodesic: true,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.7,
          strokeWeight: 3,
          map: mapInstance,
        });
        polylinesRef.current.push(homeLine);
      }
    }

    // Lines between consecutive venues
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const fromLocation = sortedDates[i].locations;
      const toLocation = sortedDates[i + 1].locations;

      if (
        fromLocation?.latitude != null &&
        fromLocation?.longitude != null &&
        toLocation?.latitude != null &&
        toLocation?.longitude != null
      ) {
        const venueLine = new google.maps.Polyline({
          path: [
            { lat: fromLocation.latitude, lng: fromLocation.longitude },
            { lat: toLocation.latitude, lng: toLocation.longitude },
          ],
          geodesic: true,
          strokeColor: "#8b5cf6",
          strokeOpacity: 0.7,
          strokeWeight: 3,
          map: mapInstance,
        });
        polylinesRef.current.push(venueLine);
      }
    }

    // Line from last venue with coordinates to home
    if (homeBase?.latitude != null && homeBase?.longitude != null && sortedDates.length > 0) {
      const lastDateWithLoc = [...sortedDates].reverse().find(d => d.locations?.latitude != null && d.locations?.longitude != null);
      const lastVenue = lastDateWithLoc?.locations;
      if (lastVenue && lastVenue.latitude != null && lastVenue.longitude != null) {
        const returnLine = new google.maps.Polyline({
          path: [
            { lat: lastVenue.latitude, lng: lastVenue.longitude },
            { lat: homeBase.latitude, lng: homeBase.longitude },
          ],
          geodesic: true,
          strokeColor: "#10b981",
          strokeOpacity: 0.7,
          strokeWeight: 3,
          map: mapInstance,
        });
        polylinesRef.current.push(returnLine);
      }
    }

    // Fit map to bounds
    if (!bounds.isEmpty()) {
      mapInstance.fitBounds(bounds);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] text-center p-8">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error al cargar el mapa</h3>
        <p className="text-muted-foreground">{error}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Verifica que la API key de Google Maps esté configurada
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Mapa de Ruta del Tour
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50">
                <Home className="h-3 w-3 mr-1" />
                Base
              </Badge>
              <Badge variant="outline" className="bg-red-50">
                <MapPin className="h-3 w-3 mr-1" />
                Venues
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[600px]">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p className="text-muted-foreground">Cargando mapa...</p>
            </div>
          ) : (
            <>
              <div
                ref={mapRef}
                className="w-full h-[600px] rounded-lg border"
                style={{ minHeight: "600px" }}
              />

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span>Base de Operaciones</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span>Venues del Tour</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-1 bg-blue-500"></div>
                  <span>Rutas de Viaje</span>
                </div>
              </div>

              {sortedDates.length === 0 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
                  ⚠ No hay fechas con ubicaciones configuradas para mostrar en el mapa
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
