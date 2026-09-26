import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import type { HojaSectionId } from "@/features/hoja-de-ruta/model/sectionDefinitions";
import type { useHojaDocument } from "@/features/hoja-de-ruta/model/useHojaDocument";

export type HojaDocumentStore = ReturnType<typeof useHojaDocument>;

const HojaDocumentContext = createContext<HojaDocumentStore | null>(null);

export const HojaDocumentProvider = ({
  value,
  children,
}: {
  value: HojaDocumentStore;
  children: ReactNode;
}) => (
  <HojaDocumentContext.Provider value={value}>
    {children}
  </HojaDocumentContext.Provider>
);

export const useHojaDocumentStore = (): HojaDocumentStore => {
  const value = useContext(HojaDocumentContext);
  if (!value) {
    throw new Error("useHojaDocumentStore must be used inside HojaDocumentProvider");
  }
  return value;
};

type EventSlice = Pick<
  HojaDocumentStore,
  "eventData" | "setEventData" | "selectedJobId" | "setSelectedJobId" | "jobs" | "isLoadingJobs"
> & { refreshFromJob: HojaDocumentStore["autoPopulateFromJob"] };

type EventDataSlice = Pick<
  HojaDocumentStore,
  "eventData" | "setEventData" | "accommodations"
>;

type ContactsSlice = Pick<
  HojaDocumentStore,
  "eventData" | "handleContactChange" | "addContact" | "removeContact"
>;

type StaffSlice = Pick<
  HojaDocumentStore,
  "eventData" | "handleStaffChange" | "addStaffMember" | "removeStaffMember"
>;

type TravelSlice = Pick<
  HojaDocumentStore,
  "travelArrangements" | "updateTravelArrangement" | "addTravelArrangement" | "removeTravelArrangement"
>;

type AccommodationSlice = Pick<
  HojaDocumentStore,
  | "accommodations"
  | "eventData"
  | "setAccommodations"
  | "updateRoom"
  | "addAccommodation"
  | "removeAccommodation"
  | "addRoom"
  | "removeRoom"
>;

type LogisticsSlice = Pick<
  HojaDocumentStore,
  | "eventData"
  | "setEventData"
  | "selectedJobId"
  | "updateTransport"
  | "addTransport"
  | "removeTransport"
  | "importTransports"
>;

type HojaSectionSlice =
  | EventSlice
  | EventDataSlice
  | ContactsSlice
  | StaffSlice
  | TravelSlice
  | AccommodationSlice
  | LogisticsSlice;

export function useHojaSection(sectionId: "event"): EventSlice;
export function useHojaSection(
  sectionId: "venue" | "weather" | "schedule" | "restaurants",
): EventDataSlice;
export function useHojaSection(sectionId: "contacts"): ContactsSlice;
export function useHojaSection(sectionId: "staff"): StaffSlice;
export function useHojaSection(sectionId: "travel"): TravelSlice;
export function useHojaSection(sectionId: "accommodation"): AccommodationSlice;
export function useHojaSection(sectionId: "logistics"): LogisticsSlice;
export function useHojaSection(sectionId: HojaSectionId): HojaSectionSlice {
  const store = useHojaDocumentStore();

  switch (sectionId) {
    case "event":
      return {
        eventData: store.eventData,
        setEventData: store.setEventData,
        selectedJobId: store.selectedJobId,
        setSelectedJobId: store.setSelectedJobId,
        jobs: store.jobs,
        isLoadingJobs: store.isLoadingJobs,
        refreshFromJob: store.autoPopulateFromJob,
      };
    case "contacts":
      return {
        eventData: store.eventData,
        handleContactChange: store.handleContactChange,
        addContact: store.addContact,
        removeContact: store.removeContact,
      };
    case "staff":
      return {
        eventData: store.eventData,
        handleStaffChange: store.handleStaffChange,
        addStaffMember: store.addStaffMember,
        removeStaffMember: store.removeStaffMember,
      };
    case "travel":
      return {
        travelArrangements: store.travelArrangements,
        updateTravelArrangement: store.updateTravelArrangement,
        addTravelArrangement: store.addTravelArrangement,
        removeTravelArrangement: store.removeTravelArrangement,
      };
    case "accommodation":
      return {
        accommodations: store.accommodations,
        eventData: store.eventData,
        setAccommodations: store.setAccommodations,
        updateRoom: store.updateRoom,
        addAccommodation: store.addAccommodation,
        removeAccommodation: store.removeAccommodation,
        addRoom: store.addRoom,
        removeRoom: store.removeRoom,
      };
    case "logistics":
      return {
        eventData: store.eventData,
        setEventData: store.setEventData,
        selectedJobId: store.selectedJobId,
        updateTransport: store.updateTransport,
        addTransport: store.addTransport,
        removeTransport: store.removeTransport,
        importTransports: store.importTransports,
      };
    default:
      return {
        eventData: store.eventData,
        setEventData: store.setEventData,
        accommodations: store.accommodations,
      };
  }
}
