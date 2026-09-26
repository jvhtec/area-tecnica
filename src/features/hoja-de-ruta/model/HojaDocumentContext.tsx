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

export function useHojaSection(sectionId: "event") {
  const store = useHojaDocumentStore();
  return {
    eventData: store.eventData,
    setEventData: store.setEventData,
    selectedJobId: store.selectedJobId,
    setSelectedJobId: store.setSelectedJobId,
    jobs: store.jobs,
    isLoadingJobs: store.isLoadingJobs,
    refreshFromJob: store.autoPopulateFromJob,
  };
}

export function useHojaSection(sectionId: "venue" | "weather" | "schedule" | "restaurants") {
  const store = useHojaDocumentStore();
  return {
    eventData: store.eventData,
    setEventData: store.setEventData,
    accommodations: store.accommodations,
  };
}

export function useHojaSection(sectionId: "contacts") {
  const store = useHojaDocumentStore();
  return {
    eventData: store.eventData,
    onContactChange: store.handleContactChange,
    onAddContact: store.addContact,
    onRemoveContact: store.removeContact,
  };
}

export function useHojaSection(sectionId: "staff") {
  const store = useHojaDocumentStore();
  return {
    eventData: store.eventData,
    onStaffChange: store.handleStaffChange,
    onAddStaff: store.addStaffMember,
    onRemoveStaff: store.removeStaffMember,
  };
}

export function useHojaSection(sectionId: "travel") {
  const store = useHojaDocumentStore();
  return {
    travelArrangements: store.travelArrangements,
    onUpdate: store.updateTravelArrangement,
    onAdd: store.addTravelArrangement,
    onRemove: store.removeTravelArrangement,
  };
}

export function useHojaSection(sectionId: "accommodation") {
  const store = useHojaDocumentStore();
  return {
    accommodations: store.accommodations,
    eventData: store.eventData,
    setAccommodations: store.setAccommodations,
    onUpdateRoom: store.updateRoom,
    onAddAccommodation: store.addAccommodation,
    onRemoveAccommodation: store.removeAccommodation,
    onAddRoom: store.addRoom,
    onRemoveRoom: store.removeRoom,
  };
}

export function useHojaSection(sectionId: "logistics") {
  const store = useHojaDocumentStore();
  return {
    eventData: store.eventData,
    setEventData: store.setEventData,
    selectedJobId: store.selectedJobId,
    onUpdateTransport: store.updateTransport,
    onAddTransport: store.addTransport,
    onRemoveTransport: store.removeTransport,
    onImportTransports: store.importTransports,
  };
}

export function useHojaSection(sectionId: HojaSectionId) {
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
        onContactChange: store.handleContactChange,
        onAddContact: store.addContact,
        onRemoveContact: store.removeContact,
      };
    case "staff":
      return {
        eventData: store.eventData,
        onStaffChange: store.handleStaffChange,
        onAddStaff: store.addStaffMember,
        onRemoveStaff: store.removeStaffMember,
      };
    case "travel":
      return {
        travelArrangements: store.travelArrangements,
        onUpdate: store.updateTravelArrangement,
        onAdd: store.addTravelArrangement,
        onRemove: store.removeTravelArrangement,
      };
    case "accommodation":
      return {
        accommodations: store.accommodations,
        eventData: store.eventData,
        setAccommodations: store.setAccommodations,
        onUpdateRoom: store.updateRoom,
        onAddAccommodation: store.addAccommodation,
        onRemoveAccommodation: store.removeAccommodation,
        onAddRoom: store.addRoom,
        onRemoveRoom: store.removeRoom,
      };
    case "logistics":
      return {
        eventData: store.eventData,
        setEventData: store.setEventData,
        selectedJobId: store.selectedJobId,
        onUpdateTransport: store.updateTransport,
        onAddTransport: store.addTransport,
        onRemoveTransport: store.removeTransport,
        onImportTransports: store.importTransports,
      };
    default:
      return {
        eventData: store.eventData,
        setEventData: store.setEventData,
        accommodations: store.accommodations,
      };
  }
}
