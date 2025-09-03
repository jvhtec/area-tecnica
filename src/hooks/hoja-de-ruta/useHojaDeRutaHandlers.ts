import { useCallback } from 'react';
import { EventData, TravelArrangement, Accommodation, RoomAssignment } from '@/types/hoja-de-ruta';

export const useHojaDeRutaHandlers = (
  eventData: EventData,
  setEventData: React.Dispatch<React.SetStateAction<EventData>>,
  travelArrangements: TravelArrangement[],
  setTravelArrangements: React.Dispatch<React.SetStateAction<TravelArrangement[]>>,
  accommodations: Accommodation[],
  setAccommodations: React.Dispatch<React.SetStateAction<Accommodation[]>>
) => {
  // Contact handlers
  const handleContactChange = useCallback((index: number, field: string, value: string) => {
    setEventData(prev => ({
      ...prev,
      contacts: prev.contacts?.map((contact, i) => 
        i === index ? { ...contact, [field]: value } : contact
      ) || []
    }));
  }, [setEventData]);

  const addContact = useCallback(() => {
    setEventData(prev => ({
      ...prev,
      contacts: [...(prev.contacts || []), { name: '', role: '', phone: '' }]
    }));
  }, [setEventData]);

  // Staff handlers
  const handleStaffChange = useCallback((index: number, field: string, value: string) => {
    setEventData(prev => ({
      ...prev,
      staff: prev.staff?.map((staff, i) => 
        i === index ? { ...staff, [field]: value } : staff
      ) || []
    }));
  }, [setEventData]);

  const addStaffMember = useCallback(() => {
    setEventData(prev => ({
      ...prev,
      staff: [...(prev.staff || []), { name: '', surname1: '', surname2: '', position: '', dni: '' }]
    }));
  }, [setEventData]);

  // Travel arrangement handlers
  const updateTravelArrangement = useCallback((index: number, field: string, value: string) => {
    setTravelArrangements(prev => 
      prev.map((arrangement, i) => 
        i === index ? { ...arrangement, [field]: value } : arrangement
      )
    );
  }, [setTravelArrangements]);

  const addTravelArrangement = useCallback(() => {
    setTravelArrangements(prev => [...prev, {
      transportation_type: 'van' as const,
      pickup_address: '',
      pickup_time: '',
      departure_time: '',
      arrival_time: '',
      flight_train_number: '',
      driver_name: '',
      driver_phone: '',
      plate_number: '',
      notes: ''
    }]);
  }, [setTravelArrangements]);

  const removeTravelArrangement = useCallback((index: number) => {
    setTravelArrangements(prev => prev.filter((_, i) => i !== index));
  }, [setTravelArrangements]);

  // Accommodation handlers
  const updateAccommodation = useCallback((index: number, field: string, value: any) => {
    setAccommodations(prev => 
      prev.map((accommodation, i) => 
        i === index ? { ...accommodation, [field]: value } : accommodation
      )
    );
  }, [setAccommodations]);

  const addAccommodation = useCallback(() => {
    setAccommodations(prev => [...prev, {
      id: crypto.randomUUID(),
      hotel_name: '',
      address: '',
      check_in: '',
      check_out: '',
      rooms: []
    }]);
  }, [setAccommodations]);

  const removeAccommodation = useCallback((index: number) => {
    setAccommodations(prev => prev.filter((_, i) => i !== index));
  }, [setAccommodations]);

  // Room handlers
  const updateRoom = useCallback((accommodationIndex: number, roomIndex: number, field: string, value: string) => {
    setAccommodations(prev => 
      prev.map((accommodation, i) => 
        i === accommodationIndex ? {
          ...accommodation,
          rooms: accommodation.rooms.map((room, j) => 
            j === roomIndex ? { ...room, [field]: value } : room
          )
        } : accommodation
      )
    );
  }, [setAccommodations]);

  const addRoom = useCallback((accommodationIndex: number) => {
    setAccommodations(prev => 
      prev.map((accommodation, i) => 
        i === accommodationIndex ? {
          ...accommodation,
          rooms: [...accommodation.rooms, {
            room_type: 'single' as const,
            room_number: '',
            staff_member1_id: '',
            staff_member2_id: ''
          }]
        } : accommodation
      )
    );
  }, [setAccommodations]);

  const removeRoom = useCallback((accommodationIndex: number, roomIndex: number) => {
    setAccommodations(prev => 
      prev.map((accommodation, i) => 
        i === accommodationIndex ? {
          ...accommodation,
          rooms: accommodation.rooms.filter((_, j) => j !== roomIndex)
        } : accommodation
      )
    );
  }, [setAccommodations]);

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
    removeRoom
  };
};