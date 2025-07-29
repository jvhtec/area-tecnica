import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, MapPin } from 'lucide-react';

interface GoogleMapProps {
  address?: string;
  coordinates?: { lat: number; lng: number };
  height?: string;
  onLocationSelect?: (coordinates: { lat: number; lng: number }, address: string) => void;
  showMarker?: boolean;
  interactive?: boolean;
  onStaticMapUrlChange?: (url: string) => void;
}

declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
  }
}

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await fetch('https://syldobdcdsgfgjtbuwxm.supabase.co/functions/v1/get-secret', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bGRvYmRjZHNnZmdqdGJ1d3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5NDE1ODcsImV4cCI6MjA1MTUxNzU4N30.iLtE6_xC0FE21JKzy77UPAvferh4l1WeLvvVCn15YJc`
          },
          body: JSON.stringify({ secretName: 'GOOGLE_MAPS_API_KEY' })
        });
        
        const data = await response.json();
        if (data.GOOGLE_MAPS_API_KEY) {
          setApiKey(data.GOOGLE_MAPS_API_KEY);
        } else {
          setError('Google Maps API key not found');
        }
      } catch (err) {
        setError('Failed to fetch Google Maps API key');
        console.error('Error fetching API key:', err);
      }
    };

    fetchApiKey();
  }, []);

  // Load Google Maps script
  useEffect(() => {
    if (!apiKey) return;

    const loadGoogleMaps = () => {
      if (window.google) {
        initializeMap();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      
      window.initGoogleMaps = initializeMap;
      script.onload = initializeMap;
      script.onerror = () => setError('Failed to load Google Maps');
      
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, [apiKey]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      initializeMap();
    }
  }, [address, coordinates]);

  const initializeMap = async () => {
    if (!mapRef.current || !window.google) return;

    try {
      setIsLoading(true);

      let center = { lat: 40.4168, lng: -3.7038 }; // Default to Madrid
      
      // If we have coordinates, use them
      if (coordinates) {
        center = coordinates;
      } else if (address) {
        // Geocode the address
        const geocoder = new window.google.maps.Geocoder();
        try {
          const result = await new Promise<any>((resolve, reject) => {
            geocoder.geocode({ address }, (results: any[], status: string) => {
              if (status === 'OK' && results[0]) {
                resolve(results[0]);
              } else {
                reject(new Error(`Geocoding failed: ${status}`));
              }
            });
          });
          
          center = {
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
          };
        } catch (geocodeError) {
          console.warn('Geocoding failed, using default location');
        }
      }

      // Generate static map URL
      if (onStaticMapUrlChange && apiKey) {
        const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center.lat},${center.lng}&zoom=15&size=600x300&maptype=roadmap&markers=color:red%7C${center.lat},${center.lng}&key=${apiKey}`;
        onStaticMapUrlChange(staticMapUrl);
      }

      const mapOptions = {
        center,
        zoom: 15,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        disableDefaultUI: !interactive,
        zoomControl: interactive,
        scrollwheel: interactive,
        draggable: interactive,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      };

      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, mapOptions);

      // Add marker if requested
      if (showMarker) {
        markerRef.current = new window.google.maps.Marker({
          position: center,
          map: mapInstanceRef.current,
          draggable: interactive && !!onLocationSelect,
          title: address || 'Venue Location',
        });

        // Handle marker drag
        if (interactive && onLocationSelect) {
          markerRef.current.addListener('dragend', () => {
            const position = markerRef.current.getPosition();
            const coords = {
              lat: position.lat(),
              lng: position.lng(),
            };
            
            // Reverse geocode to get address
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: coords }, (results: any[], status: string) => {
              if (status === 'OK' && results[0]) {
                onLocationSelect(coords, results[0].formatted_address);
              } else {
                onLocationSelect(coords, `${coords.lat}, ${coords.lng}`);
              }
            });
          });
        }
      }

      // Handle map clicks for location selection
      if (interactive && onLocationSelect) {
        mapInstanceRef.current.addListener('click', (event: any) => {
          const coords = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          };

          // Update marker position
          if (markerRef.current) {
            markerRef.current.setPosition(coords);
          }

          // Reverse geocode to get address
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: coords }, (results: any[], status: string) => {
            if (status === 'OK' && results[0]) {
              onLocationSelect(coords, results[0].formatted_address);
            } else {
              onLocationSelect(coords, `${coords.lat}, ${coords.lng}`);
            }
          });
        });
      }

      setIsLoading(false);
    } catch (err) {
      setError('Failed to initialize map');
      setIsLoading(false);
      console.error('Map initialization error:', err);
    }
  };

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
              <span className="text-sm">Loading map...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
