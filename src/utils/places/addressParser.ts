import type { PlaceResultNormalized } from '@/types/places';

export function parseAddressComponents(
  addressComponents: any[]
): Partial<PlaceResultNormalized> {
  const parsed: Partial<PlaceResultNormalized> = {};

  addressComponents.forEach(component => {
    const types = component.types;

    if (types.includes('postal_code')) {
      parsed.postal_code = component.long_name;
    }
    if (types.includes('locality')) {
      parsed.locality = component.long_name;
    }
    if (types.includes('administrative_area_level_1')) {
      parsed.admin_area_level_1 = component.long_name;
    }
    if (types.includes('country')) {
      parsed.country = component.short_name; // ISO-3166-1 alpha-2
    }
  });

  return parsed;
}

export function parseGooglePlaceResult(
  place: any,
  fallbackName?: string
): PlaceResultNormalized | null {
  if (!place.place_id || !place.formatted_address || !place.geometry?.location) {
    return null;
  }

  const baseResult: PlaceResultNormalized = {
    formatted_address: place.formatted_address,
    place_id: place.place_id,
    location: {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng()
    },
    name: place.name || fallbackName
  };

  // Parse address components if available
  if (place.address_components) {
    const parsed = parseAddressComponents(place.address_components);
    return { ...baseResult, ...parsed };
  }

  return baseResult;
}

export function parseNewPlacesApiResult(
  place: any,
  fallbackName?: string
): PlaceResultNormalized | null {
  if (!place.id || !place.formattedAddress || !place.location) {
    return null;
  }

  return {
    formatted_address: place.formattedAddress,
    place_id: place.id,
    location: {
      lat: place.location.latitude || place.location.lat(),
      lng: place.location.longitude || place.location.lng()
    },
    name: place.displayName?.text || place.name?.text || fallbackName,
    // Additional parsing for address components would go here
    // if the new API provides them
  };
}