// Re-export map utilities from the PDF service for shared use
import { MapService } from './hoja-de-ruta/pdf/services/map-service';

// Convenience exports
export const geocodeAddress = (address: string) => MapService.geocodeAddress(address);
export const getStaticMapDataUrl = (lat: number, lng: number, width?: number, height?: number, zoom?: number) => 
  MapService.getStaticMapDataUrl(lat, lng, width, height, zoom);
export const generateRouteUrl = (origin: string, destination: string) => 
  MapService.generateRouteUrl(origin, destination);