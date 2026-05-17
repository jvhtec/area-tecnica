export type TourOpsProjection = "management" | "technician" | "guest";
export type TourOpsSyncStatus = "synced" | "needs_sync" | "no_hoja" | "imported" | "legacy";

export type TourOpsSection =
  | "overview"
  | "timeline"
  | "travel"
  | "accommodations"
  | "contacts"
  | "documents"
  | "weather";

export type TourOpsAllowedSections = Record<TourOpsSection, boolean>;

export const DEFAULT_TOUR_OPS_SECTIONS: TourOpsAllowedSections = {
  overview: true,
  timeline: true,
  travel: true,
  accommodations: true,
  contacts: true,
  documents: true,
  weather: true,
};

export interface TourOpsLocation {
  id: string | null;
  name: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface TourOpsContact {
  id?: string;
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  notes?: string | null;
  isPrimary?: boolean | null;
}

export interface TourOpsProgramRow {
  time: string | null;
  item: string | null;
  dept: string | null;
  notes: string | null;
}

export interface TourOpsProgramDay {
  label: string | null;
  date?: string | null;
  rows: TourOpsProgramRow[];
}

export interface TourOpsCrewMember {
  id: string;
  name: string;
  department: string | null;
  role: string | null;
  phone?: string | null;
  email?: string | null;
  source: "tour" | "job";
}

export interface TourOpsTimelineEvent {
  id: string;
  tourId: string;
  eventType: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
  allDay: boolean;
  locationId: string | null;
  locationDetails: string | null;
  departments: string[];
  visibleToCrew: boolean;
  metadata: Record<string, unknown>;
}

export interface TourOpsTravelSegment {
  id: string;
  tourId: string;
  fromTourDateId: string | null;
  toTourDateId: string | null;
  fromLocationId: string | null;
  toLocationId: string | null;
  fromLabel: string;
  toLabel: string;
  transportationType: string;
  departureTime: string | null;
  arrivalTime: string | null;
  carrierName: string | null;
  vehicleDetails: Record<string, unknown> | null;
  distanceKm: number | null;
  estimatedDurationMinutes: number | null;
  routeNotes: string | null;
  stops: unknown[];
  crewManifest: unknown[];
  luggageTruck: boolean;
  status: string | null;
  source: "normalized" | "legacy" | "hoja";
  syncStatus: TourOpsSyncStatus;
  hojaDeRutaId?: string | null;
  sourceTable?: "tour_travel_segments" | "hoja_de_ruta_travel_arrangements" | "hoja_de_ruta_transport" | "travel_plan";
}

export interface TourOpsRoomAssignment {
  id?: string | null;
  roomType: string | null;
  roomNumber: string | null;
  staffMember1Id?: string | null;
  staffMember2Id?: string | null;
  staffMember1Name?: string | null;
  staffMember2Name?: string | null;
  rawStaffMember1Id?: string | null;
  rawStaffMember2Id?: string | null;
}

export interface TourOpsAccommodation {
  id: string;
  tourDateId: string | null;
  hojaDeRutaId?: string | null;
  locationId?: string | null;
  hotelName: string;
  hotelAddress: string | null;
  latitude?: number | null;
  longitude?: number | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  confirmationNumber: string | null;
  roomAllocation: TourOpsRoomAssignment[];
  roomsBooked: number | null;
  notes: string | null;
  source: "normalized" | "hoja";
  syncStatus: TourOpsSyncStatus;
}

export interface TourOpsDocument {
  id: string;
  tourId: string;
  fileName: string;
  filePath: string;
  fileType: string | null;
  uploadedAt: string | null;
  visibleToTech: boolean;
  visibleToGuest: boolean;
}

export interface TourOpsHealthIssue {
  id: string;
  severity: "info" | "warning" | "critical";
  label: string;
  detail: string;
  tourDateId?: string;
}

export interface TourOpsDate {
  id: string;
  date: string;
  startDate: string | null;
  endDate: string | null;
  type: string | null;
  rehearsalDays: number | null;
  isTourPackOnly: boolean;
  location: TourOpsLocation | null;
  hojaDeRutaId: string | null;
  jobId: string | null;
  jobTitle: string | null;
  jobStatus: string | null;
  program: TourOpsProgramDay[];
  crew: TourOpsCrewMember[];
  travelIn: TourOpsTravelSegment[];
  travelOut: TourOpsTravelSegment[];
  accommodations: TourOpsAccommodation[];
  weather: unknown | null;
  logistics: unknown | null;
  venueName: string | null;
  venueAddress: string | null;
  restaurants: unknown | null;
  health: TourOpsHealthIssue[];
}

export interface TourOpsModel {
  projection: TourOpsProjection;
  allowedSections: TourOpsAllowedSections;
  share?: {
    id: string;
    label: string;
    expiresAt: string | null;
    accessLevel?: "view" | "edit";
  } | null;
  tour: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    status: string | null;
    startDate: string | null;
    endDate: string | null;
    defaultTimezone: string | null;
    contacts: TourOpsContact[];
    settings: Record<string, unknown>;
    schedulingPreferences: Record<string, unknown>;
    hasLegacyTravelPlan: boolean;
  };
  dates: TourOpsDate[];
  timelineEvents: TourOpsTimelineEvent[];
  travelSegments: TourOpsTravelSegment[];
  accommodations: TourOpsAccommodation[];
  documents: TourOpsDocument[];
  crew: TourOpsCrewMember[];
  health: TourOpsHealthIssue[];
  stats: {
    totalDates: number;
    completedDates: number;
    upcomingDates: number;
    venueCount: number;
    travelSegments: number;
    healthWarnings: number;
  };
}

export interface TourGuestLink {
  id: string;
  tour_id: string;
  label: string;
  allowed_sections: TourOpsAllowedSections;
  access_level?: "view" | "edit";
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  token?: string;
}
