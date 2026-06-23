import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createSessionToken,
  getMapboxToken,
  searchBoxRetrieve,
  searchBoxSuggest,
} from "@/lib/mapbox/mapboxClient";

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
  const [token, setToken] = useState<string | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const searchCache = useRef<Record<string, HotelPrediction[]>>({});
  const sessionTokenRef = useRef<string | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      const fetched = await getMapboxToken();
      if (fetched) setToken(fetched);
    };
    void fetchToken();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
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
    searchCache.current = {};
  };

  const searchHotels = async (query: string) => {
    const key = token || (await getMapboxToken());
    if (key && !token) setToken(key);
    if (!query || query.length < 2 || !key) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (searchCache.current[query]) {
      setSuggestions(searchCache.current[query]);
      setShowSuggestions(true);
      return;
    }

    setIsLoading(true);

    try {
      const suggestionsResult = await searchBoxSuggest(query, key, ensureSessionToken(), {
        language: 'es',
        types: 'poi',
        poiCategory: 'hotel,motel,hostel,lodging,bed_and_breakfast',
      });

      const hotelPredictions: HotelPrediction[] = suggestionsResult.map((suggestion) => ({
        place_id: suggestion.mapboxId,
        name: suggestion.name || suggestion.fullAddress,
        formatted_address: suggestion.fullAddress || '',
      }));

      setSuggestions(hotelPredictions);
      setShowSuggestions(hotelPredictions.length > 0);
      searchCache.current[query] = hotelPredictions;
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

    // Debounce search
    timeoutRef.current = setTimeout(() => {
      searchHotels(newValue);
    }, 500);
  };

  const getPlaceDetails = async (mapboxId: string, hotelName: string, fallbackAddress?: string) => {
    const key = token || (await getMapboxToken());
    if (!key) {
      onChange(hotelName, fallbackAddress);
      resetSessionToken();
      return;
    }

    try {
      const place = await searchBoxRetrieve(mapboxId, key, ensureSessionToken());
      onChange(
        place?.name || hotelName,
        place?.address || fallbackAddress,
        place?.coordinates,
      );
    } catch (error) {
      console.error('Error getting place details, using fallback:', error);
      onChange(hotelName, fallbackAddress);
    } finally {
      setShowSuggestions(false);
      resetSessionToken();
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
            {suggestions.map((hotel) => (
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
