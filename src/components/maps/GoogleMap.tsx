import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, MapPin } from 'lucide-react';
import {
  buildStaticMapUrl,
  geocodeForward,
  geocodeReverse,
  getMapboxToken,
} from '@/lib/mapbox/mapboxClient';

interface GoogleMapProps {
  address?: string;
  coordinates?: { lat: number; lng: number };
  height?: string;
  onLocationSelect?: (coordinates: { lat: number; lng: number }, address: string) => void;
  showMarker?: boolean;
  interactive?: boolean;
  onStaticMapUrlChange?: (url: string) => void;
}

const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 }; // Madrid

/**
 * Interactive map backed by Mapbox GL JS. The component name is kept as
 * `GoogleMap` for backwards compatibility with existing imports, but it no
 * longer uses any Google Maps APIs (no billing).
 */
export const GoogleMap: React.FC<GoogleMapProps> = ({
  address,
  coordinates,
  height = '300px',
  onLocationSelect,
  showMarker = true,
  interactive = true,
  onStaticMapUrlChange,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapboxglRef = useRef<any>(null);
  const tokenRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep latest callbacks/props for use inside map event handlers
  const onLocationSelectRef = useRef(onLocationSelect);
  onLocationSelectRef.current = onLocationSelect;
  const onStaticMapUrlChangeRef = useRef(onStaticMapUrlChange);
  onStaticMapUrlChangeRef.current = onStaticMapUrlChange;

  const resolveCenter = async (token: string): Promise<{ lat: number; lng: number }> => {
    if (coordinates) return coordinates;
    if (address) {
      const geocoded = await geocodeForward(address, token);
      if (geocoded) return { lat: geocoded.lat, lng: geocoded.lng };
    }
    return DEFAULT_CENTER;
  };

  const emitStaticMapUrl = (center: { lat: number; lng: number }) => {
    if (onStaticMapUrlChangeRef.current && tokenRef.current) {
      onStaticMapUrlChangeRef.current(
        buildStaticMapUrl(tokenRef.current, { ...center, width: 600, height: 300, zoom: 15 }),
      );
    }
  };

  const handlePositionChange = async (center: { lat: number; lng: number }) => {
    if (!onLocationSelectRef.current) return;
    const token = tokenRef.current;
    const resolvedAddress = token ? await geocodeReverse(center.lng, center.lat, token) : null;
    onLocationSelectRef.current(center, resolvedAddress || `${center.lat}, ${center.lng}`);
  };

  // Initialize map once
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const token = await getMapboxToken();
        if (!token) {
          if (isMounted) setError('Failed to load map token');
          return;
        }
        tokenRef.current = token;

        const [{ default: mapboxgl }] = await Promise.all([
          import('mapbox-gl'),
          import('mapbox-gl/dist/mapbox-gl.css'),
        ]);
        if (!isMounted || !mapRef.current) return;
        mapboxglRef.current = mapboxgl;
        mapboxgl.accessToken = token;

        const center = await resolveCenter(token);
        if (!isMounted || !mapRef.current) return;

        const map = new mapboxgl.Map({
          container: mapRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [center.lng, center.lat],
          zoom: 15,
          interactive,
        });
        mapInstanceRef.current = map;

        if (interactive) {
          map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
        }

        emitStaticMapUrl(center);

        if (showMarker) {
          const draggable = interactive && !!onLocationSelect;
          const marker = new mapboxgl.Marker({ color: '#ef4444', draggable })
            .setLngLat([center.lng, center.lat])
            .addTo(map);
          markerRef.current = marker;

          if (draggable) {
            marker.on('dragend', () => {
              const lngLat = marker.getLngLat();
              void handlePositionChange({ lat: lngLat.lat, lng: lngLat.lng });
            });
          }
        }

        if (interactive && onLocationSelect) {
          map.on('click', (event: any) => {
            const coords = { lat: event.lngLat.lat, lng: event.lngLat.lng };
            markerRef.current?.setLngLat([coords.lng, coords.lat]);
            void handlePositionChange(coords);
          });
        }

        map.on('load', () => {
          if (isMounted) setIsLoading(false);
          map.resize();
        });
      } catch (err) {
        console.error('Map initialization error:', err);
        if (isMounted) {
          setError('Failed to initialize map');
          setIsLoading(false);
        }
      }
    };

    void initMap();

    return () => {
      isMounted = false;
      markerRef.current?.remove();
      markerRef.current = null;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when address/coordinates change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const token = tokenRef.current;
    if (!map || !token) return;

    let isCancelled = false;
    (async () => {
      const center = await resolveCenter(token);
      if (isCancelled || !mapInstanceRef.current) return;
      map.setCenter([center.lng, center.lat]);
      markerRef.current?.setLngLat([center.lng, center.lat]);
      emitStaticMapUrl(center);
    })();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, coordinates?.lat, coordinates?.lng]);

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6" style={{ height }}>
          <div className="text-center">
            <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 relative">
        <div ref={mapRef} style={{ height, width: '100%' }} />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Cargando mapa...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
