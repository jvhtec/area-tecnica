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
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

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

    setIsLoading(true);
    
    try {
      if (!window.google?.maps?.places) {
        console.error('Google Maps Places API not loaded');
        setIsLoading(false);
        return;
      }

      const service = new window.google.maps.places.AutocompleteService();
      
      const request = {
        input: query,
        types: ['lodging'], // This restricts to hotels and accommodations
        componentRestrictions: { country: 'es' }, // Adjust country as needed
      };

      service.getPlacePredictions(request, (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          // Filter for hotels specifically
          const hotelPredictions = predictions
            .filter(prediction => 
              prediction.types.includes('lodging') ||
              prediction.types.includes('establishment')
            )
            .slice(0, 5)
            .map(prediction => ({
              place_id: prediction.place_id,
              name: prediction.structured_formatting?.main_text || prediction.description,
              formatted_address: prediction.structured_formatting?.secondary_text || prediction.description,
              types: prediction.types
            }));

          setSuggestions(hotelPredictions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
        setIsLoading(false);
      });
    } catch (error) {
      console.error('Error searching hotels:', error);
      setSuggestions([]);
      setShowSuggestions(false);
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

  const getPlaceDetails = (placeId: string, hotelName: string) => {
    if (!window.google?.maps?.places) {
      onChange(hotelName);
      return;
    }

    const service = new window.google.maps.places.PlacesService(document.createElement('div'));
    
    service.getDetails(
      {
        placeId: placeId,
        fields: ['formatted_address', 'geometry', 'name', 'rating']
      },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          const coordinates = place.geometry?.location 
            ? {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
              }
            : undefined;

          onChange(
            place.name || hotelName,
            place.formatted_address,
            coordinates
          );
        } else {
          onChange(hotelName);
        }
        setShowSuggestions(false);
      }
    );
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