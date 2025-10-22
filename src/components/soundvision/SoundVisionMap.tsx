import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface SoundVisionFile {
  id: string;
  file_name: string;
  venue?: {
    id: string;
    name: string;
    city?: string;
    state_region?: string | null;
    country?: string;
    coordinates?: {
      lat: number;
      lng: number;
    } | null;
  } | null;
}

interface SoundVisionMapProps {
  files: SoundVisionFile[];
}

interface VenueGroup {
  venue: NonNullable<SoundVisionFile['venue']>;
  fileCount: number;
  files: SoundVisionFile[];
}

export const SoundVisionMap = ({ files }: SoundVisionMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch Mapbox token from edge function
        const { data, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');
        
        if (tokenError || !data?.token) {
          throw new Error('Failed to fetch Mapbox token');
        }

        mapboxgl.accessToken = data.token;

        // Initialize map
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [0, 20],
          zoom: 1.5,
          projection: 'globe' as any,
        });

        // Add navigation controls
        map.current.addControl(
          new mapboxgl.NavigationControl({
            visualizePitch: true,
          }),
          'top-right'
        );

        // Add fullscreen control
        map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

        // Add atmosphere
        map.current.on('style.load', () => {
          if (map.current) {
            map.current.setFog({
              color: 'rgb(10, 10, 20)',
              'high-color': 'rgb(30, 30, 50)',
              'horizon-blend': 0.1,
            });
          }
        });

        // Deduplicate venues by coordinates
        const venueMap = new Map<string, VenueGroup>();
        
        files.forEach(file => {
          if (!file.venue?.coordinates) return;
          
          const { lat, lng } = file.venue.coordinates;
          const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
          
          if (!venueMap.has(key)) {
            venueMap.set(key, {
              venue: file.venue,
              fileCount: 1,
              files: [file],
            });
          } else {
            const existing = venueMap.get(key)!;
            existing.fileCount++;
            existing.files.push(file);
          }
        });

        // Clear existing markers
        markers.current.forEach(marker => marker.remove());
        markers.current = [];

        // Add markers for each unique venue
        venueMap.forEach(({ venue, fileCount, files }) => {
          if (!venue.coordinates) return;

          const { lat, lng } = venue.coordinates;

          // Create custom marker element
          const el = document.createElement('div');
          el.className = 'custom-marker';
          el.style.width = '24px';
          el.style.height = '24px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = 'hsl(var(--primary))';
          el.style.border = '2px solid white';
          el.style.cursor = 'pointer';
          el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

          // Create popup content
          const popupContent = `
            <div style="padding: 8px; min-width: 200px;">
              <h3 style="font-weight: bold; margin-bottom: 4px; color: hsl(var(--foreground));">${venue.name}</h3>
              <p style="font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-bottom: 8px;">
                ${[venue.city, venue.state_region, venue.country].filter(Boolean).join(', ')}
              </p>
              <p style="font-size: 0.875rem; color: hsl(var(--muted-foreground));">
                <strong>${fileCount}</strong> file${fileCount !== 1 ? 's' : ''} available
              </p>
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

        setIsLoading(false);
        toast.success(`Map loaded with ${venueMap.size} venue locations`);
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to load map. Please check your connection.');
        setIsLoading(false);
        toast.error('Failed to initialize map');
      }
    };

    initMap();

    // Cleanup
    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      map.current?.remove();
    };
  }, [files]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded-lg border">
        <div className="text-center p-6">
          <p className="text-destructive font-medium mb-2">Map Error</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 rounded-lg">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading map...</span>
          </div>
        </div>
      )}
      <div ref={mapContainer} className="absolute inset-0 rounded-lg" />
    </div>
  );
};
