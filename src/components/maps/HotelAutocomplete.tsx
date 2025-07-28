import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Building, Star } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google: any;
  }
}

interface HotelAutocompleteProps {
  value: string;
  onChange: (hotelName: string, address?: string, coordinates?: { lat: number; lng: number }) => void;
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
  onChange,
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
          console.log('Google Maps API key loaded for hotel autocomplete');
        } else {
          console.error('No Google Maps API key found');
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
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (!isApiLoaded || !apiKey) {
      console.error('Google Places API (New) not ready');
      return;
    }

    setIsLoading(true);
    
    try {
      // Use the new Google Places API (Text Search)
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types'
        },
        body: JSON.stringify({
          textQuery: `${query} hotel`,
          locationBias: {
            circle: {
              center: {
                latitude: 40.4168, // Spain center coordinates
                longitude: -3.7038
              },
              radius: 500000.0
            }
          },
          maxResultCount: 5,
          includedType: 'lodging'
        })
      });

      if (!response.ok) {
        throw new Error(`Places API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Hotel search results (New API):', data);

      if (data.places) {
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
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error searching hotels with new API:', error);
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
    }, 300);
  };

  const getPlaceDetails = async (placeId: string, hotelName: string) => {
    if (!isApiLoaded || !apiKey) {
      console.error('Google Places API (New) not ready');
      onChange(hotelName);
      return;
    }

    try {
      // Use the new Google Places API (Place Details)
      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating'
        }
      });

      if (!response.ok) {
        throw new Error(`Place Details API error: ${response.status}`);
      }

      const place = await response.json();
      console.log('Hotel details (New API):', place);

      const coordinates = place.location 
        ? {
            lat: place.location.latitude,
            lng: place.location.longitude
          }
        : undefined;

      onChange(
        place.displayName?.text || hotelName,
        place.formattedAddress,
        coordinates
      );
    } catch (error) {
      console.error('Error getting place details with new API:', error);
      onChange(hotelName);
    } finally {
      setShowSuggestions(false);
    }
  };

  const handleSelectHotel = (hotel: HotelPrediction) => {
    getPlaceDetails(hotel.place_id, hotel.name);
  };

  return (
    <div className="relative" ref={inputRef}>
      <div className="relative">
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