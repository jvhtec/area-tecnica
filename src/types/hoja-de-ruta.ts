export interface TravelArrangement {
  transportation_type: "van" | "sleeper_bus" | "train" | "plane" | "RV";
  pickup_address?: string;
  pickup_time?: string;
  flight_train_number?: string;
  departure_time?: string;
  arrival_time?: string;
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
  company?: "pantoja" | "transluminaria" | "transcamarena" | "wild tour" | "camionaje" | "other";
  date_time?: string;
  has_return?: boolean;
  return_date_time?: string;
}

export interface RoomAssignment {
  room_type: "single" | "double";
  room_number?: string;
  staff_member1_id?: string;
  staff_member2_id?: string;
}

export interface Accommodation {
  id: string;
  hotel_name: string;
  address: string;
  check_in: string;
  check_out: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  rooms: RoomAssignment[];
}

export interface EventData {
  eventName: string;
  eventDates: string;
  venue: {
    name: string;
    address: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  contacts: { name: string; role: string; phone: string }[];
  logistics: {
    transport: Transport[];
    loadingDetails: string;
    unloadingDetails: string;
    equipmentLogistics: string;
  };
  staff: { name: string; surname1: string; surname2: string; position: string; dni?: string }[];
  schedule: string;
  powerRequirements: string;
  auxiliaryNeeds: string;
}

export interface HojaDeRutaTemplate {
  id: string;
  name: string;
  description?: string;
  event_type: 'corporate' | 'festival' | 'tour' | 'conference' | 'wedding' | 'other';
  template_data: EventData;
  is_active: boolean;
}

export interface HojaDeRutaMetadata {
  id: string;
  document_version: number;
  created_by?: string;
  approved_by?: string;
  status: 'draft' | 'review' | 'approved' | 'final';
  approved_at?: string;
  created_at: string;
  updated_at: string;
  last_modified: string;
  last_modified_by?: string;
}

export interface ComprehensiveEventData extends EventData {
  eventCode?: string;
  eventType?: string;
  eventStatus?: 'draft' | 'confirmed' | 'cancelled' | 'completed';
  clientName?: string;
  clientContact?: string;
  estimatedAttendees?: number;
  actualAttendees?: number;
  venueContact?: { name: string; phone: string; email: string; };
  venueCapacity?: number;
  venueType?: string;
  setupTime?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  dismantleTime?: string;
  budget?: number;
  actualCost?: number;
  currency?: string;
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

export interface ImagePreviews {
  venue: string[];
}

export interface Images {
  venue: File[];
}


