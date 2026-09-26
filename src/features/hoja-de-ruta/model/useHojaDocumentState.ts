import { useCallback, useEffect, useReducer } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  Accommodation,
  EventData,
  TravelArrangement,
} from "@/types/hoja-de-ruta";

export type HojaDocumentEditorState = {
  eventData: EventData;
  travelArrangements: TravelArrangement[];
  accommodations: Accommodation[];
  selectedJobId: string;
  isInitialized: boolean;
};

type HojaDocumentAction =
  | { type: "event"; update: SetStateAction<EventData> }
  | { type: "travel"; update: SetStateAction<TravelArrangement[]> }
  | { type: "accommodations"; update: SetStateAction<Accommodation[]> }
  | { type: "select-job"; jobId: string }
  | { type: "initialized"; value: boolean };

export const createInitialHojaEventData = (): EventData => ({
  eventName: "",
  eventDates: "",
  venue: { name: "", address: "" },
  contacts: [{ id: crypto.randomUUID(), name: "", role: "", phone: "", email: "" }],
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

export const createInitialHojaDocumentState = (): HojaDocumentEditorState => ({
  eventData: createInitialHojaEventData(),
  travelArrangements: [],
  accommodations: [],
  selectedJobId: "",
  isInitialized: true,
});

const applyUpdate = <T,>(current: T, update: SetStateAction<T>): T =>
  typeof update === "function"
    ? (update as (previous: T) => T)(current)
    : update;

export const hojaDocumentReducer = (
  state: HojaDocumentEditorState,
  action: HojaDocumentAction,
): HojaDocumentEditorState => {
  switch (action.type) {
    case "event":
      return { ...state, eventData: applyUpdate(state.eventData, action.update) };
    case "travel":
      return {
        ...state,
        travelArrangements: applyUpdate(state.travelArrangements, action.update),
      };
    case "accommodations":
      return {
        ...state,
        accommodations: applyUpdate(state.accommodations, action.update),
      };
    case "select-job":
      if (action.jobId === state.selectedJobId) return state;
      return {
        eventData: createInitialHojaEventData(),
        travelArrangements: [],
        accommodations: [],
        selectedJobId: action.jobId,
        isInitialized: !action.jobId,
      };
    case "initialized":
      return { ...state, isInitialized: action.value };
    default:
      return state;
  }
};

export const useHojaDocumentState = () => {
  const [state, dispatch] = useReducer(
    hojaDocumentReducer,
    undefined,
    createInitialHojaDocumentState,
  );

  const setEventData = useCallback<Dispatch<SetStateAction<EventData>>>(
    (update) => dispatch({ type: "event", update }),
    [],
  );
  const setTravelArrangements = useCallback<
    Dispatch<SetStateAction<TravelArrangement[]>>
  >(
    (update) => dispatch({ type: "travel", update }),
    [],
  );
  const setAccommodations = useCallback<
    Dispatch<SetStateAction<Accommodation[]>>
  >(
    (update) => dispatch({ type: "accommodations", update }),
    [],
  );
  const setSelectedJobId = useCallback<Dispatch<SetStateAction<string>>>(
    (update) => {
      const current = state.selectedJobId;
      dispatch({
        type: "select-job",
        jobId: applyUpdate(current, update),
      });
    },
    [state.selectedJobId],
  );
  const setIsInitialized = useCallback<Dispatch<SetStateAction<boolean>>>(
    (update) => {
      const current = state.isInitialized;
      dispatch({
        type: "initialized",
        value: applyUpdate(current, update),
      });
    },
    [state.isInitialized],
  );

  // Keep the selected-job reset in the reducer so there is exactly one owner
  // for editor state invalidation.
  useEffect(() => undefined, [state.selectedJobId]);

  return {
    ...state,
    setEventData,
    setTravelArrangements,
    setAccommodations,
    setSelectedJobId,
    setIsInitialized,
  };
};
