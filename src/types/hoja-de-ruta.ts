
export interface TravelArrangement {
  transportation_type: "van" | "sleeper_bus" | "train" | "plane" | "RV";
  pickup_address?: string;
  pickup_time?: string; // Now proper time format HH:MM
  flight_train_number?: string;
  departure_time?: string; // Now proper time format HH:MM
  arrival_time?: string; // Now proper time format HH:MM
  notes?: string;
}

export interface RoomAssignment {
  room_type: "single" | "double";
  room_number?: string;
  staff_member1_id?: string;
  staff_member2_id?: string;
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
    transport: string;
    loadingDetails: string;
    unloadingDetails: string;
    equipmentLogistics: string;
  };
  staff: { name: string; surname1: string; surname2: string; position: string }[];
  schedule: string;
  powerRequirements: string;
  auxiliaryNeeds: string;
}

// Equipment interface removed per user request

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

export interface EnhancedEventData extends EventData {
  metadata?: HojaDeRutaMetadata;
}

export interface ImagePreviews {
  venue: string[];
}

export interface Images {
  venue: File[];
}
