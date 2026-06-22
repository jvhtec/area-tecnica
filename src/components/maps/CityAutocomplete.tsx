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
  };

  const searchCities = async (query: string) => {
    const trimmedQuery = query.trim();
    const key = token || (await fetchToken());
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
      const suggestionsResult = await searchBoxSuggest(trimmedQuery, key, ensureSessionToken(), {
        language: 'es',
        types: 'city,place,locality',
      });

      const results: PredictionItem[] = suggestionsResult.map((suggestion) => ({
        place_id: suggestion.mapboxId,
        name: suggestion.name || trimmedQuery,
        formatted_address: suggestion.fullAddress || '',
      }));

      cacheRef.current[trimmedQuery] = results;
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (e) {
      console.error('Error searching cities:', e);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getCityDetails = async (mapboxId: string, fallbackName: string) => {
    const key = token || (await fetchToken());
    if (!key) {
      onChange(fallbackName);
      setInputValue(fallbackName);
      setShowSuggestions(false);
      resetSessionToken();
      return;
    }

    try {
      const place = await searchBoxRetrieve(mapboxId, key, ensureSessionToken());
      const cityName = place?.name || fallbackName;
      onChange(cityName, place?.coordinates);
      setInputValue(cityName);
      setShowSuggestions(false);
    } catch (err) {
      console.error('Error fetching city details:', err);
      onChange(fallbackName);
      setInputValue(fallbackName);
      setShowSuggestions(false);
    } finally {
      resetSessionToken();
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
    getCityDetails(item.place_id, item.name);
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
            if (!token) void fetchToken();
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
