// Core interfaces - most comprehensive version first
export interface WeatherData {
  date: string;
  condition: string;
  weatherCode: number;
  maxTemp: number;
  minTemp: number;
  precipitationProbability: number;
  icon: string;
}

export interface HojaDeRutaMetadata {
  id?: string;
  document_version?: number;
  created_by?: string;
  approved_by?: string;
  status?: 'draft' | 'review' | 'approved' | 'final';
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
  last_modified?: string;
  last_modified_by?: string;
}

export interface TravelArrangement {
  transportation_type?: string;
  pickup_address?: string;
  pickup_time?: string;
  departure_time?: string;
  arrival_time?: string;
  flight_train_number?: string;
  company?: string;
  driver_name?: string;
  driver_phone?: string;
  plate_number?: string;
  notes?: string;
}

export interface Transport {
  id: string;
  transport_type: "trailer" | "9m" | "8m" | "6m" | "4m" | "furgoneta";
  driver_name?: string;
  driver_phone?: string;
  license_plate?: string;
  company?: "pantoja" | "transluminaria" | "transcamarena" | "wild tour" | "camionaje" | "sector-pro" | "other";
  date_time?: string;
  has_return?: boolean;
  return_date_time?: string;
}

export interface RoomAssignment {
  room_type?: string;
  room_number?: string;
  staff_member1_id?: string;
  staff_member2_id?: string;
  hotel_name?: string;
  address?: string;
}

export interface Accommodation {
  id?: string;
  hotel_name?: string;
  address?: string;
  check_in?: string;
  check_out?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  rooms: RoomAssignment[];
}

// Most comprehensive EventData interface
export interface EventData {
  eventName?: string;
  eventCode?: string;
  eventType?: string;
  clientName?: string;
  eventDates?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  setupTime?: string;
  dismantleTime?: string;
  estimatedAttendees?: number;
  actualAttendees?: number;
  budget?: number;
  actualCost?: number;
  currency?: string;
  eventStatus?: string;
  venue?: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    coordinates?: {
      lat: number;
      lng: number;
    };
    place_id?: string;
    images?: { image_path: string; image_type: string }[];
  };
  venueType?: string;
  venueCapacity?: number;
  venueContact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  contacts?: Array<{
    name?: string;
    role?: string;
    phone?: string;
    email?: string;
  }>;
  staff?: Array<{
    id?: string;
    name?: string;
    surname1?: string;
    surname2?: string;
    position?: string;
    phone?: string;
    dni?: string;
    department?: string;
    role?: string;
  }>;
  logistics?: {
    transport?: Transport[];
    loadingDetails?: string;
    unloadingDetails?: string;
    equipmentLogistics?: string;
  };
  schedule?: string;
  // Structured program schedule (component-driven)
  programSchedule?: ProgramRow[];
  // Multi-day structured program
  programScheduleDays?: ProgramDay[];
  powerRequirements?: string;
  auxiliaryNeeds?: string;
  weather?: WeatherData[];
  restaurants?: Restaurant[];
  selectedRestaurants?: string[];
  metadata?: HojaDeRutaMetadata;
}

export interface ProgramRow {
  time: string; // HH:mm
  item: string;
  dept?: string;
  notes?: string;
}

export interface ProgramDay {
  id?: string;
  label?: string; // e.g., "Día 1", "Montaje", etc.
  date?: string;  // YYYY-MM-DD (optional)
  rows: ProgramRow[];
}

export interface HojaDeRutaTemplate {
  id: string;
  name: string;
  description?: string;
  event_type: 'corporate' | 'festival' | 'tour' | 'conference' | 'wedding' | 'other';
  template_data: EventData;
  is_active: boolean;
}

export interface ComprehensiveEventData extends EventData {
  equipmentList?: Array<{ item: string; quantity: number; supplier?: string; cost?: number; }>;
  audioVisualRequirements?: string;
  lightingRequirements?: string;
  stagingRequirements?: string;
  cateringDetails?: {
    provider: string;
    menuType: string;
    servingTime: string;
    dietaryRequirements: string[];
    numberOfPeople: number;
  };
  weatherBackupPlan?: string;
  emergencyContacts?: Array<{
    name: string;
    role: string;
    phone: string;
    available24h: boolean;
  }>;
  specialInstructions?: string;
  riskAssessment?: string;
  insuranceDetails?: string;
}

export interface EnhancedStaff {
  id: string;
  name: string;
  surname1: string;
  surname2?: string;
  dni?: string;
  position: string;
  department?: string;
  phone?: string;
  email?: string;
  specializations?: string[];
  certifications?: string[];
  emergencyContact?: string;
  arrivalTime?: string;
  departureTime?: string;
  role?: string;
  teamLead?: boolean;
}

export interface EnhancedRoomAssignment extends RoomAssignment {
  staff1Name?: string;
  staff2Name?: string;
}

export interface EnhancedEventData extends ComprehensiveEventData {
  metadata?: HojaDeRutaMetadata;
  accommodations?: Accommodation[];
}

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  rating?: number;
  priceLevel?: number;
  photos?: string[];
  cuisine?: string[];
  phone?: string;
  website?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  distance?: number;
  googlePlaceId: string;
  isSelected?: boolean;
  // Optional origin metadata to indicate where it was searched from
  originType?: 'venue' | 'hotel' | 'custom';
  originLabel?: string;
}

export interface ImagePreviews {
  venue: string[];
}

export interface Images {
  venue: File[];
}

// Backward compatibility
export type PDFGenerationOptions = {
  eventData: EventData;
  travelArrangements: TravelArrangement[];
  roomAssignments: RoomAssignment[];
  imagePreviews: ImagePreviews;
  venueMapPreview: string | null;
  selectedJobId: string;
  jobTitle: string;
  toast?: any;
  accommodations?: Accommodation[];
};
