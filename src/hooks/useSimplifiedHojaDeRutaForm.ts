
import { useState, useEffect, useCallback } from "react";
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

export const useSimplifiedHojaDeRutaForm = () => {
  const { toast } = useToast();
  const { data: jobs, isLoading: isLoadingJobs } = useJobSelection();
  
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [eventData, setEventData] = useState<EventData>(initialEventData);
  const [travelArrangements, setTravelArrangements] = useState<TravelArrangement[]>([
    { transportation_type: "van" },
  ]);
  const [roomAssignments, setRoomAssignments] = useState<RoomAssignment[]>([
    { room_type: "single" },
  ]);
  
  const [dataSource, setDataSource] = useState<'none' | 'saved' | 'job' | 'mixed'>('none');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);

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
    refreshData
  } = useHojaDeRutaPersistence(selectedJobId);

  // Handle job selection change
  useEffect(() => {
    if (selectedJobId) {
      console.log("🔄 Job selected:", selectedJobId);
      setIsInitialized(false);
      setDataSource('none');
      refreshData();
    } else {
      // Clear all data when no job is selected
      setEventData(initialEventData);
      setTravelArrangements([{ transportation_type: "van" }]);
      setRoomAssignments([{ room_type: "single" }]);
      setDataSource('none');
      setIsInitialized(true);
      setIsDirty(false);
    }
  }, [selectedJobId, refreshData]);

  // Initialize data when hojaDeRuta or selectedJobId changes
  useEffect(() => {
    if (!selectedJobId || isLoadingHojaDeRuta) return;

    const initializeData = async () => {
      console.log("🔄 Initializing data...");
      
      if (hojaDeRuta) {
        // Load saved data
        console.log("✅ Loading saved data");
        loadSavedData();
        setDataSource('saved');
        toast({
          title: "✅ Datos guardados cargados",
          description: "Se han cargado tus modificaciones anteriores.",
        });
      } else {
        // Load basic job data
        console.log("📋 Loading basic job data");
        await loadBasicJobData();
        setDataSource('job');
        toast({
          title: "📋 Información básica cargada",
          description: "Se ha cargado la información básica del trabajo.",
        });
      }
      
      setIsInitialized(true);
      setIsDirty(false);
    };

    initializeData();
  }, [hojaDeRuta, selectedJobId, isLoadingHojaDeRuta]);

  // Load saved data from hojaDeRuta
  const loadSavedData = useCallback(() => {
    if (!hojaDeRuta) return;

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

    // Set travel arrangements
    if (hojaDeRuta.travel && hojaDeRuta.travel.length > 0) {
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
      setTravelArrangements([{ transportation_type: "van" }]);
    }

    // Set room assignments
    if (hojaDeRuta.rooms && hojaDeRuta.rooms.length > 0) {
      setRoomAssignments(hojaDeRuta.rooms.map((room: any) => ({
        room_type: room.room_type,
        room_number: room.room_number,
        staff_member1_id: room.staff_member1_id,
        staff_member2_id: room.staff_member2_id,
      })));
    } else {
      setRoomAssignments([{ room_type: "single" }]);
    }
  }, [hojaDeRuta]);

  // Load basic job data (name, dates, venue)
  const loadBasicJobData = useCallback(async () => {
    if (!selectedJobId) return;

    try {
      const { data: jobData, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', selectedJobId)
        .single();

      if (error) throw error;

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

      setEventData(prev => ({
        ...prev,
        eventName: jobData.title || "",
        eventDates,
        venue: {
          name: jobData.venue || "",
          address: jobData.location || ""
        },
        schedule: startDate ? `Load in: ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : "",
      }));

    } catch (error: any) {
      console.error("Error loading basic job data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información básica del trabajo.",
        variant: "destructive",
      });
    }
  }, [selectedJobId, toast]);

  // Load additional job data (power requirements, staff assignments)
  const loadAdditionalJobData = useCallback(async () => {
    if (!selectedJobId) return;

    try {
      toast({
        title: "⏳ Cargando datos adicionales...",
        description: "Obteniendo información del trabajo...",
      });

      // Fetch power requirements
      const { data: powerRequirements, error: powerError } = await supabase
        .from("power_requirement_tables")
        .select("*")
        .eq("job_id", selectedJobId);

      if (powerError) throw powerError;

      // Fetch job assignments
      const { data: jobAssignments, error: assignmentError } = await supabase
        .from('job_assignments')
        .select(`
          *,
          profiles:technician_id(first_name, last_name)
        `)
        .eq('job_id', selectedJobId);

      if (assignmentError) throw assignmentError;

      // Fetch client info
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('client_name, client_phone')
        .eq('id', selectedJobId)
        .single();

      if (jobError) throw jobError;

      // Format power requirements
      let formattedPowerRequirements = "";
      if (powerRequirements && powerRequirements.length > 0) {
        formattedPowerRequirements = powerRequirements
          .map((req: any) => {
            return `${req.department.toUpperCase()} - ${req.table_name}:\n` +
              `Potencia Total: ${req.total_watts}W\n` +
              `Corriente por Fase: ${req.current_per_phase}A\n` +
              `PDU Recomendado: ${req.pdu_type}\n`;
          })
          .join("\n");
      }

      // Format contacts
      const contacts = [];
      if (jobData.client_name) {
        contacts.push({
          name: jobData.client_name,
          role: "Cliente",
          phone: jobData.client_phone || ""
        });
      }

      // Format staff
      const staff = jobAssignments?.map((assignment: any) => ({
        name: assignment.profiles?.first_name || "",
        surname1: assignment.profiles?.last_name || "",
        surname2: "",
        position: assignment.sound_role || assignment.lights_role || assignment.video_role || "Técnico"
      })) || [];

      // Merge with existing data (don't overwrite user input)
      setEventData(prev => ({
        ...prev,
        powerRequirements: prev.powerRequirements || formattedPowerRequirements,
        contacts: prev.contacts.some(c => c.name) ? prev.contacts : 
          (contacts.length > 0 ? contacts : [{ name: "", role: "", phone: "" }]),
        staff: prev.staff.some(s => s.name) ? prev.staff : 
          (staff.length > 0 ? staff : [{ name: "", surname1: "", surname2: "", position: "" }]),
      }));

      setDataSource('mixed');
      setIsDirty(true);

      toast({
        title: "✅ Datos adicionales cargados",
        description: "Se han cargado los requisitos de potencia y asignaciones de personal.",
      });

    } catch (error: any) {
      console.error("Error loading additional job data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos adicionales del trabajo.",
        variant: "destructive",
      });
    }
  }, [selectedJobId, toast]);

  // Save all data
  const handleSaveAll = useCallback(async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Por favor, seleccione un trabajo antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "💾 Guardando...",
        description: "Guardando todos los datos...",
      });

      // Save main hoja de ruta data first
      const savedRecord = await saveHojaDeRuta(eventData);

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
        
        setDataSource('saved');
        setIsDirty(false);
        
        // Refresh data after save
        await refreshData();
        
        toast({
          title: "✅ Guardado completo",
          description: "Todos los datos se han guardado correctamente.",
        });
        
        return savedRecord;
      }
    } catch (error: any) {
      console.error("Error saving data:", error);
      toast({
        title: "❌ Error al guardar",
        description: `No se pudieron guardar los datos: ${error.message}`,
        variant: "destructive",
      });
      throw error;
    }
  }, [selectedJobId, eventData, travelArrangements, roomAssignments, saveHojaDeRuta, saveTravelArrangements, saveRoomAssignments, refreshData, toast]);

  // Track dirty state
  useEffect(() => {
    if (!isInitialized || !selectedJobId) return;

    // Check if data has changed from saved state
    if (hojaDeRuta && dataSource === 'saved') {
      const savedEventData = {
        eventName: hojaDeRuta.event_name || "",
        eventDates: hojaDeRuta.event_dates || "",
        venue: {
          name: hojaDeRuta.venue_name || "",
          address: hojaDeRuta.venue_address || "",
        },
        contacts: hojaDeRuta.contacts || [],
        logistics: hojaDeRuta.logistics || {
          transport: "",
          loadingDetails: "",
          unloadingDetails: "",
          equipmentLogistics: "",
        },
        staff: hojaDeRuta.staff || [],
        schedule: hojaDeRuta.schedule || "",
        powerRequirements: hojaDeRuta.power_requirements || "",
        auxiliaryNeeds: hojaDeRuta.auxiliary_needs || "",
      };

      const isDataDifferent = JSON.stringify(eventData) !== JSON.stringify(savedEventData);
      const areTravelArrangementsDifferent = JSON.stringify(travelArrangements) !== JSON.stringify(hojaDeRuta.travel || []);
      const areRoomAssignmentsDifferent = JSON.stringify(roomAssignments) !== JSON.stringify(hojaDeRuta.rooms || []);

      setIsDirty(isDataDifferent || areTravelArrangementsDifferent || areRoomAssignmentsDifferent);
    } else {
      // If no saved data, consider it dirty if there's any meaningful data entered
      const hasAnyData = Boolean(
        eventData.eventName || 
        eventData.eventDates || 
        eventData.venue.name || 
        eventData.schedule || 
        eventData.powerRequirements || 
        eventData.auxiliaryNeeds ||
        travelArrangements.some(arr => arr.pickup_address || arr.notes) ||
        roomAssignments.some(room => room.room_number)
      );
      setIsDirty(hasAnyData);
    }
  }, [eventData, travelArrangements, roomAssignments, hojaDeRuta, isInitialized, selectedJobId, dataSource]);

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
    isInitialized,
    isDirty,
    dataSource,
    
    // Loading states
    isLoadingJobs,
    isLoadingHojaDeRuta,
    isSaving: isSaving || isSavingTravel || isSavingRooms,
    
    // Data
    jobs,
    hojaDeRuta,
    
    // Functions
    loadAdditionalJobData,
    handleSaveAll,
    refreshData,
  };
};
