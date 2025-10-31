import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

type PlaceSearchResponse = {
  suggestions?: PredictionItem[];
};

type PlaceDetailsResponse = {
  place?: {
    place_id?: string;
    name?: string;
    formatted_address?: string;
    coordinates?: { lat: number; lng: number };
  };
};

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
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const cacheRef = useRef<Record<string, PredictionItem[]>>({});

  // Keep local input in sync with external value
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchPlaces = async (query: string) => {
    if (!query || query.length < 2) {
      console.log('PlacesAutocomplete: Search conditions not met:', { query, queryLength: query?.length || 0 });
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    console.log('PlacesAutocomplete: Searching for:', query);

    if (cacheRef.current[query]) {
      console.log('PlacesAutocomplete: Using cached results for:', query);
      setSuggestions(cacheRef.current[query]);
      setShowSuggestions(true);
      return;
    }

    setIsLoading(true);
    onBusyChange?.(true);
    console.log('PlacesAutocomplete: Starting API search...');

    try {
      const { data, error } = await supabase.functions.invoke<PlaceSearchResponse>('place-search', {
        body: { type: 'search', query },
      });

      if (error) {
        console.error('PlacesAutocomplete: place-search function error:', error);
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const suggestions: PredictionItem[] = Array.isArray(data?.suggestions) ? data.suggestions : [];
      console.log('PlacesAutocomplete: Received suggestions from edge function:', suggestions);

      cacheRef.current[query] = suggestions;
      setSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (e) {
      console.error('Error searching places:', e);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
      onBusyChange?.(false);
    }
  };

  const getPlaceDetails = async (placeId: string, fallbackName: string, fallbackAddress?: string) => {
    console.log('PlacesAutocomplete: Getting place details for:', { placeId, fallbackName, fallbackAddress });
    
    try {
      onBusyChange?.(true);
      const { data, error } = await supabase.functions.invoke<PlaceDetailsResponse>('place-search', {
        body: { type: 'details', placeId },
      });

      if (error) {
        console.error('PlacesAutocomplete: place-search details error:', error);
        throw error;
      }

      const place = data?.place;
      console.log('PlacesAutocomplete: Place details data from edge function:', place);

      const result: PlaceAutocompleteResult = {
        name: place?.name || fallbackName,
        address: place?.formatted_address || fallbackAddress || '',
        coordinates: place?.coordinates,
        place_id: place?.place_id || placeId,
      };

      console.log('PlacesAutocomplete: Calling onSelect with:', result);
      onSelect(result);
      setInputValue(result.name);
      setShowSuggestions(false);
    } catch (err) {
      console.error('Error fetching place details:', err);
      const fallbackResult = { name: fallbackName, address: fallbackAddress || '', place_id: placeId };
      console.log('PlacesAutocomplete: Using fallback result:', fallbackResult);
      onSelect(fallbackResult);
      setInputValue(fallbackName);
      setShowSuggestions(false);
    } finally {
      onBusyChange?.(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    console.log('PlacesAutocomplete: Input changed:', v);
    setInputValue(v);
    onInputChange?.(v);
    // Debounce
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => searchPlaces(v), 400);
  };

  const handleSelect = (item: PredictionItem) => {
    console.log('PlacesAutocomplete: Item selected:', item);
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
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
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
