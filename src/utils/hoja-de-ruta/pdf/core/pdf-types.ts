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
    transport?: Array<{
      transport_type?: string;
      driver_name?: string;
      driver_phone?: string;
      license_plate?: string;
      departure_time?: string;
      arrival_time?: string;
    }>;
    loadingDetails?: string;
    unloadingDetails?: string;
    equipmentLogistics?: string;
  };
  schedule?: string;
  powerRequirements?: string;
  auxiliaryNeeds?: string;
  weather?: WeatherData[];
  metadata?: HojaDeRutaMetadata;
}

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
  status?: string;
  created_at?: string;
  updated_at?: string;
  last_modified?: string;
  last_modified_by?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
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

export interface RoomAssignment {
  room_type?: string;
  room_number?: string;
  staff_member1_id?: string;
  staff_member2_id?: string;
  hotel_name?: string;
  address?: string;
}

export interface Accommodation {
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

export interface ImagePreviews {
  venue: string[];
}

export interface PDFGenerationOptions {
  eventData: EventData;
  travelArrangements: TravelArrangement[];
  roomAssignments: RoomAssignment[];
  imagePreviews: ImagePreviews;
  venueMapPreview: string | null;
  selectedJobId: string;
  jobTitle: string;
  toast?: any;
  accommodations?: Accommodation[];
}