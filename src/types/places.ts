export interface PlaceResultNormalized {
  formatted_address: string;
  place_id: string;
  location: { lat: number; lng: number };
  name?: string;               // venue name if present
  postal_code?: string;
  locality?: string;           // city/town
  admin_area_level_1?: string; // state/region
  country?: string;            // ISO-3166-1 alpha-2
}

export interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (result: PlaceResultNormalized) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  initialPlaceId?: string;
  types?: string[];
  componentRestrictions?: { country?: string | string[] };
  debounceMs?: number;
  minChars?: number;
  biasToProjectBounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  allowManual?: boolean;
  className?: string;
}

export interface PlacesSuggestion {
  place_id: string;
  name: string;
  formatted_address: string;
  types?: string[];
}