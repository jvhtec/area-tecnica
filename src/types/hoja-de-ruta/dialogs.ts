
import { EventData, TravelArrangement, RoomAssignment } from "@/types/hoja-de-ruta";

export interface VenueDialogProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
  venueMapPreview: string | null;
  handleVenueMapUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface ContactsDialogProps {
  eventData: EventData;
  handleContactChange: (index: number, field: string, value: string) => void;
  addContact: () => void;
}

export interface StaffDialogProps {
  eventData: EventData;
  handleStaffChange: (index: number, field: string, value: string) => void;
  addStaffMember: () => void;
}

export interface TravelArrangementsDialogProps {
  travelArrangements: TravelArrangement[];
  updateTravelArrangement: (index: number, field: keyof TravelArrangement, value: string) => void;
  addTravelArrangement: () => void;
  removeTravelArrangement: (index: number) => void;
}

export interface RoomAssignmentsDialogProps {
  roomAssignments: RoomAssignment[];
  eventData: EventData;
  updateRoomAssignment: (index: number, field: keyof RoomAssignment, value: string) => void;
  addRoomAssignment: () => void;
  removeRoomAssignment: (index: number) => void;
}
