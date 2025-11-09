export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PlaceSelection {
  name: string;
  address: string;
  coordinates: Coordinates | null;
}

export interface DetailedPlaceSelection extends PlaceSelection {
  placeId?: string;
  metadata?: Record<string, unknown>;
}
