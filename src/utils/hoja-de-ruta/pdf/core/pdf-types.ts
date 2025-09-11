// Re-export types from the main types file to avoid duplication
import type {
  EventData,
  TravelArrangement,
  RoomAssignment,
  Accommodation,
  WeatherData,
  ImagePreviews
} from '@/types/hoja-de-ruta';

export type {
  EventData,
  TravelArrangement,
  RoomAssignment,
  Accommodation,
  WeatherData,
  ImagePreviews
};

// PDF-specific types
export interface PDFGenerationOptions {
  eventData: EventData;
  travelArrangements: TravelArrangement[];
  roomAssignments: RoomAssignment[];
  imagePreviews: ImagePreviews;
  venueMapPreview: string | null;
  selectedJobId: string;
  jobTitle: string;
  jobDate?: string;
  toast?: any;
  accommodations?: Accommodation[];
  // Rendering options (defaults applied in engine)
  includeAccommodationRooming?: boolean;
  includeAggregatedRooming?: boolean;
  includeTravelArrangements?: boolean;
  includeLogisticsTransport?: boolean;
  dedupeTransportAcrossSections?: boolean;
}
