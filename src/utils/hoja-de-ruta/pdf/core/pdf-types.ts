// Re-export types from the main types file to avoid duplication
import type {
  EventData,
  TravelArrangement,
  RoomAssignment,
  Accommodation,
  WeatherData,
  ImagePreviews
} from '@/types/hoja-de-ruta';
import type { HojaDeRutaPdfSectionId } from '@/utils/hoja-de-ruta/pdf/section-options';

export type {
  EventData,
  TravelArrangement,
  RoomAssignment,
  Accommodation,
  WeatherData,
  ImagePreviews
};

export interface GeneratedHojaDeRutaPdf {
  blob: Blob;
  filename: string;
  title: string;
}

export type HojaDeRutaPdfToast = (props: {
  title: string;
  description?: string;
  variant?: string;
}) => void;

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
  toast?: HojaDeRutaPdfToast;
  accommodations?: Accommodation[];
  // Rendering options (defaults applied in engine)
  includeAccommodationRooming?: boolean;
  includeAggregatedRooming?: boolean;
  includeTravelArrangements?: boolean;
  includeLogisticsTransport?: boolean;
  dedupeTransportAcrossSections?: boolean;
  sections?: HojaDeRutaPdfSectionId[];
}

export interface DriverCertificatePDFGenerationOptions {
  eventData: EventData;
  selectedJobId: string;
  jobTitle: string;
  jobDate?: string;
  venueMapPreview?: string | null;
  toast?: HojaDeRutaPdfToast;
}
