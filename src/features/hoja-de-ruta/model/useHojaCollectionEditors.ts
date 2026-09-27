import { useCallback } from "react";

import type {
  Accommodation,
  EventData,
  Transport,
  TravelArrangement,
} from "@/types/hoja-de-ruta";
import {
  adjustAccommodationsForStaffRemoval,
  syncTransportsWithLogistics,
} from "@/utils/hoja-de-ruta/staffSync";

type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;

/**
 * Index-based editors for the Hoja's repeatable collections (contacts, staff,
 * travel, accommodation/rooms and transport). Pure state updates; persistence
 * stays with the aggregate save.
 */
export const useHojaCollectionEditors = ({
  staff,
  setEventData,
  setTravelArrangements,
  setAccommodations,
}: {
  staff: EventData["staff"];
  setEventData: StateSetter<EventData>;
  setTravelArrangements: StateSetter<TravelArrangement[]>;
  setAccommodations: StateSetter<Accommodation[]>;
}) => {
  const handleContactChange = useCallback((index: number, field: string, value: string) => {
    setEventData((prev) => ({
      ...prev,
      contacts: (prev.contacts || []).map((contact, i) =>
        i === index ? { ...contact, [field]: value } : contact
      ),
    }));
  }, [setEventData]);

  const addContact = useCallback(() => {
    setEventData((prev) => ({
      ...prev,
      contacts: [
        ...(prev.contacts || []),
        { id: crypto.randomUUID(), name: "", role: "", phone: "", email: "" },
      ],
    }));
  }, [setEventData]);

  const removeContact = useCallback((index: number) => {
    setEventData((prev) => {
      const next = (prev.contacts || []).filter((_, i) => i !== index);
      return {
        ...prev,
        contacts: next.length
          ? next
          : [{ id: crypto.randomUUID(), name: "", role: "", phone: "", email: "" }],
      };
    });
  }, [setEventData]);

  const handleStaffChange = useCallback((index: number, field: string, value: string) => {
    setEventData((prev) => ({
      ...prev,
      staff: (prev.staff || []).map((staff, i) =>
        i === index ? { ...staff, [field]: value } : staff
      ),
    }));
  }, [setEventData]);

  const addStaffMember = useCallback(() => {
    setEventData((prev) => ({
      ...prev,
      staff: [
        ...(prev.staff || []),
        {
          id: crypto.randomUUID(),
          name: "",
          surname1: "",
          surname2: "",
          position: "",
          dni: "",
        },
      ],
    }));
  }, [setEventData]);

  const removeStaffMember = useCallback((index: number) => {
    const removedEntry = staff?.[index];
    setEventData((prev) => {
      const next = (prev.staff || []).filter((_, i) => i !== index);
      return {
        ...prev,
        staff: next.length
          ? next
          : [{
              id: crypto.randomUUID(),
              name: "",
              surname1: "",
              surname2: "",
              position: "",
              dni: "",
            }],
      };
    });
    setAccommodations((prev) => adjustAccommodationsForStaffRemoval(prev, index, removedEntry));
  }, [staff, setAccommodations, setEventData]);

  const updateTravelArrangement = useCallback((
    index: number,
    field: string,
    value: string | undefined,
  ) => {
    setTravelArrangements((prev) =>
      prev.map((arrangement, i) =>
        i === index ? { ...arrangement, [field]: value } : arrangement
      )
    );
  }, [setTravelArrangements]);

  const addTravelArrangement = useCallback(() => {
    setTravelArrangements((prev) => [...prev, {
      id: crypto.randomUUID(),
      transportation_type: "van",
      pickup_address: "",
      pickup_time: "",
      departure_time: "",
      arrival_time: "",
      flight_train_number: "",
      driver_name: "",
      driver_phone: "",
      plate_number: "",
      notes: "",
    }]);
  }, [setTravelArrangements]);

  const removeTravelArrangement = useCallback((index: number) => {
    setTravelArrangements((prev) => prev.filter((_, i) => i !== index));
  }, [setTravelArrangements]);

  const updateAccommodation = useCallback((index: number, field: string, value: unknown) => {
    setAccommodations((prev) =>
      prev.map((accommodation, i) =>
        i === index ? { ...accommodation, [field]: value } : accommodation
      )
    );
  }, [setAccommodations]);

  const addAccommodation = useCallback(() => {
    setAccommodations((prev) => [...prev, {
      id: crypto.randomUUID(),
      hotel_name: "",
      address: "",
      check_in: "",
      check_out: "",
      rooms: [],
    }]);
  }, [setAccommodations]);

  const removeAccommodation = useCallback((index: number) => {
    setAccommodations((prev) => prev.filter((_, i) => i !== index));
  }, [setAccommodations]);

  const updateRoom = useCallback((
    accommodationIndex: number,
    roomIndex: number,
    field: string,
    value: string,
  ) => {
    setAccommodations((prev) =>
      prev.map((accommodation, i) =>
        i === accommodationIndex
          ? {
              ...accommodation,
              rooms: accommodation.rooms.map((room, j) =>
                j === roomIndex ? { ...room, [field]: value } : room
              ),
            }
          : accommodation
      )
    );
  }, [setAccommodations]);

  const addRoom = useCallback((accommodationIndex: number) => {
    setAccommodations((prev) =>
      prev.map((accommodation, i) =>
        i === accommodationIndex
          ? {
              ...accommodation,
              rooms: [...accommodation.rooms, {
                id: crypto.randomUUID(),
                room_type: "single",
                room_number: "",
                staff_member1_id: "",
                staff_member2_id: "",
              }],
            }
          : accommodation
      )
    );
  }, [setAccommodations]);

  const removeRoom = useCallback((accommodationIndex: number, roomIndex: number) => {
    setAccommodations((prev) =>
      prev.map((accommodation, i) =>
        i === accommodationIndex
          ? { ...accommodation, rooms: accommodation.rooms.filter((_, j) => j !== roomIndex) }
          : accommodation
      )
    );
  }, [setAccommodations]);

  const updateTransport = useCallback((index: number, field: string, value: unknown) => {
    setEventData((prev) => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        transport: prev.logistics.transport.map((transport, i) =>
          i === index ? { ...transport, [field]: value } : transport
        ),
      },
    }));
  }, [setEventData]);

  const addTransport = useCallback(() => {
    setEventData((prev) => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        transport: [...prev.logistics.transport, {
          id: crypto.randomUUID(),
          transport_type: "trailer",
          driver_name: "",
          driver_phone: "",
          license_plate: "",
          has_return: false,
          is_hoja_relevant: true,
          logistics_categories: [],
        }],
      },
    }));
  }, [setEventData]);

  const removeTransport = useCallback((index: number) => {
    setEventData((prev) => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        transport: prev.logistics.transport.filter((_, i) => i !== index),
      },
    }));
  }, [setEventData]);

  const importTransports = useCallback((transports: Transport[]) => {
    setEventData((prev) => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        transport: syncTransportsWithLogistics(
          Array.isArray(prev.logistics.transport) ? prev.logistics.transport : [],
          transports,
        ),
      },
    }));
  }, [setEventData]);

  return {
    handleContactChange,
    addContact,
    removeContact,
    handleStaffChange,
    addStaffMember,
    removeStaffMember,
    updateTravelArrangement,
    addTravelArrangement,
    removeTravelArrangement,
    updateAccommodation,
    addAccommodation,
    removeAccommodation,
    updateRoom,
    addRoom,
    removeRoom,
    updateTransport,
    addTransport,
    removeTransport,
    importTransports,
  };
};
