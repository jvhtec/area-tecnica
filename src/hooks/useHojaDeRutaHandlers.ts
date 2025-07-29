
import { useState } from "react";
import { TravelArrangement, RoomAssignment, Accommodation, EventData, Transport } from "@/types/hoja-de-ruta";

export const useHojaDeRutaHandlers = (
  eventData: EventData,
  setEventData: React.Dispatch<React.SetStateAction<EventData>>,
  travelArrangements: TravelArrangement[],
  setTravelArrangements: React.Dispatch<React.SetStateAction<TravelArrangement[]>>,
  accommodations: Accommodation[],
  setAccommodations: React.Dispatch<React.SetStateAction<Accommodation[]>>
) => {
  // Contact handlers
  const handleContactChange = (index: number, field: string, value: string) => {
    const newContacts = [...eventData.contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setEventData({ ...eventData, contacts: newContacts });
  };

  const addContact = () => {
    setEventData({
      ...eventData,
      contacts: [...eventData.contacts, { name: "", role: "", phone: "" }],
    });
  };

  // Staff handlers
  const handleStaffChange = (index: number, field: string, value: string) => {
    const newStaff = [...eventData.staff];
    newStaff[index] = { ...newStaff[index], [field]: value };
    setEventData({ ...eventData, staff: newStaff });
  };

  const addStaffMember = () => {
    setEventData({
      ...eventData,
      staff: [
        ...eventData.staff,
        { name: "", surname1: "", surname2: "", position: "" },
      ],
    });
  };

  // Travel arrangement handlers
  const updateTravelArrangement = (
    index: number,
    field: keyof TravelArrangement,
    value: string
  ) => {
    const newArrangements = [...travelArrangements];
    newArrangements[index] = { ...newArrangements[index], [field]: value };
    setTravelArrangements(newArrangements);
  };

  const addTravelArrangement = () => {
    setTravelArrangements([
      ...travelArrangements,
      { transportation_type: "van" },
    ]);
  };

  const removeTravelArrangement = (index: number) => {
    const newArrangements = [...travelArrangements];
    newArrangements.splice(index, 1);
    setTravelArrangements(newArrangements);
  };

  // Accommodation handlers
  const updateAccommodation = (
    accommodationIndex: number,
    data: Partial<Accommodation>
  ) => {
    const newAccommodations = [...accommodations];
    newAccommodations[accommodationIndex] = {
      ...newAccommodations[accommodationIndex],
      ...data,
    };
    setAccommodations(newAccommodations);
  };

  const addAccommodation = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0).toISOString().slice(0, 16);
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0).toISOString().slice(0, 16);

    const newAccommodation: Accommodation = {
      id: `accommodation-${Date.now()}`,
      hotel_name: '',
      address: '',
      check_in: today,
      check_out: tomorrow,
      rooms: [{ room_type: "single" }]
    };
    setAccommodations([...accommodations, newAccommodation]);
  };

  const removeAccommodation = (index: number) => {
    const newAccommodations = [...accommodations];
    newAccommodations.splice(index, 1);
    setAccommodations(newAccommodations);
  };

  const updateRoom = (
    accommodationIndex: number,
    roomIndex: number,
    field: keyof RoomAssignment,
    value: any
  ) => {
    const newAccommodations = [...accommodations];
    const newRooms = [...newAccommodations[accommodationIndex].rooms];
    newRooms[roomIndex] = { ...newRooms[roomIndex], [field]: value };
    newAccommodations[accommodationIndex] = { ...newAccommodations[accommodationIndex], rooms: newRooms };
    setAccommodations(newAccommodations);
  };

  const addRoom = (accommodationIndex: number) => {
    const newAccommodations = [...accommodations];
    newAccommodations[accommodationIndex].rooms.push({ room_type: "single" });
    setAccommodations(newAccommodations);
  };

  const removeRoom = (accommodationIndex: number, roomIndex: number) => {
    const newAccommodations = [...accommodations];
    newAccommodations[accommodationIndex].rooms.splice(roomIndex, 1);
    setAccommodations(newAccommodations);
  };

  // Transport handlers
  const updateTransport = (
    index: number,
    field: keyof Transport,
    value: any
  ) => {
    const newTransport = [...eventData.logistics.transport];
    newTransport[index] = { ...newTransport[index], [field]: value };
    setEventData({ ...eventData, logistics: { ...eventData.logistics, transport: newTransport } });
  };

  const addTransport = () => {
    const newTransport: Transport = {
      id: `transport-${Date.now()}`,
      transport_type: 'trailer',
    };
    setEventData({
      ...eventData,
      logistics: {
        ...eventData.logistics,
        transport: [...eventData.logistics.transport, newTransport],
      },
    });
  };

  const removeTransport = (index: number) => {
    const newTransport = [...eventData.logistics.transport];
    newTransport.splice(index, 1);
    setEventData({ ...eventData, logistics: { ...eventData.logistics, transport: newTransport } });
  };

  return {
    handleContactChange,
    addContact,
    handleStaffChange,
    addStaffMember,
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
  };
};
