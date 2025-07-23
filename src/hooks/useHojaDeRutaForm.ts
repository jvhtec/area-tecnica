
import { useState, useEffect, useCallback, useRef } from "react";
import { EventData, TravelArrangement, RoomAssignment } from "@/types/hoja-de-ruta";
import { useJobSelection } from "@/hooks/useJobSelection";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useHojaDeRutaPersistence } from "./useHojaDeRutaPersistence";

const initialEventData: EventData = {
  eventName: "",
  eventDates: "",
  venue: {
    name: "",
    address: "",
  },
  contacts: [{ name: "", role: "", phone: "" }],
  logistics: {
    transport: "",
    loadingDetails: "",
    unloadingDetails: "",
    equipmentLogistics: "",
  },
  staff: [{ name: "", surname1: "", surname2: "", position: "" }],
  schedule: "",
  powerRequirements: "",
  auxiliaryNeeds: "",
};

export const useHojaDeRutaForm = () => {
  const { toast } = useToast();
  const { data: jobs, isLoading: isLoadingJobs } = useJobSelection();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [eventData, setEventData] = useState<EventData>(initialEventData);
  // Change default to empty arrays instead of having one empty entry
  const [travelArrangements, setTravelArrangements] = useState<TravelArrangement[]>([]);
  const [roomAssignments, setRoomAssignments] = useState<RoomAssignment[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [hasSavedData, setHasSavedData] = useState<boolean>(false);
  const [hasBasicJobData, setHasBasicJobData] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<'none' | 'saved' | 'job' | 'mixed'>('none');
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);
  
  // Refs for better state management
  const saveInProgressRef = useRef<boolean>(false);
  const lastSaveDataRef = useRef<string>("");

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
    resetImagesMutation
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
    staffCount: eventData.staff.length,
    hasStaffData: eventData.staff.some(s => s.name || s.position),
    isSaving,
    saveInProgress: saveInProgressRef.current,
    lastSaveTime: new Date(lastSaveTime).toLocaleTimeString(),
    travelCount: travelArrangements.length,
    roomsCount: roomAssignments.length
  });

  // Enhanced auto-populate function that includes job assignments
  const autoPopulateBasicJobData = useCallback(async (jobId: string) => {
    if (!jobId) return;
    
    console.log("🔄 FORM: Auto-populating basic job data with assignments for:", jobId);
    
    try {
      // Fetch comprehensive job data including assignments
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          *,
          job_assignments(
            *,
            profiles:technician_id(first_name, last_name)
          )
        `)
        .eq('id', jobId)
        .single();

      if (jobError) {
        console.error("❌ FORM: Error fetching job data:", jobError);
        return;
      }

      if (!jobData) {
        console.log("❌ FORM: No job data found for:", jobId);
        return;
      }

      // Prepare basic event data
      const startDate = jobData.start_time ? new Date(jobData.start_time) : null;
      const endDate = jobData.end_time ? new Date(jobData.end_time) : null;
      
      let eventDates = "";
      if (startDate && endDate) {
        if (startDate.toDateString() === endDate.toDateString()) {
          eventDates = startDate.toLocaleDateString('es-ES');
        } else {
          eventDates = `${startDate.toLocaleDateString('es-ES')} - ${endDate.toLocaleDateString('es-ES')}`;
        }
      }

      // Prepare staff data from job assignments
      const staffFromAssignments = jobData.job_assignments?.map((assignment: any) => ({
        name: assignment.profiles?.first_name || "",
        surname1: assignment.profiles?.last_name || "",
        surname2: "",
        position: assignment.sound_role || assignment.lights_role || assignment.video_role || "Técnico"
      })) || [];

      const basicEventData: EventData = {
        eventName: jobData.title || "",
        eventDates,
        venue: {
          name: jobData.venue || "",
          address: jobData.location || "",
        },
        contacts: jobData.client_name ? [{
          name: jobData.client_name,
          role: "Cliente",
          phone: jobData.client_phone || ""
        }] : [{ name: "", role: "", phone: "" }],
        logistics: {
          transport: "",
          loadingDetails: "",
          unloadingDetails: "",
          equipmentLogistics: "",
        },
        // Use staff from assignments if available, otherwise default empty entry
        staff: staffFromAssignments.length > 0 ? staffFromAssignments : [{ name: "", surname1: "", surname2: "", position: "" }],
        schedule: startDate ? `Load in: ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : "",
        powerRequirements: "",
        auxiliaryNeeds: "",
      };

      console.log("✅ FORM: Setting basic job data with assignments:", {
        eventName: basicEventData.eventName,
        staffCount: basicEventData.staff.length,
        staffData: basicEventData.staff
      });
      
      setEventData(basicEventData);
      setHasBasicJobData(true);
      setDataSource('job');
      
      toast({
        title: "📋 Datos básicos cargados",
        description: staffFromAssignments.length > 0 
          ? `Se han cargado los datos básicos del trabajo y ${staffFromAssignments.length} miembros del personal asignado.`
          : "Se han cargado los datos básicos del trabajo seleccionado.",
      });
    } catch (error: any) {
      console.error("❌ FORM: Error auto-populating basic job data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos básicos del trabajo.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Initialize form with existing saved data when hojaDeRuta changes
  useEffect(() => {
    console.log("🔄 FORM: Saved data initialization effect triggered");
    console.log("🔄 FORM: selectedJobId:", selectedJobId);
    console.log("🔄 FORM: hojaDeRuta:", hojaDeRuta ? "Found saved data" : "No saved data");
    
    if (selectedJobId && hojaDeRuta) {
      console.log("✅ FORM: Initializing form with SAVED data (takes priority)");
      setHasSavedData(true);
      setHasBasicJobData(false);
      setDataSource('saved');
      
      setEventData({
        eventName: hojaDeRuta.event_name || "",
        eventDates: hojaDeRuta.event_dates || "",
        venue: {
          name: hojaDeRuta.venue_name || "",
          address: hojaDeRuta.venue_address || "",
        },
        contacts: hojaDeRuta.contacts?.length > 0 
          ? hojaDeRuta.contacts.map((contact: any) => ({
              name: contact.name || "",
              role: contact.role || "",
              phone: contact.phone || "",
            }))
          : [{ name: "", role: "", phone: "" }],
        logistics: {
          transport: hojaDeRuta.logistics?.transport || "",
          loadingDetails: hojaDeRuta.logistics?.loading_details || "",
          unloadingDetails: hojaDeRuta.logistics?.unloading_details || "",
          equipmentLogistics: hojaDeRuta.logistics?.equipment_logistics || "",
        },
        staff: hojaDeRuta.staff?.length > 0
          ? hojaDeRuta.staff.map((member: any) => ({
              name: member.name || "",
              surname1: member.surname1 || "",
              surname2: member.surname2 || "",
              position: member.position || "",
            }))
          : [{ name: "", surname1: "", surname2: "", position: "" }],
        schedule: hojaDeRuta.schedule || "",
        powerRequirements: hojaDeRuta.power_requirements || "",
        auxiliaryNeeds: hojaDeRuta.auxiliary_needs || "",
      });

      // Set travel arrangements - use empty array if no data
      if (hojaDeRuta.travel && hojaDeRuta.travel.length > 0) {
        console.log("🚗 FORM: Setting saved travel arrangements:", hojaDeRuta.travel.length);
        setTravelArrangements(hojaDeRuta.travel.map((arr: any) => ({
          transportation_type: arr.transportation_type,
          pickup_address: arr.pickup_address,
          pickup_time: arr.pickup_time,
          departure_time: arr.departure_time,
          arrival_time: arr.arrival_time,
          flight_train_number: arr.flight_train_number,
          notes: arr.notes,
        })));
      } else {
        setTravelArrangements([]);
      }

      // Set room assignments - use empty array if no data
      if (hojaDeRuta.rooms && hojaDeRuta.rooms.length > 0) {
        console.log("🏨 FORM: Setting saved room assignments:", hojaDeRuta.rooms.length);
        setRoomAssignments(hojaDeRuta.rooms.map((room: any) => ({
          room_type: room.room_type,
          room_number: room.room_number,
          staff_member1_id: room.staff_member1_id,
          staff_member2_id: room.staff_member2_id,
        })));
      } else {
        setRoomAssignments([]);
      }
      
      setIsInitialized(true);
      
      // Update last save data reference
      lastSaveDataRef.current = JSON.stringify({
        eventData: eventData,
        travelArrangements,
        roomAssignments
      });
      
      toast({
        title: "✅ Datos guardados cargados",
        description: "Se han cargado los datos previamente guardados para este trabajo.",
      });
    } else if (selectedJobId && !hojaDeRuta && !isLoadingHojaDeRuta) {
      // No saved data found - auto-populate basic job data with assignments
      console.log("🆕 FORM: No saved data found, auto-populating basic job data with assignments");
      setHasSavedData(false);
      autoPopulateBasicJobData(selectedJobId);
      setTravelArrangements([]);
      setRoomAssignments([]);
      setIsInitialized(true);
    }
  }, [hojaDeRuta, selectedJobId, isLoadingHojaDeRuta, autoPopulateBasicJobData]);

  // Reset form when job selection changes
  useEffect(() => {
    console.log("🔄 FORM: Job selection changed to:", selectedJobId);
    if (selectedJobId) {
      setIsInitialized(false);
      setHasSavedData(false);
      setHasBasicJobData(false);
      setDataSource('none');
      setLastSaveTime(0);
      saveInProgressRef.current = false;
      lastSaveDataRef.current = "";
      
      // Reset all mutation states
      resetSaveMutation();
      resetTravelMutation();
      resetRoomsMutation();
      resetImagesMutation();
      
      // Data will be loaded by the persistence hook and then auto-populated if needed
      refreshData();
    } else {
      // Clear all data when no job is selected
      setEventData(initialEventData);
      setTravelArrangements([]);
      setRoomAssignments([]);
      setHasSavedData(false);
      setHasBasicJobData(false);
      setDataSource('none');
      setLastSaveTime(0);
      saveInProgressRef.current = false;
      lastSaveDataRef.current = "";
      setIsInitialized(true);
    }
  }, [selectedJobId, refreshData, resetSaveMutation, resetTravelMutation, resetRoomsMutation, resetImagesMutation]);

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

  // Enhanced function to fetch and merge additional job data (now mainly for power requirements)
  const autoPopulateFromJob = useCallback(async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "No hay trabajo seleccionado para auto-completar.",
        variant: "destructive",
      });
      return;
    }

    console.log("🔄 FORM: Auto-populating additional job data (power requirements) for:", selectedJobId);
    
    try {
      // Fetch power requirements
      const { data: powerRequirements, error: powerError } = await supabase
        .from("power_requirement_tables")
        .select("*")
        .eq("job_id", selectedJobId);

      if (powerError) throw powerError;

      let updatedEventData = { ...eventData };

      // Always update power requirements if available
      if (powerRequirements && powerRequirements.length > 0) {
        console.log("⚡ FORM: Updating power requirements");
        updatedEventData.powerRequirements = powerRequirements
          .map((req: any) => {
            return `${req.department.toUpperCase()} - ${req.table_name}:\n` +
              `Potencia Total: ${req.total_watts}W\n` +
              `Corriente por Fase: ${req.current_per_phase}A\n` +
              `PDU Recomendado: ${req.pdu_type}\n`;
          })
          .join("\n");
      }

      // Update the event data
      setEventData(updatedEventData);
      setDataSource(hasSavedData ? 'mixed' : 'job');
      
      console.log("✅ FORM: Power requirements loaded successfully");
      toast({
        title: "✅ Requisitos técnicos cargados",
        description: "Se han cargado los requisitos técnicos del trabajo.",
      });
    } catch (error: any) {
      console.error("❌ FORM: Error auto-populating additional job data:", error);
      toast({
        title: "Error",
        description: "No se pudieron obtener los datos adicionales del trabajo.",
        variant: "destructive",
      });
    }
  }, [selectedJobId, eventData, hasSavedData, toast]);

  // Enhanced save function with better error handling and debouncing
  const handleSaveAll = useCallback(async () => {
    console.log("💾 FORM: handleSaveAll called with selectedJobId:", selectedJobId);
    
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Por favor, seleccione un trabajo antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    // Prevent multiple simultaneous saves
    if (saveInProgressRef.current) {
      console.log("⏳ FORM: Save already in progress, skipping");
      return;
    }

    // Debouncing: prevent saves too close together
    const now = Date.now();
    if (now - lastSaveTime < 2000) {
      console.log("⏳ FORM: Save too recent, debouncing");
      return;
    }

    saveInProgressRef.current = true;
    setLastSaveTime(now);

    try {
      console.log("💾 FORM: Starting comprehensive save process...");
      
      // Save main hoja de ruta data first
      const savedRecord = await saveHojaDeRuta(eventData);
      console.log("✅ FORM: Main record saved:", savedRecord);

      if (savedRecord?.id) {
        // Save travel arrangements and room assignments in parallel
        await Promise.all([
          saveTravelArrangements({
            hojaDeRutaId: savedRecord.id,
            arrangements: travelArrangements,
          }),
          saveRoomAssignments({
            hojaDeRutaId: savedRecord.id,
            assignments: roomAssignments,
          })
        ]);
        
        console.log("✅ FORM: All data saved successfully");
        setHasSavedData(true);
        setDataSource('saved');
        
        // Update last save data reference
        lastSaveDataRef.current = JSON.stringify({
          eventData,
          travelArrangements,
          roomAssignments
        });
        
        toast({
          title: "✅ Guardado completo",
          description: "Todos los datos se han guardado correctamente.",
        });
        
        return savedRecord;
      } else {
        console.error("❌ FORM: No saved record ID returned");
        throw new Error("No se pudo obtener el ID del registro guardado");
      }
    } catch (error: any) {
      console.error("❌ FORM: Error in handleSaveAll:", error);
      toast({
        title: "❌ Error al guardar",
        description: `No se pudieron guardar los datos: ${error.message}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      saveInProgressRef.current = false;
    }
  }, [
    selectedJobId, 
    eventData, 
    travelArrangements, 
    roomAssignments, 
    saveHojaDeRuta, 
    saveTravelArrangements, 
    saveRoomAssignments, 
    lastSaveTime,
    toast
  ]);

  // Improved isDirty function with better reliability
  const isDirty = useCallback(() => {
    if (!selectedJobId || !isInitialized) return false;
    
    // Create current data snapshot
    const currentData = JSON.stringify({
      eventData,
      travelArrangements,
      roomAssignments
    });
    
    // Compare with last saved data
    const hasChanges = currentData !== lastSaveDataRef.current;
    
    // Also check if any field has meaningful content
    const hasContent = 
      eventData.eventName?.trim() !== "" ||
      eventData.eventDates?.trim() !== "" ||
      eventData.venue.name?.trim() !== "" ||
      eventData.venue.address?.trim() !== "" ||
      eventData.schedule?.trim() !== "" ||
      eventData.powerRequirements?.trim() !== "" ||
      eventData.auxiliaryNeeds?.trim() !== "" ||
      eventData.contacts.some(c => c.name?.trim() !== "" || c.role?.trim() !== "" || c.phone?.trim() !== "") ||
      eventData.staff.some(s => s.name?.trim() !== "" || s.surname1?.trim() !== "" || s.position?.trim() !== "") ||
      eventData.logistics.transport?.trim() !== "" ||
      eventData.logistics.loadingDetails?.trim() !== "" ||
      eventData.logistics.unloadingDetails?.trim() !== "" ||
      eventData.logistics.equipmentLogistics?.trim() !== "" ||
      travelArrangements.some(t => t.pickup_address || t.pickup_time || t.departure_time || t.arrival_time || t.flight_train_number || t.notes) ||
      roomAssignments.some(r => r.room_number || r.staff_member1_id || r.staff_member2_id);

    return hasContent && (hasChanges || !hasSavedData);
  }, [selectedJobId, isInitialized, eventData, travelArrangements, roomAssignments, hasSavedData]);

  return {
    // Data state
    eventData,
    setEventData,
    selectedJobId,
    setSelectedJobId,
    travelArrangements,
    setTravelArrangements,
    roomAssignments,
    setRoomAssignments,
    
    // UI state
    showAlert,
    setShowAlert,
    alertMessage,
    setAlertMessage,
    isInitialized,
    hasSavedData,
    hasBasicJobData,
    dataSource,
    isDirty: isDirty(),
    
    // Loading states
    isLoadingJobs,
    isLoadingHojaDeRuta,
    isSaving: isSaving || isSavingTravel || isSavingRooms || isSavingImages || saveInProgressRef.current,
    
    // Data
    jobs,
    hojaDeRuta,
    
    // Functions
    autoPopulateFromJob,
    handleSaveAll,
    refreshData,
    
    // Persistence functions
    saveHojaDeRuta,
    saveTravelArrangements,
    saveRoomAssignments,
    saveVenueImages,
  };
};
