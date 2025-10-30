/**
 * Tour Scheduling and Timeline Types
 *
 * This file defines TypeScript interfaces for the tour scheduling and timeline system.
 * These types correspond to JSONB fields in the database and provide type safety
 * for tour settings, schedules, contacts, and itinerary data.
 */

// ============================================================================
// TOUR SETTINGS TYPES
// ============================================================================

export interface TourSettings {
  day_start_time?: string;
  advance_notice_days?: number;
  auto_sync_to_jobs?: boolean;
  default_meal_times?: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
  };
}

export interface SchedulingPreferences {
  buffer_time_minutes?: number;
  teardown_hours?: number;
  default_load_in_time?: string;
  default_sound_check_duration?: number;
}

// ============================================================================
// TOUR CONTACT TYPES
// ============================================================================

export interface TourContact {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  company?: string;
  notes?: string;
}

// ============================================================================
// TRAVEL SEGMENT TYPES
// ============================================================================

export type TransportationType = 'bus' | 'van' | 'flight' | 'train' | 'ferry' | 'truck';

export interface TravelSegment {
  id: string;
  fromDateId: string;
  toDateId: string;
  departureTime?: string;
  arrivalTime?: string;
  transportationType: TransportationType;
  distance_km?: number;
  notes?: string;
  carrier_name?: string;
  vehicle_details?: {
    flight_number?: string;
    train_number?: string;
    bus_company?: string;
    vehicle_registration?: string;
    seats?: number;
    [key: string]: any;
  };
}

// ============================================================================
// HOTEL AND ACCOMMODATION TYPES
// ============================================================================

export interface HotelInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  check_in_time?: string;
  check_out_time?: string;
  rooms_booked?: number;
  confirmation_number?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  parking_available?: boolean;
  wifi_available?: boolean;
  breakfast_included?: boolean;
}

export interface RoomAllocation {
  room_number?: string;
  room_type?: string;
  technician_id?: string;
  technician_name?: string;
  occupants?: string[];
  notes?: string;
}

// ============================================================================
// RESTAURANT AND DINING TYPES
// ============================================================================

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'catering';

export interface RestaurantInfo {
  id: string;
  name: string;
  type: MealType;
  address?: string;
  phone?: string;
  reservation_time?: string;
  party_size?: number;
  confirmation_number?: string;
  notes?: string;
  menu_url?: string;
  dietary_accommodations?: string[];
}

// ============================================================================
// LOCAL CONTACT TYPES
// ============================================================================

export interface LocalContact {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  company?: string;
  available_hours?: string;
  notes?: string;
  is_emergency_contact?: boolean;
}

// ============================================================================
// VENUE TECHNICAL SPECS TYPES
// ============================================================================

export interface VenueTechnicalSpecs {
  stage_dimensions?: {
    width_m?: number;
    depth_m?: number;
    height_m?: number;
  };
  power_available?: {
    total_amps?: number;
    phases?: number;
    voltage?: number;
    distribution?: string;
  };
  loading_dock?: {
    type?: string; // 'level', 'ramp', 'stairs'
    doors?: number;
    clearance_height_m?: number;
    width_m?: number;
  };
  wifi_available?: boolean;
  wifi_details?: {
    network_name?: string;
    password?: string;
    bandwidth?: string;
  };
  dressing_rooms?: number;
  green_rooms?: number;
  capacity?: number;
  venue_type?: string;
  notes?: string;
}

// ============================================================================
// CREW CALL TYPES
// ============================================================================

export interface CrewCall {
  id: string;
  department: string;
  call_time: string;
  location?: string;
  notes?: string;
  crew_members?: string[]; // technician IDs
  completed?: boolean;
}

// ============================================================================
// ALERT TYPES
// ============================================================================

export type AlertType = 'info' | 'warning' | 'error' | 'success';
export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Alert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  message: string;
  created_at: string;
  dismissed?: boolean;
  dismissed_at?: string;
  dismissed_by?: string;
}

// ============================================================================
// LOGISTICS INFO TYPES
// ============================================================================

export interface LogisticsInfo {
  loading_access?: {
    address?: string;
    access_code?: string;
    contact_name?: string;
    contact_phone?: string;
    special_instructions?: string;
  };
  parking?: {
    truck_spaces?: number;
    van_spaces?: number;
    car_spaces?: number;
    location?: string;
    restrictions?: string;
    notes?: string;
  };
  load_in_time?: string;
  load_out_time?: string;
  doors_open?: string;
  show_time?: string;
  curfew?: string;
  venue_contact?: {
    name?: string;
    phone?: string;
    role?: string;
  };
}

// ============================================================================
// TRAVEL SEGMENT (DATABASE TABLE) TYPES
// ============================================================================

export type TravelSegmentStatus = 'planned' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface CrewManifestEntry {
  technician_id: string;
  technician_name: string;
  department?: string;
  seat_number?: string;
  boarding_pass?: string;
  notes?: string;
}

export interface TravelStop {
  id: string;
  location: string;
  stop_type: 'rest' | 'fuel' | 'meal' | 'pickup' | 'dropoff';
  scheduled_time?: string;
  duration_minutes?: number;
  notes?: string;
}

// ============================================================================
// ACCOMMODATION (DATABASE TABLE) TYPES
// ============================================================================

export type AccommodationStatus = 'tentative' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';

// ============================================================================
// TIMELINE EVENT TYPES
// ============================================================================

export type TimelineEventType = 'travel' | 'day_off' | 'rehearsal' | 'meeting' | 'other';

export interface TimelineEventMetadata {
  // For travel events
  travel_segment_id?: string;
  transportation_type?: TransportationType;

  // For rehearsal events
  rehearsal_type?: 'full' | 'partial' | 'tech' | 'dress';
  departments?: string[];

  // For meeting events
  meeting_type?: string;
  attendees?: string[];
  agenda?: string;
  location_url?: string; // for virtual meetings

  // General
  color?: string;
  icon?: string;
  [key: string]: any;
}

// ============================================================================
// SCHEDULE TEMPLATE TYPES
// ============================================================================

export type ScheduleTemplateType = 'festival' | 'theater' | 'arena' | 'club' | 'outdoor';

export interface ProgramDay {
  id: string;
  time: string;
  activity: string;
  department?: string;
  notes?: string;
  duration_minutes?: number;
  location?: string;
}

export interface DefaultTiming {
  load_in_start?: string;
  sound_check_start?: string;
  sound_check_duration?: number;
  doors_open?: string;
  show_start?: string;
  show_duration?: number;
  load_out_start?: string;
  load_out_duration?: number;
}

// ============================================================================
// COMPLETE TOUR DATE INFO (for helper function)
// ============================================================================

export interface CompleteTourDateInfo {
  tour_date: any; // from tour_dates table
  hoja_de_ruta: any; // from hoja_de_ruta table
  accommodation: any | null; // from tour_accommodations table
  travel_from: any[] | null; // from tour_travel_segments table
  travel_to: any[] | null; // from tour_travel_segments table
}

// ============================================================================
// TIMELINE DATA TYPES
// ============================================================================

export type TimelineEventData =
  | { type: 'show'; tour_date_id: string; location: string; job_id?: string; venue_name?: string }
  | { type: TimelineEventType; id: string; title: string; description?: string; start_time?: string; end_time?: string; all_day?: boolean; location_details?: string; metadata?: TimelineEventMetadata };

export interface TimelineEvent {
  event_date: string; // DATE
  event_type: 'show' | TimelineEventType;
  event_data: TimelineEventData;
}
