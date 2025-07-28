import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin } from 'lucide-react';

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
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
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