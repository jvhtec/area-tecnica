import type {
  Accommodation,
  EventData,
  HojaDeRutaImageRecord,
  HojaDeRutaMetadata,
  TravelArrangement,
} from "@/types/hoja-de-ruta";

export type HojaStatus = "draft" | "review" | "approved" | "final";

export type HojaAggregate = {
  main: Record<string, unknown>;
  logistics?: Record<string, unknown>;
  contacts?: Record<string, unknown>[];
  staff?: Record<string, unknown>[];
  transport?: Record<string, unknown>[];
  travelArrangements?: Record<string, unknown>[];
  accommodations?: Array<Record<string, unknown> & { rooms?: Record<string, unknown>[] }>;
  images?: Record<string, unknown>[];
};

export interface HojaDocument extends HojaDeRutaMetadata {
  id: string;
  jobId: string;
  eventData: EventData;
  travelArrangements: TravelArrangement[];
  accommodations: Accommodation[];
  images: HojaDeRutaImageRecord[];
}

export type HojaDocumentSaveInput = {
  eventData: EventData;
  travelArrangements: TravelArrangement[];
  accommodations: Accommodation[];
  images: HojaDeRutaImageRecord[];
  removedImageIds?: string[];
  expectedVersion: number;
};

export type HojaStatusTransitionResult = {
  status: HojaStatus;
  approved_by: string | null;
  approved_at: string | null;
  document_version: number;
};
