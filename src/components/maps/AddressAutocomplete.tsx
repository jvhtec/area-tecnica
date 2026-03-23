import React, { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  id?: string;
}

interface PredictionItem {
  place_id: string;
  name: string;
  formatted_address: string;
}

const ADDRESS_PRIMARY_TYPES = ['geocode', 'street_address', 'route', 'premise', 'subpremise'] as const;

const createSessionToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 14);
};

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Enter venue address',
  label = 'Address',
  className,
  id,
}) => {
  const generatedId = useId();
  const inputId = id ?? `address-autocomplete-${generatedId}`;
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<PredictionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const cacheRef = useRef<Record<string, PredictionItem[]>>({});
  const sessionTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

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
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const ensureSessionToken = () => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = createSessionToken();
    }

    return sessionTokenRef.current;
  };

  const resetSessionToken = () => {
    sessionTokenRef.current = null;
  };

  const searchAddresses = async (query: string) => {
    const trimmedQuery = query.trim();
    const key = apiKey || (await fetchApiKey());

    if (!key || trimmedQuery.length < 2) {
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
      const requestBody = {
        input: trimmedQuery,
        maxResultCount: 6,
        languageCode: 'es',
        sessionToken: ensureSessionToken(),
        includedPrimaryTypes: [...ADDRESS_PRIMARY_TYPES],
      };

      let autocompleteResponse = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        body: JSON.stringify(requestBody),
      });

      if (!autocompleteResponse.ok) {
        const errorText = await autocompleteResponse.text().catch(() => '');
        console.warn('AddressAutocomplete: filtered autocomplete failed, retrying without type filters:', autocompleteResponse.status, errorText);

        autocompleteResponse = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
          },
          body: JSON.stringify({
            input: trimmedQuery,
            maxResultCount: 6,
            languageCode: 'es',
            sessionToken: ensureSessionToken(),
          }),
        });
      }

      if (!autocompleteResponse.ok) {
        const errorText = await autocompleteResponse.text().catch(() => '');
        throw new Error(`Autocomplete API error: ${autocompleteResponse.status} ${errorText}`);
      }

      const data = await autocompleteResponse.json();
      const results: PredictionItem[] = (data.suggestions || [])
        .filter((suggestion: any) => suggestion.placePrediction)
        .map((suggestion: any) => ({
          place_id: suggestion.placePrediction.placeId,
          name: suggestion.placePrediction.structuredFormat?.mainText?.text || suggestion.placePrediction.text?.text || trimmedQuery,
          formatted_address: suggestion.placePrediction.structuredFormat?.secondaryText?.text || '',
        }));

      cacheRef.current[trimmedQuery] = results;
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('Error searching addresses:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getAddressDetails = async (
    placeId: string,
    fallbackName: string,
    fallbackAddress?: string
  ) => {
    const key = apiKey || (await fetchApiKey());

    if (!key) {
      const address = fallbackAddress || fallbackName;
      onChange(address);
      setInputValue(address);
      setShowSuggestions(false);
      resetSessionToken();
      return;
    }

    try {
      const requestUrl = new URL(`https://places.googleapis.com/v1/places/${placeId}`);
      requestUrl.searchParams.set('sessionToken', ensureSessionToken());

      const response = await fetch(requestUrl.toString(), {
        headers: {
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'id,formattedAddress,location,displayName',
        },
      });

      if (!response.ok) {
        throw new Error(`Place Details API error: ${response.status}`);
      }

      const place = await response.json();
      const coordinates = place.location
        ? {
            lat: place.location.latitude,
            lng: place.location.longitude,
          }
        : undefined;
      const address = place.formattedAddress || fallbackAddress || place.displayName?.text || fallbackName;

      onChange(address, coordinates);
      setInputValue(address);
      setShowSuggestions(false);
    } catch (error) {
      console.error('Error fetching address details:', error);
      const address = fallbackAddress || fallbackName;
      onChange(address);
      setInputValue(address);
      setShowSuggestions(false);
    } finally {
      resetSessionToken();
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setInputValue(nextValue);
    onChange(nextValue);

    if (!nextValue.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      resetSessionToken();
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      searchAddresses(nextValue);
    }, 400);
  };

  const handleSelect = (item: PredictionItem) => {
    getAddressDetails(item.place_id, item.name, item.formatted_address);
  };

  return (
    <div className={className} ref={containerRef}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <div className="relative">
        <Input
          id={inputId}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pl-9"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onFocus={() => {
            if (!apiKey) {
              fetchApiKey();
            }

            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
        />
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <Card className="absolute z-50 mt-1 w-full border-2 shadow-sm">
            <div className="max-h-64 overflow-auto py-1">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion.place_id}
                  variant="ghost"
                  type="button"
                  className="h-auto w-full justify-start px-3 py-2 text-left"
                  onClick={() => handleSelect(suggestion)}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <div className="text-sm font-medium">{suggestion.name}</div>
                      {suggestion.formatted_address && (
                        <div className="text-xs text-muted-foreground">{suggestion.formatted_address}</div>
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
