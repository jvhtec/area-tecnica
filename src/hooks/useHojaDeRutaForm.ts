
import { useState, useEffect, useCallback, useRef } from "react";
import { EventData, TravelArrangement, RoomAssignment, Accommodation } from "@/types/hoja-de-ruta";
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
    transport: [],
    loadingDetails: "",
    unloadingDetails: "",
    equipmentLogistics: "",
  },
  staff: [{ name: "", surname1: "", surname2: "", position: "" }],
  schedule: "",
  powerRequirements: "",
  auxiliaryNeeds: "",
  weather: undefined,
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
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [hasSavedData, setHasSavedData] = useState<boolean>(false);
  const [hasBasicJobData, setHasBasicJobData] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<'none' | 'saved' | 'job' | 'mixed'>('none');
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);

  useEffect(() => {
    console.log('Form state changed:', {
      eventData,
      travelArrangements,
      accommodations,
    });
  }, [eventData, travelArrangements, accommodations]);
  
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
    staffCount: eventData.staff.length,
    hasStaffData: eventData.staff.some(s => s.name || s.position),
    isSaving,
    saveInProgress: saveInProgressRef.current,
    lastSaveTime: new Date(lastSaveTime).toLocaleTimeString(),
    travelCount: travelArrangements.length,
    roomsCount: accommodations.reduce((total, acc) => total + acc.rooms.length, 0)
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
          transport: [],
          loadingDetails: "",
          unloadingDetails: "",
          equipmentLogistics: "",
        },
        // Use staff from assignments if available, otherwise default empty entry
        staff: staffFromAssignments.length > 0 ? staffFromAssignments : [{ name: "", surname1: "", surname2: "", position: "" }],
        schedule: startDate ? `Load in: ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : "",
        powerRequirements: "",
        auxiliaryNeeds: "",
        weather: undefined,
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

  // Load current job assignments (always fetch assignments when job is selected)
  const loadCurrentJobAssignments = useCallback(async (jobId: string) => {
    if (!jobId) return null;
    
    console.log("👥 FORM: Loading current job assignments for:", jobId);
    
    try {
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

      if (jobError || !jobData) {
        console.error("❌ FORM: Error fetching job assignments:", jobError);
        return null;
      }

      const staffFromAssignments = jobData.job_assignments?.map((assignment: any) => ({
        name: assignment.profiles?.first_name || "",
        surname1: assignment.profiles?.last_name || "",
        surname2: "",
        position: assignment.sound_role || assignment.lights_role || assignment.video_role || "Técnico"
      })) || [];

      console.log("✅ FORM: Loaded current assignments:", staffFromAssignments);
      return { jobData, staffFromAssignments };
    } catch (error) {
      console.error("❌ FORM: Error loading job assignments:", error);
      return null;
    }
  }, []);

  // Initialize form with current job assignments ALWAYS, then merge with saved data if exists
  useEffect(() => {
    if (!selectedJobId || isLoadingHojaDeRuta) return;
    
    console.log("🔄 FORM: Initialization effect triggered for job:", selectedJobId);
    
    const initializeFormData = async () => {
      // Always load current job assignments first
      const assignmentData = await loadCurrentJobAssignments(selectedJobId);
      
      if (!assignmentData) {
        console.log("❌ FORM: No assignment data available");
        setIsInitialized(true);
        return;
      }

      const { jobData, staffFromAssignments } = assignmentData;
      
      // Prepare basic event data from job
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

      // If we have saved data, merge current assignments with saved data
      if (hojaDeRuta) {
        console.log("✅ FORM: Initializing with SAVED data + current assignments");
        setHasSavedData(true);
        setDataSource('saved');
        
        // Use the transformed data from the persistence hook
        const savedEventData = hojaDeRuta.eventData;
        console.log("🔍 FORM: Retrieved savedEventData:", savedEventData);
        console.log("🔍 FORM: Full hojaDeRuta object:", hojaDeRuta);
        
        setEventData({
          eventName: savedEventData?.eventName || jobData.title || "",
          eventDates: savedEventData?.eventDates || eventDates,
          venue: {
            name: savedEventData?.venue?.name || jobData.venue || "",
            address: savedEventData?.venue?.address || jobData.location || "",
            coordinates: savedEventData?.venue?.coordinates
          },
          contacts: savedEventData?.contacts?.length > 0 
            ? savedEventData.contacts
            : jobData.client_name ? [{
                name: jobData.client_name,
                role: "Cliente",
                phone: jobData.client_phone || ""
              }] : [{ name: "", role: "", phone: "" }],
          logistics: savedEventData?.logistics || {
            transport: [],
            loadingDetails: "",
            unloadingDetails: "",
            equipmentLogistics: "",
          },
          // Prioritize current assignments over saved staff
          staff: staffFromAssignments.length > 0
            ? staffFromAssignments 
            : savedEventData?.staff?.length > 0
              ? savedEventData.staff
              : [{ name: "", surname1: "", surname2: "", position: "", dni: "" }],
          schedule: savedEventData?.schedule || (startDate ? `Load in: ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ""),
          powerRequirements: savedEventData?.powerRequirements || "",
          auxiliaryNeeds: savedEventData?.auxiliaryNeeds || "",
          weather: savedEventData?.weather || undefined,
        });

        // Set travel arrangements using transformed data
        if (hojaDeRuta.travelArrangements && hojaDeRuta.travelArrangements.length > 0) {
          setTravelArrangements(hojaDeRuta.travelArrangements);
        }

        // Set accommodations using transformed data  
        if (hojaDeRuta.accommodations && hojaDeRuta.accommodations.length > 0) {
          setAccommodations(hojaDeRuta.accommodations);
        }
        
        toast({
          title: "✅ Datos cargados",
          description: `Se han cargado los datos guardados con ${staffFromAssignments.length} miembros del personal actual.`,
        });
      } else {
        // No saved data - use current job data with assignments
        console.log("🆕 FORM: No saved data, using current job data with assignments");
        setHasSavedData(false);
        setDataSource('job');
        
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
            transport: [],
            loadingDetails: "",
            unloadingDetails: "",
            equipmentLogistics: "",
          },
          staff: staffFromAssignments.length > 0 ? staffFromAssignments : [{ name: "", surname1: "", surname2: "", position: "" }],
          schedule: startDate ? `Load in: ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : "",
          powerRequirements: "",
          auxiliaryNeeds: "",
          weather: undefined,
        };
        
        setEventData(basicEventData);
        setTravelArrangements([]);
        setAccommodations([]);
        
        toast({
          title: "📋 Datos del trabajo cargados",
          description: staffFromAssignments.length > 0 
            ? `Se han cargado ${staffFromAssignments.length} miembros del personal asignado.`
            : "Se han cargado los datos básicos del trabajo.",
        });
      }
      
      setIsInitialized(true);
    };

    initializeFormData();
  }, [selectedJobId, hojaDeRuta, isLoadingHojaDeRuta, loadCurrentJobAssignments, toast]);

  // Reset form when job selection changes
  useEffect(() => {
    console.log("🔄 FORM: Job selection changed to:", selectedJobId);
    if (selectedJobId) {
      // Only reset if we're not in the middle of a save AND the job ID has actually changed
      if (!saveInProgressRef.current && !lastSaveDataRef.current.includes(selectedJobId)) {
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
      }
    } else {
      // Clear all data when no job is selected
      setEventData(initialEventData);
      setTravelArrangements([]);
      setAccommodations([]);
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
      console.log("📝 FORM: Data to save - EventData:", JSON.stringify(eventData, null, 2));
      console.log("📝 FORM: Data to save - Travel Arrangements:", JSON.stringify(travelArrangements, null, 2));
      console.log("📝 FORM: Data to save - Accommodations:", JSON.stringify(accommodations, null, 2));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Save main hoja de ruta data first
      const savedRecord = await saveHojaDeRuta({ eventData, userId: user.id });
      console.log("✅ FORM: Main record saved:", savedRecord);

      if (savedRecord?.id) {
        // Save travel arrangements, accommodations, and images in parallel
        await Promise.all([
          saveTravelArrangements(travelArrangements),
          saveAccommodations(accommodations),
          saveVenueImages(eventData.venue.images || []),
        ]);

        console.log("✅ FORM: All data saved successfully");
        setHasSavedData(true);
        setDataSource('saved');

        // Update last save data reference
        lastSaveDataRef.current = JSON.stringify({
          eventData,
          travelArrangements,
          accommodations
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
    accommodations,
    saveHojaDeRuta,
    saveTravelArrangements,
    saveAccommodations,
    saveVenueImages,
    lastSaveTime,
    toast,
  ]);

  // Improved isDirty function with better reliability
  const isDirty = useCallback(() => {
    if (!selectedJobId || !isInitialized) return false;
    
    // Create current data snapshot
    const currentData = JSON.stringify({
      eventData,
      travelArrangements,
      accommodations
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
      eventData.logistics.transport.length > 0 ||
      eventData.logistics.loadingDetails?.trim() !== "" ||
      eventData.logistics.unloadingDetails?.trim() !== "" ||
      eventData.logistics.equipmentLogistics?.trim() !== "" ||
      travelArrangements.some(t => t.pickup_address || t.pickup_time || t.departure_time || t.arrival_time || t.flight_train_number || t.notes) ||
      accommodations.some(acc => acc.hotel_name || acc.address || acc.rooms.some(r => r.room_number || r.staff_member1_id || r.staff_member2_id));

    return hasContent && (hasChanges || !hasSavedData);
  }, [selectedJobId, isInitialized, eventData, travelArrangements, accommodations, hasSavedData]);

  return {
    // Data state
    eventData,
    setEventData,
    selectedJobId,
    setSelectedJobId,
    travelArrangements,
    setTravelArrangements,
    accommodations,
    setAccommodations,
    
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
    // saveRoomAssignments, // Deprecated
    saveVenueImages,
  };
};
