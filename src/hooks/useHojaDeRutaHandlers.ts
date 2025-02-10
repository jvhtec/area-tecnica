
import { useState } from "react";
import { TravelArrangement, RoomAssignment, EventData } from "@/types/hoja-de-ruta";

export const useHojaDeRutaHandlers = (
  eventData: EventData,
  setEventData: React.Dispatch<React.SetStateAction<EventData>>,
  travelArrangements: TravelArrangement[],
  setTravelArrangements: React.Dispatch<React.SetStateAction<TravelArrangement[]>>,
  roomAssignments: RoomAssignment[],
  setRoomAssignments: React.Dispatch<React.SetStateAction<RoomAssignment[]>>
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

  // Room assignment handlers
  const updateRoomAssignment = (
    index: number,
    field: keyof RoomAssignment,
    value: string
  ) => {
    const newAssignments = [...roomAssignments];
    newAssignments[index] = { ...newAssignments[index], [field]: value as any };
    setRoomAssignments(newAssignments);
  };

  const addRoomAssignment = () => {
    setRoomAssignments([...roomAssignments, { room_type: "single" }]);
  };

  const removeRoomAssignment = (index: number) => {
    const newAssignments = [...roomAssignments];
    newAssignments.splice(index, 1);
    setRoomAssignments(newAssignments);
  };

  return {
    handleContactChange,
    addContact,
    handleStaffChange,
    addStaffMember,
    updateTravelArrangement,
    addTravelArrangement,
    removeTravelArrangement,
    updateRoomAssignment,
    addRoomAssignment,
    removeRoomAssignment,
  };
};
