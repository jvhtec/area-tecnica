import { dataLayerClient } from '@/services/dataLayerClient';

export interface GooglePlaceResult {
  name: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  place_id: string;
}

/** Venue name search; the Google key stays in the authenticated Edge Function. */
export async function searchGooglePlaces(query: string, signal: AbortSignal): Promise<GooglePlaceResult[]> {
  const { data, error } = await dataLayerClient.functions.invoke('place-search', {
    body: { query },
    signal,
  });
  if (error || data?.error) throw new Error('No se pudo buscar la ubicación');
  return data?.places ?? [];
}
