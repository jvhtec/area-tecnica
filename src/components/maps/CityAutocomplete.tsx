import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface CityAutocompleteProps {
  value: string;
  onChange: (city: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  id?: string;
  required?: boolean;
}

interface PredictionItem {
  place_id: string;
  name: string;
  formatted_address: string;
  coordinates?: { lat: number; lng: number };
}

export const CityAutocomplete: React.FC<CityAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Enter city name",
  label = "City",
  className,
  id = "city-autocomplete",
  required = false,
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<PredictionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const cacheRef = useRef<Record<string, PredictionItem[]>>({});

  // Keep local input in sync with external value
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Fetch Google Maps API key
  const fetchApiKey = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-google-maps-key');
      if (error) {
        console.error('Failed to fetch Google Maps API key:', error);
        return null;
      }
      if (data?.apiKey) {
        setApiKey(data.apiKey);
        return data.apiKey as string;
      }
    } catch (err) {
      console.error('Error fetching API key:', err);
    }
    return null;
  };

  useEffect(() => {
    fetchApiKey();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchCities = async (query: string) => {
    const trimmedQuery = query.trim();
    const key = apiKey || (await fetchApiKey());
    if (!key || !trimmedQuery || trimmedQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (cacheRef.current[trimmedQuery]) {
      setSuggestions(cacheRef.current[trimmedQuery]);
      setShowSuggestions(true);
      return;
    }

    setIsLoading(true);

    try {
      // Prefer Text Search (more reliable + includes coordinates), then fallback to Autocomplete
      let textSearchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
        },
        body: JSON.stringify({
          textQuery: trimmedQuery,
          includedType: 'locality',
          maxResultCount: 6,
          languageCode: 'es',
          regionCode: 'ES',
        }),
      });

      if (!textSearchRes.ok) {
        // Retry without includedType to avoid 400s from strict filters
        const errTxt = await textSearchRes.text().catch(() => '');
        console.warn('CityAutocomplete: Text Search error, retrying without includedType:', textSearchRes.status, errTxt);
        textSearchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
          },
          body: JSON.stringify({
            textQuery: trimmedQuery,
            maxResultCount: 6,
            languageCode: 'es',
            regionCode: 'ES',
          }),
        });
      }

      if (textSearchRes.ok) {
        const data = await textSearchRes.json();
        const results: PredictionItem[] = (data.places || []).map((p: any) => ({
          place_id: p.id,
          name: p.displayName?.text || p.formattedAddress || trimmedQuery,
          formatted_address: p.formattedAddress || '',
          coordinates: p.location
            ? { lat: p.location.latitude, lng: p.location.longitude }
            : undefined,
        }));

        if (results.length > 0) {
          cacheRef.current[trimmedQuery] = results;
          setSuggestions(results);
          setShowSuggestions(true);
          return;
        }
      }

      const requestBody = {
        input: trimmedQuery,
        maxResultCount: 6,
        languageCode: 'es',
        regionCode: 'ES',
      };

      // Use Places Autocomplete API - filter cities on client side
      const acRes = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        body: JSON.stringify(requestBody),
      });

      if (acRes.ok) {
        const data = await acRes.json();
        const results: PredictionItem[] = (data.suggestions || [])
          .filter((s: any) => s.placePrediction)
          .map((s: any) => ({
            place_id: s.placePrediction.placeId,
            name: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text,
            formatted_address: s.placePrediction.structuredFormat?.secondaryText?.text || '',
          }));
        cacheRef.current[trimmedQuery] = results;
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } else {
        const errorText = await acRes.text().catch(() => '');
        console.error('CityAutocomplete: Autocomplete API error:', acRes.status, errorText);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (e) {
      console.error('Error searching cities:', e);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getCityDetails = async (
    placeId: string,
    fallbackName: string,
    fallbackCoordinates?: { lat: number; lng: number }
  ) => {
    const key = apiKey || (await fetchApiKey());
    if (!key) {
      // Use fallback name if API key not available
      onChange(fallbackName, fallbackCoordinates);
      setInputValue(fallbackName);
      setShowSuggestions(false);
      return;
    }

    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents,location',
        },
      });

      if (!res.ok) throw new Error(`Place Details API error: ${res.status}`);

      const place = await res.json();

      // Extract clean city name from address components
      let cityName = place.displayName?.text || fallbackName;

      if (place.addressComponents) {
        const cityComponent = place.addressComponents.find((c: any) =>
          c.types.includes('locality') || c.types.includes('administrative_area_level_3')
        );
        const countryComponent = place.addressComponents.find((c: any) =>
          c.types.includes('country')
        );

        if (cityComponent) {
          cityName = cityComponent.longText;
          // Add country for non-Spanish cities
          if (countryComponent && countryComponent.shortText !== 'ES') {
            cityName = `${cityName}, ${countryComponent.longText}`;
          }
        }
      }

      // Extract coordinates if available
      const coordinates = place.location ? {
        lat: place.location.latitude,
        lng: place.location.longitude,
      } : undefined;

      onChange(cityName, coordinates ?? fallbackCoordinates);
      setInputValue(cityName);
      setShowSuggestions(false);
    } catch (err) {
      console.error('Error fetching city details:', err);
      // Use fallback on error
      onChange(fallbackName, fallbackCoordinates);
      setInputValue(fallbackName);
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    onChange(v); // Update parent state immediately for manual typing

    // Debounce API search
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => searchCities(v), 400);
  };

  const handleSelect = (item: PredictionItem) => {
    getCityDetails(item.place_id, item.name, item.coordinates);
  };

  return (
    <div className={className} ref={containerRef}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <Input
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pl-9"
          required={required}
          onKeyDown={(e) => {
            // Prevent form submission when pressing Enter
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onFocus={() => {
            if (!apiKey) fetchApiKey();
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
        />
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <Card className="absolute z-50 mt-1 w-full border-2 shadow-sm">
            <div className="max-h-64 overflow-auto py-1">
              {suggestions.map((s) => (
                <Button
                  key={s.place_id}
                  variant="ghost"
                  type="button"
                  className="w-full h-auto justify-start px-3 py-2 text-left"
                  onClick={() => handleSelect(s)}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-primary" />
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      {s.formatted_address && (
                        <div className="text-xs text-muted-foreground">{s.formatted_address}</div>
                      )}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
