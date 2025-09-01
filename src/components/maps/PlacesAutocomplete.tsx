import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { PlacesAutocompleteProps, PlaceResultNormalized, PlacesSuggestion } from '@/types/places';
import { parseGooglePlaceResult, parseNewPlacesApiResult } from '@/utils/places/addressParser';

export const PlacesAutocomplete: React.FC<PlacesAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  label = "Location / Venue",
  placeholder = "Search address, venue or place…",
  required = false,
  initialPlaceId,
  types = ['establishment', 'geocode'],
  componentRestrictions = { country: ['ES'] },
  debounceMs = 200,
  minChars = 3,
  biasToProjectBounds,
  allowManual = false,
  className,
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<PlacesSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showManualOption, setShowManualOption] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const cacheRef = useRef<Record<string, PlacesSuggestion[]>>({});
  const placeDetailsCache = useRef<Record<string, PlaceResultNormalized>>({});

  // Keep local input in sync with external value
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-secret', {
          body: { secretName: 'GOOGLE_MAPS_API_KEY' },
        });
        if (error) {
          setError('Failed to load location services');
          console.error('Failed to fetch Google Maps API key:', error);
          return;
        }
        if (data?.GOOGLE_MAPS_API_KEY) {
          setApiKey(data.GOOGLE_MAPS_API_KEY);
          setError(null);
        }
      } catch (err) {
        setError('Failed to load location services');
        console.error('Error fetching API key:', err);
      }
    };
    fetchApiKey();
  }, []);

  // Handle initial place_id hydration
  useEffect(() => {
    if (initialPlaceId && apiKey && !placeDetailsCache.current[initialPlaceId]) {
      hydrateFromPlaceId(initialPlaceId);
    }
  }, [initialPlaceId, apiKey]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setShowManualOption(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hydrateFromPlaceId = async (placeId: string) => {
    if (!apiKey) return;
    
    try {
      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents',
        },
      });
      
      if (response.ok) {
        const place = await response.json();
        const result = parseNewPlacesApiResult(place);
        if (result) {
          placeDetailsCache.current[placeId] = result;
          setInputValue(result.formatted_address);
          onChange(result.formatted_address);
        }
      }
    } catch (error) {
      console.error('Error hydrating place:', error);
    }
  };

  const searchPlaces = useCallback(async (query: string) => {
    if (!apiKey || !query || query.length < minChars) {
      setSuggestions([]);
      setShowSuggestions(false);
      setShowManualOption(false);
      return;
    }

    // Check cache first
    if (cacheRef.current[query]) {
      setSuggestions(cacheRef.current[query]);
      setShowSuggestions(true);
      setShowManualOption(allowManual && cacheRef.current[query].length === 0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build request body
      const requestBody: any = {
        input: query,
        maxResultCount: 6,
      };

      if (types.length > 0) {
        requestBody.includedTypes = types;
      }

      if (componentRestrictions?.country) {
        requestBody.locationRestriction = {
          rectangle: {
            low: { latitude: 35.0, longitude: -10.0 },
            high: { latitude: 44.0, longitude: 5.0 }
          }
        };
      }

      if (biasToProjectBounds) {
        requestBody.locationBias = {
          rectangle: biasToProjectBounds
        };
      }

      const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Places API error: ${response.status}`);
      }

      const data = await response.json();
      const results: PlacesSuggestion[] = (data.suggestions || [])
        .filter((s: any) => s.placePrediction)
        .map((s: any) => ({
          place_id: s.placePrediction.placeId,
          name: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text,
          formatted_address: s.placePrediction.structuredFormat?.secondaryText?.text || '',
          types: s.placePrediction.types || [],
        }));

      cacheRef.current[query] = results;
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setShowManualOption(allowManual && results.length === 0);
    } catch (err) {
      console.error('Error searching places:', err);
      setError('Location search temporarily unavailable');
      setSuggestions([]);
      setShowSuggestions(false);
      setShowManualOption(allowManual);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, minChars, types, componentRestrictions, biasToProjectBounds, allowManual]);

  const getPlaceDetails = async (placeId: string, fallbackName: string, fallbackAddress?: string) => {
    // Check cache first
    if (placeDetailsCache.current[placeId]) {
      const cached = placeDetailsCache.current[placeId];
      onSelect?.(cached);
      setInputValue(cached.formatted_address);
      setShowSuggestions(false);
      onChange(cached.formatted_address);
      return;
    }

    if (!apiKey) {
      // Fallback to basic data without coordinates
      const basicResult: PlaceResultNormalized = {
        formatted_address: fallbackAddress || fallbackName,
        place_id: placeId,
        location: { lat: 0, lng: 0 }, // Invalid coords, should be handled by consumers
        name: fallbackName,
      };
      onSelect?.(basicResult);
      setInputValue(fallbackAddress || fallbackName);
      setShowSuggestions(false);
      onChange(fallbackAddress || fallbackName);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents',
        },
      });

      if (!response.ok) {
        throw new Error(`Place Details API error: ${response.status}`);
      }

      const place = await response.json();
      const result = parseNewPlacesApiResult(place, fallbackName);
      
      if (result) {
        // Cache the result
        placeDetailsCache.current[placeId] = result;
        onSelect?.(result);
        setInputValue(result.formatted_address);
        onChange(result.formatted_address);
      } else {
        throw new Error('Invalid place data received');
      }
    } catch (err) {
      console.error('Error fetching place details:', err);
      // Fallback to basic data
      const fallbackResult: PlaceResultNormalized = {
        formatted_address: fallbackAddress || fallbackName,
        place_id: placeId,
        location: { lat: 0, lng: 0 },
        name: fallbackName,
      };
      onSelect?.(fallbackResult);
      setInputValue(fallbackAddress || fallbackName);
      onChange(fallbackAddress || fallbackName);
    } finally {
      setIsLoading(false);
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    
    // Clear previous debounce
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    
    // Debounce the search
    debounceRef.current = window.setTimeout(() => {
      searchPlaces(newValue);
    }, debounceMs);
  };

  const handleSelect = (suggestion: PlacesSuggestion) => {
    getPlaceDetails(suggestion.place_id, suggestion.name, suggestion.formatted_address);
  };

  const handleManualConfirm = () => {
    if (inputValue.trim()) {
      // Create a manual entry (no coordinates or place_id)
      const manualResult: PlaceResultNormalized = {
        formatted_address: inputValue.trim(),
        place_id: '', // Empty for manual entries
        location: { lat: 0, lng: 0 }, // Invalid coords
        name: inputValue.trim(),
      };
      onSelect?.(manualResult);
      setShowSuggestions(false);
      setShowManualOption(false);
    }
  };

  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setShowManualOption(false);
    }
  };

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <Label htmlFor="places-autocomplete">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      
      <div className="relative">
        <Input
          id="places-autocomplete"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-9"
          required={required}
        />
        
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        {error && !apiKey && (
          <div className="mt-1 text-sm text-destructive">
            {error}. {allowManual ? 'Manual entry enabled.' : ''}
          </div>
        )}

        {((showSuggestions && suggestions.length > 0) || showManualOption) && (
          <Card className="absolute z-50 mt-1 w-full border shadow-lg">
            <div className="max-h-64 overflow-auto py-1">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion.place_id}
                  variant="ghost"
                  className="w-full h-auto justify-start px-3 py-2 text-left"
                  onClick={() => handleSelect(suggestion)}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{suggestion.name}</div>
                      {suggestion.formatted_address && (
                        <div className="text-xs text-muted-foreground truncate">
                          {suggestion.formatted_address}
                        </div>
                      )}
                    </div>
                  </div>
                </Button>
              ))}
              
              {showManualOption && (
                <Button
                  variant="ghost"
                  className="w-full h-auto justify-start px-3 py-2 text-left border-t"
                  onClick={handleManualConfirm}
                >
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">Use this exact text</div>
                      <div className="text-xs text-muted-foreground truncate">
                        "{inputValue}"
                      </div>
                    </div>
                  </div>
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
