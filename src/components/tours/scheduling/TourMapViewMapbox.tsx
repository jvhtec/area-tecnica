import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Map, MapPin, Home, Loader2, AlertCircle, Hotel } from "lucide-react";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface TourMapViewMapboxProps {
  tourData: any;
  tourDates: any[];
  accommodations?: any[];
  mapboxToken?: string | null;
}

export const TourMapViewMapbox: React.FC<TourMapViewMapboxProps> = ({
  tourData,
  tourDates,
  accommodations = [],
  mapboxToken,
}) => {
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const sortedDates = [...tourDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    let isMounted = true;

    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Use provided token or fetch as fallback
        let token = mapboxToken;
        
        if (!token) {
          console.log('Fetching Mapbox token (fallback)...');
          const { data, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');

          if (tokenError) {
            console.error('Token fetch error:', tokenError);
            throw new Error(`Error al obtener el token de Mapbox: ${tokenError.message}`);
          }

          if (!data?.token) {
            console.error('No token in response:', data);
            throw new Error('No se encontró el token de Mapbox en la respuesta');
          }

          token = data.token;
        } else {
          console.log('Using pre-fetched Mapbox token');
        }

        mapboxgl.accessToken = token;

        // Create map instance with dark style
        const mapInstance = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [-3.7038, 40.4168], // Madrid, Spain as default
          zoom: 5,
          projection: 'mercator' as any,
        });

        map.current = mapInstance;

        // Add navigation controls
        mapInstance.addControl(
          new mapboxgl.NavigationControl({
            visualizePitch: true,
          }),
          'top-right'
        );

        // Add fullscreen control
        mapInstance.addControl(new mapboxgl.FullscreenControl(), 'top-right');

        // Map loaded event
        mapInstance.on('load', () => {
          if (!isMounted) return;
          setIsLoading(false);
          setMapLoaded(true);
          mapInstance.resize();
        });

        // Error handling
        mapInstance.on('error', (event) => {
          if (!isMounted) return;
          console.error('Mapbox error:', event.error);
          setError('No se pudieron cargar los datos del mapa. Inténtalo de nuevo más tarde.');
          setIsLoading(false);
        });

        // Handle window resize
        const handleResize = () => mapInstance.resize();
        window.addEventListener('resize', handleResize);

        mapInstance.once('remove', () => {
          window.removeEventListener('resize', handleResize);
        });
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Error initializing map:', err);
        setError(err.message || 'No se pudo cargar el mapa. Revisa tu conexión.');
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      isMounted = false;
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    renderMapContent();
  }, [mapLoaded, tourData, tourDates, accommodations]);

  const renderMapContent = () => {
    if (!map.current) return;

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasCoordinates = false;

    // Add home base marker if configured
    const homeBase = tourData?.tour_settings?.homeBase;
    if (homeBase?.latitude != null && homeBase?.longitude != null) {
      hasCoordinates = true;

      // Create custom home marker
      const homeEl = document.createElement('div');
      homeEl.className = 'custom-marker-home';
      homeEl.innerHTML = '🏠';
      homeEl.style.fontSize = '28px';
      homeEl.style.cursor = 'pointer';
      homeEl.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';

      const homePopup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
      }).setHTML(`
        <div style="padding: 8px; min-width: 200px; background: hsl(var(--popover)); color: hsl(var(--popover-foreground));">
          <h3 style="font-weight: bold; margin-bottom: 4px;">🏠 Base de Operaciones</h3>
          <p style="margin: 4px 0; font-size: 14px;">${homeBase.name}</p>
          <p style="margin: 4px 0; font-size: 12px; opacity: 0.8;">${homeBase.address || ''}</p>
        </div>
      `);

      const homeMarker = new mapboxgl.Marker(homeEl)
        .setLngLat([homeBase.longitude, homeBase.latitude])
        .setPopup(homePopup)
        .addTo(map.current);

      markers.current.push(homeMarker);
      bounds.extend([homeBase.longitude, homeBase.latitude]);
    }

    // Add venue markers
    sortedDates.forEach((date, index) => {
      const location = date.locations || date.location;
      if (!location?.latitude || !location?.longitude) return;

      hasCoordinates = true;

      // Create custom venue marker
      const venueEl = document.createElement('div');
      venueEl.className = 'custom-marker-venue';
      venueEl.innerHTML = `<div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: #ef4444;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        color: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        cursor: pointer;
      ">${index + 1}</div>`;

      const dateStr = new Date(date.date).toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const venuePopup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
      }).setHTML(`
        <div style="padding: 8px; max-width: 250px; background: hsl(var(--popover)); color: hsl(var(--popover-foreground));">
          <h3 style="font-weight: bold; margin-bottom: 4px;">📍 Fecha ${index + 1}</h3>
          <p style="margin: 4px 0; font-weight: 600; font-size: 14px;">${location.venue_name || "Venue"}</p>
          <p style="margin: 4px 0; font-size: 12px;">${dateStr}</p>
          <p style="margin: 4px 0; font-size: 12px; opacity: 0.8;">${location.city || ""}, ${location.state || ""}</p>
          ${date.call_time ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Call:</strong> ${date.call_time}</p>` : ""}
        </div>
      `);

      const venueMarker = new mapboxgl.Marker(venueEl)
        .setLngLat([location.longitude, location.latitude])
        .setPopup(venuePopup)
        .addTo(map.current!);

      markers.current.push(venueMarker);
      bounds.extend([location.longitude, location.latitude]);
    });

    // Add accommodation markers
    accommodations.forEach((accommodation, index) => {
      if (!accommodation.latitude || !accommodation.longitude) return;

      hasCoordinates = true;

      // Create custom hotel marker
      const hotelEl = document.createElement('div');
      hotelEl.className = 'custom-marker-hotel';
      hotelEl.innerHTML = '🏨';
      hotelEl.style.fontSize = '24px';
      hotelEl.style.cursor = 'pointer';
      hotelEl.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';

      const hotelPopup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
      }).setHTML(`
        <div style="padding: 8px; max-width: 250px; background: hsl(var(--popover)); color: hsl(var(--popover-foreground));">
          <h3 style="font-weight: bold; margin-bottom: 4px;">🏨 ${accommodation.hotel_name || 'Hotel'}</h3>
          ${accommodation.hotel_address ? `<p style="margin: 4px 0; font-size: 12px; opacity: 0.8;">${accommodation.hotel_address}</p>` : ''}
          ${accommodation.check_in_date ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Check-in:</strong> ${new Date(accommodation.check_in_date).toLocaleDateString('es-ES')}</p>` : ''}
          ${accommodation.check_out_date ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Check-out:</strong> ${new Date(accommodation.check_out_date).toLocaleDateString('es-ES')}</p>` : ''}
          ${accommodation.rooms_booked ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Habitaciones:</strong> ${accommodation.rooms_booked}</p>` : ''}
        </div>
      `);

      const hotelMarker = new mapboxgl.Marker(hotelEl)
        .setLngLat([accommodation.longitude, accommodation.latitude])
        .setPopup(hotelPopup)
        .addTo(map.current!);

      markers.current.push(hotelMarker);
      bounds.extend([accommodation.longitude, accommodation.latitude]);
    });

    // Draw route lines between venues
    if (map.current.getSource('tour-route')) {
      map.current.removeLayer('tour-route-line');
      map.current.removeSource('tour-route');
    }

    const routeCoordinates: [number, number][] = [];

    // Line from home to first venue
    if (homeBase?.latitude != null && homeBase?.longitude != null) {
      const firstDateWithLoc = sortedDates.find(d => {
        const loc = d.locations || d.location;
        return loc?.latitude != null && loc?.longitude != null;
      });
      const firstVenue = firstDateWithLoc?.locations || firstDateWithLoc?.location;
      if (firstVenue?.latitude != null && firstVenue?.longitude != null) {
        routeCoordinates.push([homeBase.longitude, homeBase.latitude]);
        routeCoordinates.push([firstVenue.longitude, firstVenue.latitude]);
      }
    }

    // Lines between consecutive venues
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const fromLoc = sortedDates[i].locations || sortedDates[i].location;
      const toLoc = sortedDates[i + 1].locations || sortedDates[i + 1].location;

      if (
        fromLoc?.latitude != null &&
        fromLoc?.longitude != null &&
        toLoc?.latitude != null &&
        toLoc?.longitude != null
      ) {
        if (routeCoordinates.length === 0) {
          routeCoordinates.push([fromLoc.longitude, fromLoc.latitude]);
        }
        routeCoordinates.push([toLoc.longitude, toLoc.latitude]);
      }
    }

    // Line from last venue to home
    if (homeBase?.latitude != null && homeBase?.longitude != null && sortedDates.length > 0) {
      const lastDateWithLoc = [...sortedDates].reverse().find(d => {
        const loc = d.locations || d.location;
        return loc?.latitude != null && loc?.longitude != null;
      });
      const lastVenue = lastDateWithLoc?.locations || lastDateWithLoc?.location;
      if (lastVenue?.latitude != null && lastVenue?.longitude != null) {
        if (routeCoordinates.length > 0 &&
            (routeCoordinates[routeCoordinates.length - 1][0] !== lastVenue.longitude ||
             routeCoordinates[routeCoordinates.length - 1][1] !== lastVenue.latitude)) {
          routeCoordinates.push([lastVenue.longitude, lastVenue.latitude]);
        }
        routeCoordinates.push([homeBase.longitude, homeBase.latitude]);
      }
    }

    // Add route line to map
    if (routeCoordinates.length > 1) {
      map.current.addSource('tour-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeCoordinates,
          },
        },
      });

      map.current.addLayer({
        id: 'tour-route-line',
        type: 'line',
        source: 'tour-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#8b5cf6',
          'line-width': 3,
          'line-opacity': 0.7,
        },
      });
    }

    // Fit map to bounds
    if (hasCoordinates && !bounds.isEmpty()) {
      map.current.fitBounds(bounds, {
        padding: 80,
        maxZoom: 12,
        duration: 800,
      });
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] text-center p-8">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error al cargar el mapa</h3>
        <p className="text-muted-foreground">{error}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Verifica que la API key de Mapbox esté configurada
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Mapa de Ruta del Tour
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
                <Home className="h-3 w-3 mr-1" />
                Base
              </Badge>
              <Badge variant="outline" className="bg-red-50 dark:bg-red-950">
                <MapPin className="h-3 w-3 mr-1" />
                Venues
              </Badge>
              {accommodations.length > 0 && (
                <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950">
                  <Hotel className="h-3 w-3 mr-1" />
                  Hoteles
                </Badge>
              )}
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
                ref={mapContainer}
                className="w-full h-[600px] rounded-lg border"
                style={{ minHeight: "600px" }}
              />

              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span>Base de Operaciones</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span>Venues del Tour</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-1 bg-purple-500"></div>
                  <span>Rutas de Viaje</span>
                </div>
                {accommodations.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">🏨</span>
                    <span>Alojamientos</span>
                  </div>
                )}
              </div>

              {sortedDates.length === 0 && (
                <div className="mt-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-300">
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
