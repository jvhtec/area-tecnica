import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Building, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { rateLimiter, apiCache } from "@/lib/rate-limiter";

// Remove conflicting global type declaration - using typed definitions from src/types/google-maps.d.ts

interface HotelAutocompleteProps {
  value: string;
  checkIn: string;
  checkOut: string;
  onChange: (hotelName: string, address?: string, coordinates?: { lat: number; lng: number }) => void;
  onCheckInChange: (date: string) => void;
  onCheckOutChange: (date: string) => void;
  placeholder?: string;
  className?: string;
}

interface HotelPrediction {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  types: string[];
}

export const HotelAutocomplete: React.FC<HotelAutocompleteProps> = ({
  value,
  checkIn,
  checkOut,
  onChange,
  onCheckInChange,
  onCheckOutChange,
  placeholder = "Buscar hotel...",
  className
}) => {
  const [suggestions, setSuggestions] = useState<HotelPrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const searchCache = useRef<Record<string, HotelPrediction[]>>({});

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-google-maps-key');
        
        if (error) {
          console.error('Failed to fetch Google Maps API key:', error);
          return;
        }
        
        console.log('API key response:', data);
        
        if (data?.apiKey) {
          setApiKey(data.apiKey);
          console.log('Google Maps API key loaded for hotel autocomplete');
        } else {
          console.error('No Google Maps API key found in response:', data);
        }
      } catch (err) {
        console.error('Error fetching API key:', err);
      }
    };

    fetchApiKey();
  }, []);

  // Load Google Maps script is not needed for new Places API
  useEffect(() => {
    if (apiKey) {
      setIsApiLoaded(true);
      console.log('Google Places API (New) ready for hotel autocomplete');
    }
  }, [apiKey]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchHotels = async (query: string) => {
    if (!query || query.length < 2 || !isApiLoaded || !apiKey) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Check memory cache
    if (searchCache.current[query]) {
      setSuggestions(searchCache.current[query]);
      setShowSuggestions(true);
      return;
    }

    // Check persistent cache
    const cacheKey = `hotel-autocomplete:${query.toLowerCase().trim()}`;
    const cached = apiCache.get(cacheKey);
    if (cached) {
      console.log('HotelAutocomplete: Using persistent cached results');
      searchCache.current[query] = cached;
      setSuggestions(cached);
      setShowSuggestions(true);
      return;
    }

    setIsLoading(true);

    try {
      // First, try the more specific Text Search
      if (rateLimiter.canMakeRequest('text-search')) {
        rateLimiter.recordRequest('text-search');
        let searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types'
          },
          body: JSON.stringify({
            textQuery: query,
            includedType: "lodging",
            maxResultCount: 4 // Reduced from 5
          })
        });

        if (!searchResponse.ok) {
          // Retry without includedType to avoid 400s from strict filters
          const errTxt = await searchResponse.text().catch(() => '');
          console.warn('Text Search error, retrying without includedType:', searchResponse.status, errTxt);
          searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types'
            },
            body: JSON.stringify({
              textQuery: query,
              maxResultCount: 4 // Reduced from 5
            })
          });
        }

        if (searchResponse.ok) {
          const data = await searchResponse.json();
          if (data.places && data.places.length > 0) {
            const hotelPredictions = data.places.map((place: any) => ({
              place_id: place.id,
              name: place.displayName?.text || place.formattedAddress,
              formatted_address: place.formattedAddress,
              rating: place.rating,
              types: place.types || ['lodging'],
              location: place.location
            }));
            setSuggestions(hotelPredictions);
            setShowSuggestions(true);
            searchCache.current[query] = hotelPredictions;
            apiCache.set(cacheKey, hotelPredictions);
            return;
          }
        }
      } else {
        console.warn('HotelAutocomplete: Text search rate limit reached');
      }

      // If Text Search fails or returns no results, fallback to Autocomplete
      if (rateLimiter.canMakeRequest('autocomplete')) {
        console.log('Fallback to autocomplete for:', query);
        rateLimiter.recordRequest('autocomplete');
        let autocompleteResponse = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat'
          },
          body: JSON.stringify({
            input: query,
            includedPrimaryTypes: ['lodging'],
            maxResultCount: 4 // Reduced from 5
          })
        });

        if (!autocompleteResponse.ok) {
          const txt = await autocompleteResponse.text().catch(() => '');
          console.warn('Autocomplete API error with lodging filter, retrying without filter:', autocompleteResponse.status, txt);
          // Retry without includedPrimaryTypes if API rejects the filter
          autocompleteResponse = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat'
            },
            body: JSON.stringify({
              input: query,
              maxResultCount: 4 // Reduced from 5
            })
          });
        }

        if (autocompleteResponse.ok) {
          const data = await autocompleteResponse.json();
          if (data.suggestions) {
            const hotelPredictions = data.suggestions
              .filter((s: any) => s.placePrediction)
              .map((s: any) => ({
                place_id: s.placePrediction.placeId,
                name: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text,
                formatted_address: s.placePrediction.structuredFormat?.secondaryText?.text || '',
                types: ['lodging']
              }));
            setSuggestions(hotelPredictions);
            setShowSuggestions(hotelPredictions.length > 0);
            searchCache.current[query] = hotelPredictions;
            apiCache.set(cacheKey, hotelPredictions);
          }
        } else {
          const txt = await autocompleteResponse.text().catch(() => '');
          throw new Error(`Autocomplete API error: ${autocompleteResponse.status} ${txt}`);
        }
      } else {
        console.warn('HotelAutocomplete: Autocomplete rate limit reached');
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error searching hotels:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce search - increased to 800ms to reduce API calls
    timeoutRef.current = setTimeout(() => {
      searchHotels(newValue);
    }, 800);
  };

  const getPlaceDetails = async (placeId: string, hotelName: string, fallbackAddress?: string) => {
    if (!isApiLoaded || !apiKey) {
      console.error('Google Places API (New) not ready');
      onChange(hotelName, fallbackAddress);
      return;
    }

    // Check cache first
    const cacheKey = `hotel-place-details:${placeId}`;
    const cached = apiCache.get(cacheKey);
    if (cached) {
      console.log('HotelAutocomplete: Using cached place details');
      onChange(cached.name, cached.address, cached.coordinates);
      setShowSuggestions(false);
      return;
    }

    // Check rate limit
    if (!rateLimiter.canMakeRequest('place-details')) {
      console.warn('HotelAutocomplete: Place details rate limit reached, using fallback');
      onChange(hotelName, fallbackAddress);
      setShowSuggestions(false);
      return;
    }

    try {
      rateLimiter.recordRequest('place-details');
      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location'
        }
      });

      if (!response.ok) throw new Error(`Place Details API error: ${response.status}`);

      const place = await response.json();
      const coordinates = place.location ? { lat: place.location.latitude, lng: place.location.longitude } : undefined;

      const result = {
        name: place.displayName?.text || hotelName,
        address: place.formattedAddress || fallbackAddress,
        coordinates
      };

      // Cache the result
      apiCache.set(cacheKey, result);

      onChange(result.name, result.address, result.coordinates);
    } catch (error) {
      console.error('Error getting place details, using fallback:', error);
      onChange(hotelName, fallbackAddress);
    } finally {
      setShowSuggestions(false);
    }
  };

  const handleSelectHotel = (hotel: HotelPrediction) => {
    getPlaceDetails(hotel.place_id, hotel.name, hotel.formatted_address);
  };

  return (
    <div className="relative" ref={inputRef}>
      <div className="flex gap-2">
        <div className="relative flex-grow">
          <Input
            value={value}
            onChange={handleInputChange}
            placeholder={placeholder}
            className={cn("pl-10", className)}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
          />
          <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
        <Input
          type="datetime-local"
          value={checkIn}
          onChange={(e) => onCheckInChange(e.target.value)}
          className="w-48"
        />
        <Input
          type="datetime-local"
          value={checkOut}
          onChange={(e) => onCheckOutChange(e.target.value)}
          className="w-48"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 shadow-lg border-2">
          <div className="max-h-60 overflow-y-auto">
            {suggestions.map((hotel, index) => (
              <Button
                key={hotel.place_id}
                variant="ghost"
                className="w-full justify-start p-3 h-auto text-left hover:bg-gray-50"
                onClick={() => handleSelectHotel(hotel)}
              >
                <div className="flex items-start gap-3 w-full">
                  <Building className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {hotel.name}
                      {hotel.rating && (
                        <span className="ml-2 text-yellow-500">
                          ⭐ {hotel.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {hotel.formatted_address}
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
