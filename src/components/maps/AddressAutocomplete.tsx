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
  const autocompleteRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-google-maps-key');
        
        if (error) {
          console.error('Failed to fetch Google Maps API key:', error);
          return;
        }
        
        if (data?.apiKey) {
          setApiKey(data.apiKey);
        }
      } catch (err) {
        console.error('Error fetching API key:', err);
      }
    };

    fetchApiKey();
  }, []);

  // Initialize autocomplete with new Places API
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
        // Import the Places library
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary("places");
        
        // Create PlaceAutocompleteElement instead of legacy Autocomplete
        autocompleteRef.current = new PlaceAutocompleteElement();
        autocompleteRef.current.id = 'address-autocomplete';
        
        // Configure the autocomplete
        autocompleteRef.current.setAttribute('placeholder', placeholder);
        
        // Replace the input with the PlaceAutocompleteElement
        if (inputRef.current.parentNode) {
          inputRef.current.parentNode.replaceChild(autocompleteRef.current, inputRef.current);
        }

        // Listen for place selection
        autocompleteRef.current.addEventListener('gmp-placeselect', async (event) => {
          const place = event.target.place;
          
          if (!place.location) {
            console.log('No details available for input: ' + place.name);
            return;
          }

          // Fetch additional place details
          await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'location']
          });

          const coordinates = place.location ? {
            lat: place.location.lat(),
            lng: place.location.lng(),
          } : undefined;

          onChange(place.formattedAddress || place.displayName, coordinates);
        });

      } catch (error) {
        console.error('Error initializing autocomplete:', error);
        // Fallback to legacy API if new one fails
        initLegacyAutocomplete();
      }
    };

    const initLegacyAutocomplete = () => {
      if (!inputRef.current || !window.google) return;

      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ['establishment', 'geocode'],
          fields: ['formatted_address', 'geometry', 'name'],
        }
      );

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        
        if (place.formatted_address) {
          const coordinates = place.geometry?.location ? {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          } : undefined;

          onChange(place.formatted_address, coordinates);
        }
      });
    };

    loadAutocomplete();

    return () => {
      if (autocompleteRef.current) {
        (window.google?.maps?.event as any)?.clearInstanceListeners?.(autocompleteRef.current);
      }
    };
  }, [apiKey, onChange, placeholder]);

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