import type { TourDocument } from "@/hooks/useTourDocuments";
import type { Restaurant, WeatherData } from "@/types/hoja-de-ruta";
import type { JobWithLocationAndDocs } from "@/types/job";
import type { Theme } from "../types";

export interface DetailsModalProps {
  theme: Theme;
  isDark: boolean;
  job: JobWithLocationAndDocs;
  onClose: () => void;
}

export type TabId = "Info" | "Ubicación" | "Transp." | "Personal" | "Docs" | "Restau." | "Clima";

export type RiderFile = {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  artist_id: string;
};

export type FestivalStageName = {
  number: number;
  name: string;
};

export type JobArtist = {
  id: string;
  name: string;
  stage: number | null;
};

export type FestivalShiftAssignment = {
  id: string;
  role: string;
  shift_id: string | null;
};

export type FestivalShiftInfo = {
  id: string;
  job_id: string | null;
  date: string;
  name: string;
  start_time: string;
  end_time: string;
  stage: number | null;
  department: string | null;
};

export type TechShiftAssignmentDetail = {
  assignment_id: string;
  role: string;
  shift: FestivalShiftInfo;
};

export type HojaDeRutaMeta = {
  id: string;
};

export type HojaDeRutaRoomAssignment = {
  id: string;
  room_type: string;
  room_number: string | null;
  staff_member1_id: string | null;
  staff_member2_id: string | null;
};

export type HojaDeRutaAccommodation = {
  id: string;
  hotel_name: string;
  address: string | null;
  check_in: string | null;
  check_out: string | null;
  hoja_de_ruta_room_assignments?: HojaDeRutaRoomAssignment[] | null;
};

export type HojaDeRutaTravelArrangement = {
  id: string;
  transportation_type: string;
  pickup_address: string | null;
  pickup_time: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  flight_train_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  plate_number: string | null;
  notes: string | null;
};

export type HojaDeRutaTransport = {
  id: string;
  transport_type: string;
  driver_name: string | null;
  driver_phone: string | null;
  license_plate: string | null;
  company: string | null;
  date_time: string | null;
  has_return: boolean | null;
  return_date_time: string | null;
  logistics_categories: string[] | null;
};

export type RoomOccupantProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
};

export type TechnicianDetailsModalTabData = {
  restaurants: Restaurant[];
  weatherData: WeatherData[] | undefined;
  tourDocuments: TourDocument[];
};
