import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';
import {
  createSessionToken,
  getMapboxToken,
  searchBoxRetrieve,
  searchBoxSuggest,
} from '@/lib/mapbox/mapboxClient';

interface PlaceAutocompleteResult {
  name: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  place_id?: string;
}

interface PlaceAutocompleteProps {
  value: string;
  onSelect: (result: PlaceAutocompleteResult) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  onBusyChange?: (busy: boolean) => void;
  onInputChange?: (value: string) => void;
}

interface PredictionItem {
  place_id: string;
  name: string;
  formatted_address: string;
}

export const PlaceAutocomplete: React.FC<PlaceAutocompleteProps> = ({
  value,
  onSelect,
  placeholder = 'Buscar lugar (establecimiento, venue, etc.)',
  label = 'Lugar',
  className,
  onBusyChange,
  onInputChange,
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<PredictionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const cacheRef = useRef<Record<string, PredictionItem[]>>({});
  const sessionTokenRef = useRef<string | null>(null);

  // Keep local input in sync with external value
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const fetchToken = async (): Promise<string | null> => {
    if (token) return token;
    const fetched = await getMapboxToken();
    if (fetched) setToken(fetched);
    return fetched;
  };

  useEffect(() => {
    void fetchToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const ensureSessionToken = () => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = createSessionToken();
    }
    return sessionTokenRef.current;
  };

  const resetSessionToken = () => {
    sessionTokenRef.current = null;
    // Mapbox requires the retrieve call to reuse the suggest session token, so
    // drop cached suggestions tied to the old session.
    cacheRef.current = {};
  };

  const searchPlaces = async (query: string) => {
    const key = token || (await fetchToken());
    if (!key || !query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (cacheRef.current[query]) {
      setSuggestions(cacheRef.current[query]);
      setShowSuggestions(true);
      return;
    }

    setIsLoading(true);
    onBusyChange?.(true);

    try {
      const suggestionsResult = await searchBoxSuggest(query, key, ensureSessionToken(), {
        language: 'es',
        types: 'poi,address,place,street',
      });

      const results: PredictionItem[] = suggestionsResult.map((suggestion) => ({
        place_id: suggestion.mapboxId,
        name: suggestion.name || suggestion.fullAddress,
        formatted_address: suggestion.fullAddress || '',
      }));

      cacheRef.current[query] = results;
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (e) {
      console.error('Error searching places:', e);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
      onBusyChange?.(false);
    }
  };

  const getPlaceDetails = async (mapboxId: string, fallbackName: string, fallbackAddress?: string) => {
    const key = token || (await fetchToken());
    if (!key) {
      onSelect({ name: fallbackName, address: fallbackAddress || '', place_id: mapboxId });
      resetSessionToken();
      return;
    }

    try {
      onBusyChange?.(true);
      const place = await searchBoxRetrieve(mapboxId, key, ensureSessionToken());

      const result: PlaceAutocompleteResult = {
        name: place?.name || fallbackName,
        address: place?.address || fallbackAddress || '',
        coordinates: place?.coordinates,
        place_id: mapboxId,
      };

      onSelect(result);
      setInputValue(result.name);
      setShowSuggestions(false);
    } catch (err) {
      console.error('Error fetching place details:', err);
      const fallbackResult = { name: fallbackName, address: fallbackAddress || '', place_id: mapboxId };
      onSelect(fallbackResult);
      setInputValue(fallbackName);
      setShowSuggestions(false);
    } finally {
      onBusyChange?.(false);
      resetSessionToken();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    onInputChange?.(v);
    // Debounce
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => searchPlaces(v), 400);
  };

  const handleSelect = (item: PredictionItem) => {
    getPlaceDetails(item.place_id, item.name, item.formatted_address);
  };

  return (
    <div className={className} ref={containerRef}>
      {label && <Label htmlFor="place-autocomplete">{label}</Label>}
      <div className="relative">
        <Input
          id="place-autocomplete"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pl-9"
          onKeyDown={(e) => {
            // Prevent form submission when pressing Enter inside the autocomplete
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onFocus={() => { if (!token) { void fetchToken(); } if (suggestions.length > 0) setShowSuggestions(true); }}
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
