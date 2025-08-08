import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PlaceAutocompleteResult {
  name: string;
  address: string;
  coordinates?: { lat: number; lng: number };
}

interface PlaceAutocompleteProps {
  value: string;
  onSelect: (result: PlaceAutocompleteResult) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export const PlaceAutocomplete: React.FC<PlaceAutocompleteProps> = ({
  value,
  onSelect,
  placeholder = 'Buscar lugar (establecimiento, venue, etc.)',
  label = 'Lugar',
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase.functions.invoke('get-secret', {
          body: { secretName: 'GOOGLE_MAPS_API_KEY' },
        });
        if (error) {
          console.error('Failed to fetch Google Maps API key:', error);
          return;
        }
        if (data?.GOOGLE_MAPS_API_KEY) {
          setApiKey(data.GOOGLE_MAPS_API_KEY);
        }
      } catch (err) {
        console.error('Error fetching API key:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;

    const loadAutocomplete = () => {
      if (!window.google) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = initAutocomplete;
        document.head.appendChild(script);
      } else {
        initAutocomplete();
      }
    };

    const initAutocomplete = async () => {
      if (!inputRef.current || !window.google) return;

      try {
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places' as any);
        autocompleteRef.current = new (PlaceAutocompleteElement as any)();
        autocompleteRef.current.id = 'place-autocomplete';
        autocompleteRef.current.setAttribute('placeholder', placeholder);
        // Prefer establishments and addresses
        autocompleteRef.current.setAttribute('types', 'establishment,geocode');

        if (inputRef.current.parentNode) {
          inputRef.current.parentNode.replaceChild(autocompleteRef.current, inputRef.current);
        }

        autocompleteRef.current.addEventListener('gmp-placeselect', async (event: any) => {
          const place = event.target.place;
          if (!place) return;

          try {
            await place.fetchFields({
              fields: ['displayName', 'formattedAddress', 'location'],
            });
          } catch (e) {
            console.warn('fetchFields failed, continuing with available data', e);
          }

          const coordinates = place.location
            ? { lat: place.location.lat(), lng: place.location.lng() }
            : undefined;

          onSelect({
            name: place.displayName || '',
            address: place.formattedAddress || '',
            coordinates,
          });
        });
      } catch (error) {
        console.error('Error initializing place autocomplete:', error);
        initLegacyAutocomplete();
      }
    };

    const initLegacyAutocomplete = () => {
      if (!inputRef.current || !window.google) return;
      // Legacy Autocomplete with establishment bias
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current as any, {
        types: ['establishment', 'geocode'],
        fields: ['name', 'formatted_address', 'geometry'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        const coordinates = place.geometry?.location
          ? { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }
          : undefined;
        onSelect({
          name: place.name || '',
          address: place.formatted_address || '',
          coordinates,
        });
      });
    };

    loadAutocomplete();

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [apiKey, onSelect, placeholder]);

  return (
    <div className={className}>
      {label && <Label htmlFor="place-autocomplete">{label}</Label>}
      <div className="relative">
        <Input
          ref={inputRef}
          id="place-autocomplete"
          value={value}
          onChange={() => { /* controlled by parent or selection; typing allowed before replacement */ }}
          placeholder={placeholder}
          className="pr-8"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <MapPin className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
};
