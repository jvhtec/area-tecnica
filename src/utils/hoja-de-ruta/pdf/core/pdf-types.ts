// Re-export types from the main types file to avoid duplication
import type {
  EventData,
  TravelArrangement,
  Accommodation,
  RoomAssignment,
  WeatherData,
  ImagePreviews
} from '@/types/hoja-de-ruta';
import type { HojaDeRutaPdfSectionId } from '@/utils/hoja-de-ruta/pdf/section-options';
import type { HojaDeRutaPrintSectionId } from '@/utils/hoja-de-ruta/pdf/section-options';

export type {
  EventData,
  TravelArrangement,
  Accommodation,
  RoomAssignment,
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
  excludedSections?: HojaDeRutaPrintSectionId[];
  /** Only the complete crew-facing document may set this to true. */
  publish?: boolean;
}

export interface DriverCertificatePDFGenerationOptions {
  eventData: EventData;
  selectedJobId: string;
  jobTitle: string;
  jobDate?: string;
  venueMapPreview?: string | null;
  toast?: HojaDeRutaPdfToast;
}
