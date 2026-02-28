import { useState, useEffect, useCallback, useMemo } from "react";
import { EventData, TravelArrangement, Accommodation } from "@/types/hoja-de-ruta";
import { useJobSelection } from "@/hooks/useJobSelection";
import { useToast } from "@/hooks/use-toast";
import { useHojaDeRutaPersistence } from "./useHojaDeRutaPersistence";
import { useHojaDeRutaState } from "./hoja-de-ruta/useHojaDeRutaState";
import { useHojaDeRutaInitialization } from "./hoja-de-ruta/useHojaDeRutaInitialization";
import { useHojaDeRutaSave } from "./hoja-de-ruta/useHojaDeRutaSave";

export const useHojaDeRutaForm = (venueImages: { image_path: string; image_type: string }[] = []) => {
  const { toast } = useToast();
  const { data: jobs, isLoading: isLoadingJobs } = useJobSelection();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  
  // Use the state management sub-hook
  const {
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
  } = useHojaDeRutaState();

  const [hasSavedData, setHasSavedData] = useState<boolean>(false);
  const [hasBasicJobData, setHasBasicJobData] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<'none' | 'saved' | 'job' | 'mixed'>('none');
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);

  // Get persistence functions
  const {
    hojaDeRuta,
    isLoading: isLoadingHojaDeRuta,
    fetchError,
    saveHojaDeRuta,
    isSaving,
    saveTravelArrangements,
    isSavingTravel,
    saveRoomAssignments,
    isSavingRooms,
    saveVenueImages,
    isSavingImages,
    refreshData,
    resetSaveMutation,
    resetTravelMutation,
    resetRoomsMutation,
    resetImagesMutation,
    saveAccommodations,
  } = useHojaDeRutaPersistence(selectedJobId);

  console.log("🚀 FORM HOOK: Current state:", {
    selectedJobId,
    hasHojaDeRuta: !!hojaDeRuta,
    hasSavedData,
    hasBasicJobData,
    dataSource,
    isLoadingHojaDeRuta,
    eventDataEventName: eventData.eventName,
    isInitialized,
    staffCount: eventData.staff?.length || 0,
    hasStaffData: eventData.staff?.some(s => s.name || s.position) || false,
    isSaving,
    lastSaveTime: new Date(lastSaveTime).toLocaleTimeString(),
    travelCount: travelArrangements.length,
    roomsCount: accommodations.reduce((total, acc) => total + acc.rooms.length, 0),
    isDirty
  });

  // Use the initialization sub-hook
  const { autoPopulateBasicJobData } = useHojaDeRutaInitialization(
    selectedJobId,
    hojaDeRuta,
    isLoadingHojaDeRuta,
    setEventData,
    setTravelArrangements,
    setAccommodations,
    setIsInitialized,
    setHasSavedData,
    setHasBasicJobData,
    setDataSource
  );

  // Use the save sub-hook
  const { handleSaveAll, autoPopulateFromJob } = useHojaDeRutaSave(
    selectedJobId,
    eventData,
    travelArrangements,
    accommodations,
    saveHojaDeRuta,
    saveTravelArrangements,
    saveAccommodations,
    saveVenueImages,
    venueImages, // Pass venue images for saving
    isSaving,
    isSavingTravel,
    setLastSaveTime
  );

  // Reset form when job selection changes
  useEffect(() => {
    console.log("🔄 FORM: Job selection changed to:", selectedJobId);
    if (selectedJobId) {
      // Reset states when job changes
      setIsInitialized(false);
      setHasSavedData(false);
      setHasBasicJobData(false);
      setDataSource('none');
      setLastSaveTime(0);
      setIsDirty(false);

      // Reset all mutation states
      resetSaveMutation();
      resetTravelMutation();
      resetRoomsMutation();
      resetImagesMutation();

      // Data will be loaded by the initialization hook
      refreshData();
    } else {
      // Clear all data when no job is selected - handled by state hook
      setHasSavedData(false);
      setHasBasicJobData(false);
      setDataSource('none');
      setLastSaveTime(0);
      setIsInitialized(true);
    }
  }, [selectedJobId, refreshData, resetSaveMutation, resetTravelMutation, resetRoomsMutation, resetImagesMutation, setIsInitialized, setIsDirty]);

  // Display error toast if there was a fetch error
  useEffect(() => {
    if (fetchError) {
      console.error("❌ FORM: Error fetching saved data:", fetchError);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos guardados. Por favor, intente de nuevo.",
        variant: "destructive",
      });
    }
  }, [fetchError, toast]);

  // Check if form is dirty (has unsaved changes)
  const isDirtyMemo = useMemo(() => {
    if (!isInitialized) return false;
    
    const hasContent = eventData.eventName || 
                     eventData.eventDates || 
                     eventData.venue?.name ||
                     eventData.venue?.address || 
                     eventData.schedule || 
                     eventData.powerRequirements ||
                     eventData.auxiliaryNeeds || 
                     eventData.contacts?.some(c => c.name) ||
                     eventData.staff?.some(s => s.name) || 
                     travelArrangements.length > 0 ||
                     accommodations.length > 0;
    
    return hasContent;
  }, [eventData, travelArrangements, accommodations, isInitialized]);

  // Form handlers for backward compatibility
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

  const removeContact = useCallback((index: number) => {
    setEventData(prev => {
      const next = (prev.contacts || []).filter((_, i) => i !== index);
      return {
        ...prev,
        contacts: next.length > 0 ? next : [{ name: '', role: '', phone: '' }],
      };
    });
  }, [setEventData]);

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

  const removeStaffMember = useCallback((index: number) => {
    setEventData(prev => {
      const next = (prev.staff || []).filter((_, i) => i !== index);
      return {
        ...prev,
        staff: next.length > 0 ? next : [{ name: '', surname1: '', surname2: '', position: '', dni: '' }],
      };
    });
  }, [setEventData]);

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

  // Transport handlers
  const updateTransport = useCallback((index: number, field: string, value: any) => {
    setEventData(prev => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        transport: prev.logistics.transport.map((transport, i) => 
          i === index ? { ...transport, [field]: value } : transport
        )
      }
    }));
  }, [setEventData]);

  const addTransport = useCallback(() => {
    setEventData(prev => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        transport: [...prev.logistics.transport, {
          id: crypto.randomUUID(),
          transport_type: 'trailer',
          driver_name: '',
          driver_phone: '',
          license_plate: '',
          has_return: false,
          is_hoja_relevant: true,
          logistics_categories: [],
        }]
      }
    }));
  }, [setEventData]);

  const removeTransport = useCallback((index: number) => {
    setEventData(prev => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        transport: prev.logistics.transport.filter((_, i) => i !== index)
      }
    }));
  }, [setEventData]);

  const importTransports = useCallback((transports: Transport[]) => {
    setEventData(prev => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        transport: (() => {
          const current = Array.isArray(prev.logistics.transport) ? [...prev.logistics.transport] : [];

          transports.forEach((incoming) => {
            const sourceId = incoming.source_logistics_event_id || null;
            if (sourceId) {
              const existingIndex = current.findIndex(
                (transport) => transport.source_logistics_event_id === sourceId
              );

              if (existingIndex >= 0) {
                const existing = current[existingIndex];
                current[existingIndex] = {
                  ...existing,
                  transport_type: incoming.transport_type,
                  license_plate: incoming.license_plate,
                  company: incoming.company,
                  date_time: incoming.date_time,
                  source_logistics_event_id: sourceId,
                  is_hoja_relevant: incoming.is_hoja_relevant ?? true,
                  logistics_categories: incoming.logistics_categories || [],
                  driver_name: incoming.driver_name ?? existing.driver_name,
                  driver_phone: incoming.driver_phone ?? existing.driver_phone,
                  has_return: incoming.has_return ?? existing.has_return,
                };
                return;
              }
            }

            current.push(incoming);
          });

          return current;
        })()
      }
    }));
  }, [setEventData]);

  return {
    // State
    eventData,
    setEventData,
    selectedJobId,
    setSelectedJobId,
    travelArrangements,
    setTravelArrangements,
    accommodations,
    setAccommodations,
    
    // Loading states
    isLoadingJobs,
    isLoadingHojaDeRuta,
    isSaving,
    isSavingTravel,
    isSavingRooms,
    isSavingImages,
    
    // Data
    jobs,
    hojaDeRuta,
    
    // Functions
    handleSaveAll,
    autoPopulateFromJob,
    autoPopulateBasicJobData,
    refreshData,
    
    // Status flags
    isInitialized,
    hasSavedData,
    hasBasicJobData,
    dataSource,
    isDirty: isDirtyMemo,
    
    // Form handlers (for backward compatibility)
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

    // Alert system
    showAlert,
    setShowAlert,
    alertMessage,
    setAlertMessage,
    
    // Additional state
    fetchError,
    lastSaveTime
  };
};
