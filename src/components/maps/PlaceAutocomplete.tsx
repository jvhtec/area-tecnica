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

  // Fetch Google Maps API key securely (with retry support)
  const fetchApiKey = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-secret', {
        body: { secretName: 'GOOGLE_MAPS_API_KEY' },
      });
      if (error) {
        console.error('Failed to fetch Google Maps API key:', error);
        return null;
      }
      if (data?.GOOGLE_MAPS_API_KEY) {
        setApiKey(data.GOOGLE_MAPS_API_KEY);
        return data.GOOGLE_MAPS_API_KEY as string;
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

  const searchPlaces = async (query: string) => {
    // Ensure API key is available (retry on demand)
    const key = apiKey || (await fetchApiKey());
    if (!key || !query || query.length < 2) {
      console.log('PlacesAutocomplete: Search conditions not met:', { hasApiKey: !!key, query, queryLength: query?.length || 0 });
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
    console.log('PlacesAutocomplete: Starting API search...');

    try {
      // Try Places Text Search first (good for establishments)
      console.log('PlacesAutocomplete: Trying text search...');
      const textSearchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 6,
        }),
      });

      console.log('PlacesAutocomplete: Text search response status:', textSearchRes.status);

      if (textSearchRes.ok) {
        const data = await textSearchRes.json();
        console.log('PlacesAutocomplete: Text search data:', data);
        if (data.places && data.places.length > 0) {
          const results: PredictionItem[] = data.places.map((p: any) => ({
            place_id: p.id,
            name: p.displayName?.text || p.formattedAddress,
            formatted_address: p.formattedAddress || '',
          }));
          console.log('PlacesAutocomplete: Text search results:', results);
          cacheRef.current[query] = results;
          setSuggestions(results);
          setShowSuggestions(true);
          setIsLoading(false);
          return;
        }
      }

      // Fallback to Autocomplete API for broader matches (establishments + addresses)
      console.log('PlacesAutocomplete: Trying autocomplete...');
      const acRes = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
          body: JSON.stringify({
            input: query,
            maxResultCount: 6,
          }),
      });

      console.log('PlacesAutocomplete: Autocomplete response status:', acRes.status);

      if (acRes.ok) {
        const data = await acRes.json();
        console.log('PlacesAutocomplete: Autocomplete data:', data);
        const results: PredictionItem[] = (data.suggestions || [])
          .filter((s: any) => s.placePrediction)
          .map((s: any) => ({
            place_id: s.placePrediction.placeId,
            name: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text,
            formatted_address: s.placePrediction.structuredFormat?.secondaryText?.text || '',
          }));
        console.log('PlacesAutocomplete: Autocomplete results:', results);
        cacheRef.current[query] = results;
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } else {
        console.error('Places Autocomplete API error:', acRes.status);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (e) {
      console.error('Error searching places:', e);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getPlaceDetails = async (placeId: string, fallbackName: string, fallbackAddress?: string) => {
    console.log('PlacesAutocomplete: Getting place details for:', { placeId, fallbackName, fallbackAddress });
    
    const key = apiKey || (await fetchApiKey());
    if (!key) {
      console.log('PlacesAutocomplete: No API key after retry, using fallback data');
      onSelect({ name: fallbackName, address: fallbackAddress || '', place_id: placeId });
      return;
    }
    
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
        },
      });
      
      console.log('PlacesAutocomplete: Place details response status:', res.status);
      
      if (!res.ok) throw new Error(`Place Details API error: ${res.status}`);
      
      const place = await res.json();
      console.log('PlacesAutocomplete: Place details data:', place);
      
      const coordinates = place.location
        ? { lat: place.location.latitude, lng: place.location.longitude }
        : undefined;
        
      const result: PlaceAutocompleteResult = {
        name: place.displayName?.text || fallbackName,
        address: place.formattedAddress || fallbackAddress || '',
        coordinates,
        place_id: placeId,
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
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    console.log('PlacesAutocomplete: Input changed:', v);
    setInputValue(v);
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
          onFocus={() => { if (!apiKey) { fetchApiKey(); } if (suggestions.length > 0) setShowSuggestions(true); }}
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
