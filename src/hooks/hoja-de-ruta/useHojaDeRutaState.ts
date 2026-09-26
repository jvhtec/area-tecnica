import { useEffect, useState } from "react";
import type { Accommodation, EventData, TravelArrangement } from "@/types/hoja-de-ruta";

const createInitialEventData = (): EventData => ({
  eventName: "",
  eventDates: "",
  venue: { name: "", address: "" },
  contacts: [{ id: crypto.randomUUID(), name: "", role: "", phone: "" }],
  staff: [{
    id: crypto.randomUUID(),
    name: "",
    surname1: "",
    surname2: "",
    position: "",
    dni: "",
  }],
  logistics: {
    transport: [],
    loadingDetails: "",
    unloadingDetails: "",
    equipmentLogistics: "",
  },
  schedule: "",
  powerRequirements: "",
  auxiliaryNeeds: "",
  auxiliaryStaffSetupQty: 0,
  auxiliaryStaffDismantleQty: 0,
  auxiliaryMachinery: [],
  printExcludedSections: [],
});

export const useHojaDeRutaState = () => {
  const [eventData, setEventData] = useState<EventData>(createInitialEventData);
  const [travelArrangements, setTravelArrangements] = useState<TravelArrangement[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Single reset owner. The form hook only resets metadata/query state.
  useEffect(() => {
    setEventData(createInitialEventData());
    setTravelArrangements([]);
    setAccommodations([]);
    setIsInitialized(!selectedJobId);
  }, [selectedJobId]);

  return {
    eventData,
    setEventData,
    travelArrangements,
    setTravelArrangements,
    accommodations,
    setAccommodations,
    selectedJobId,
    setSelectedJobId,
    isInitialized,
    setIsInitialized,
  };
};
