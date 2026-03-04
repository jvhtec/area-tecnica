import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Enter venue address",
  label = "Address",
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-google-maps-key');
        
        if (error) {
          console.error('Failed to fetch Google Maps API key:', error);
          setIsLoading(false);
          return;
        }
        
        if (data?.apiKey) {
          setApiKey(data.apiKey);
        }
      } catch (err) {
        console.error('Error fetching API key:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  // Initialize autocomplete with stable legacy Places binding.
  // Important: keep the React-controlled <Input> mounted so value always stays in sync with form state.
  useEffect(() => {
    if (!apiKey || !inputRef.current) return;

    const initLegacyAutocomplete = () => {
      if (!inputRef.current || !window.google?.maps?.places?.Autocomplete) return;

      // Clear previous listener bindings when effect re-runs.
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }

      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ['geocode'],
          fields: ['formatted_address', 'geometry', 'name'],
        }
      );

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        const address = place.formatted_address || place.name || inputRef.current?.value || '';
        const coordinates = place.geometry?.location ? {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        } : undefined;

        onChange(address, coordinates);
      });
    };

    const loadAutocomplete = () => {
      if (!window.google?.maps?.places?.Autocomplete) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = initLegacyAutocomplete;
        document.head.appendChild(script);
      } else {
        initLegacyAutocomplete();
      }
    };

    loadAutocomplete();

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [apiKey, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={className}>
      {label && <Label htmlFor="address-autocomplete">{label}</Label>}
      <div className="relative">
        <Input
          ref={inputRef}
          id="address-autocomplete"
          value={value}
          onChange={handleInputChange}
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
