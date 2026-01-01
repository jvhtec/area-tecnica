import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap, Marker as MapboxMarker } from 'mapbox-gl';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { SoundVisionFile } from '@/hooks/useSoundVisionFiles';

interface SoundVisionMapProps {
  files: SoundVisionFile[];
}

interface VenueGroup {
  venue: NonNullable<SoundVisionFile['venue']>;
  fileCount: number;
  ratingsCount: number;
  ratingTotal: number;
}

export const SoundVisionMap = ({ files }: SoundVisionMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapboxglRef = useRef<any>(null);
  const map = useRef<MapboxMap | null>(null);
  const markers = useRef<MapboxMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const hasShownError = useRef(false);
  const previousVenueCount = useRef<number>(0);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    let isMounted = true;
    let mapHasLoaded = false;

    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);
        hasShownError.current = false;

        const [{ default: mapboxgl }] = await Promise.all([
          import('mapbox-gl'),
          import('mapbox-gl/dist/mapbox-gl.css'),
        ]);

        if (!isMounted) return;
        mapboxglRef.current = mapboxgl;

        const { data, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');

        if (tokenError) {
          console.error('Token fetch error:', tokenError);
          throw new Error(`Error al obtener el token de Mapbox: ${tokenError.message}`);
        }

        if (!data?.token) {
          console.error('No token in response:', data);
          throw new Error('No se encontró el token de Mapbox en la respuesta');
        }

        console.log('Mapbox token retrieved successfully');
        mapboxgl.accessToken = data.token;

        const mapInstance = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [0, 20],
          zoom: 1.5,
          projection: 'globe' as any,
        });

        map.current = mapInstance;

        mapInstance.addControl(
          new mapboxgl.NavigationControl({
            visualizePitch: true,
          }),
          'top-right'
        );

        mapInstance.addControl(new mapboxgl.FullscreenControl(), 'top-right');

        mapInstance.on('style.load', () => {
          mapInstance.setFog({
            color: 'rgb(10, 10, 20)',
            'high-color': 'rgb(30, 30, 50)',
            'horizon-blend': 0.1,
          });
        });

        mapInstance.on('load', () => {
          if (!isMounted) return;
          mapHasLoaded = true;
          setIsLoading(false);
          setMapLoaded(true);
          mapInstance.resize();
        });

        mapInstance.on('error', event => {
          if (!isMounted || hasShownError.current || mapHasLoaded) return;
          hasShownError.current = true;
          console.error('Mapbox error:', event.error);
          setError('No se pudieron cargar los datos del mapa. Inténtalo de nuevo más tarde.');
          setIsLoading(false);
          toast.error('No se pudieron cargar los datos del mapa');
        });

        const handleResize = () => mapInstance.resize();
        window.addEventListener('resize', handleResize);

        mapInstance.once('remove', () => {
          window.removeEventListener('resize', handleResize);
        });
      } catch (err) {
        if (!isMounted) return;
        console.error('Error initializing map:', err);
        setError('No se pudo cargar el mapa. Revisa tu conexión.');
        setIsLoading(false);
        toast.error('No se pudo iniciar el mapa');
      }
    };

    initMap();

    return () => {
      isMounted = false;
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
      mapboxglRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    const mapboxgl = mapboxglRef.current;
    if (!mapboxgl) return;

    const venueMap = new Map<string, VenueGroup>();

    files.forEach(file => {
      if (!file.venue?.coordinates) return;

      const { lat, lng } = file.venue.coordinates;
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      const fileRatingsCount = file.ratings_count ?? 0;
      const fileRatingTotal = file.rating_total ?? 0;

      if (!venueMap.has(key)) {
        venueMap.set(key, {
          venue: file.venue!,
          fileCount: 1,
          ratingsCount: fileRatingsCount,
          ratingTotal: fileRatingTotal,
        });
      } else {
        const existing = venueMap.get(key)!;
        existing.fileCount++;
        existing.ratingsCount += fileRatingsCount;
        existing.ratingTotal += fileRatingTotal;
      }
    });

    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    const bounds = new mapboxgl.LngLatBounds();

    venueMap.forEach(({ venue, fileCount, ratingsCount, ratingTotal }) => {
      if (!venue.coordinates) return;

      const { lat, lng } = venue.coordinates;

      bounds.extend([lng, lat]);

      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = 'hsl(var(--primary))';
      el.style.border = '2px solid white';
      el.style.cursor = 'pointer';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

      const archivosDisponibles = fileCount === 1 ? 'archivo disponible' : 'archivos disponibles';
      const reseñasDisponibles = ratingsCount === 1 ? 'reseña' : 'reseñas';
      const averageRating = ratingsCount > 0 ? ratingTotal / ratingsCount : null;
      const ratingLine = ratingsCount > 0
        ? `<p style="font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-top: 6px;">` +
          `Valoración media: <strong>${averageRating?.toFixed(1)}</strong> (${ratingsCount} ${reseñasDisponibles})` +
          `</p>`
        : `<p style="font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-top: 6px;">Sin reseñas registradas</p>`;
      const popupContent = `
        <div style="padding: 8px; min-width: 200px;">
          <h3 style="font-weight: bold; margin-bottom: 4px; color: hsl(var(--foreground));">${venue.name}</h3>
          <p style="font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-bottom: 8px;">
            ${[venue.city, venue.state_region, venue.country].filter(Boolean).join(', ')}
          </p>
          <p style="font-size: 0.875rem; color: hsl(var(--muted-foreground));">
            <strong>${fileCount}</strong> ${archivosDisponibles}
          </p>
          ${ratingLine}
        </div>
      `;

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
      }).setHTML(popupContent);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
    });

    if (venueMap.size === 0) {
      if (previousVenueCount.current !== 0) {
        toast.info('No hay recintos con coordenadas para mostrar');
      }
      previousVenueCount.current = 0;
      return;
    }

    if (!bounds.isEmpty()) {
      map.current!.fitBounds(bounds, { padding: 80, maxZoom: 12, duration: 800 });
    }

    if (venueMap.size !== previousVenueCount.current) {
      const textoUbicaciones = venueMap.size === 1 ? 'ubicación' : 'ubicaciones';
      toast.success(`Mapa cargado con ${venueMap.size} ${textoUbicaciones} de recintos`);
    }

    previousVenueCount.current = venueMap.size;
  }, [files, mapLoaded]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded-lg border">
        <div className="text-center p-6">
          <p className="text-destructive font-medium mb-2">Error del mapa</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[500px]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 rounded-lg">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Cargando mapa...</span>
          </div>
        </div>
      )}
      <div ref={mapContainer} className="h-full w-full rounded-lg" />
    </div>
  );
};
