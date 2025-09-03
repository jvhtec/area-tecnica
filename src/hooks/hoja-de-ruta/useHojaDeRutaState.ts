import { useState, useEffect } from 'react';
import { EventData, TravelArrangement, Accommodation } from '@/types/hoja-de-ruta';

const initialEventData: EventData = {
  eventName: '',
  eventDates: '',
  venue: { name: '', address: '' },
  contacts: [{ name: '', role: '', phone: '' }],
  staff: [{ name: '', surname1: '', surname2: '', position: '', dni: '' }],
  logistics: {
    transport: [],
    loadingDetails: '',
    unloadingDetails: '',
    equipmentLogistics: ''
  },
  schedule: '',
  powerRequirements: '',
  auxiliaryNeeds: ''
};

export const useHojaDeRutaState = () => {
  const [eventData, setEventData] = useState<EventData>(initialEventData);
  const [travelArrangements, setTravelArrangements] = useState<TravelArrangement[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Reset state when job changes
  useEffect(() => {
    if (selectedJobId) {
      setEventData(initialEventData);
      setTravelArrangements([]);
      setAccommodations([]);
      setIsInitialized(false);
      setIsDirty(false);
    }
  }, [selectedJobId]);

  // Track if data has been modified
  useEffect(() => {
    const hasContent = eventData.eventName || 
                     eventData.eventDates || 
                     eventData.venue.name ||
                     eventData.venue.address || 
                     eventData.schedule || 
                     eventData.powerRequirements ||
                     eventData.auxiliaryNeeds || 
                     eventData.contacts.some(c => c.name) ||
                     eventData.staff.some(s => s.name) || 
                     travelArrangements.length > 0 ||
                     accommodations.length > 0;
    
    setIsDirty(hasContent && isInitialized);
  }, [eventData, travelArrangements, accommodations, isInitialized]);

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
    isDirty,
    setIsDirty
  };
};