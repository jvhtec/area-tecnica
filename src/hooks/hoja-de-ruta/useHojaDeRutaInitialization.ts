import { useCallback, useEffect } from 'react';
import { EventData } from '@/types/hoja-de-ruta';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export const useHojaDeRutaInitialization = (
  selectedJobId: string,
  hojaDeRuta: any,
  isLoadingHojaDeRuta: boolean,
  setEventData: React.Dispatch<React.SetStateAction<EventData>>,
  setTravelArrangements: any,
  setAccommodations: any,
  setIsInitialized: React.Dispatch<React.SetStateAction<boolean>>,
  setHasSavedData: React.Dispatch<React.SetStateAction<boolean>>,
  setHasBasicJobData: React.Dispatch<React.SetStateAction<boolean>>,
  setDataSource: React.Dispatch<React.SetStateAction<'none' | 'saved' | 'job' | 'mixed'>>
) => {
  const { toast } = useToast();

  // Load current job assignments
  const loadCurrentJobAssignments = useCallback(async (jobId: string) => {
    if (!jobId) return null;
    
    console.log("👥 INITIALIZATION: Loading current job assignments for:", jobId);
    
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          *,
          location:locations(name, formatted_address, latitude, longitude),
          job_assignments(
            *,
            profiles:technician_id(first_name, last_name)
          )
        `)
        .eq('id', jobId)
        .single();

      if (jobError || !jobData) {
        console.error("❌ INITIALIZATION: Error fetching job assignments:", jobError);
        return null;
      }

      const staffFromAssignments = jobData.job_assignments?.map((assignment: any) => ({
        name: assignment.profiles?.first_name || "",
        surname1: assignment.profiles?.last_name || "",
        surname2: "",
        position: assignment.sound_role || assignment.lights_role || assignment.video_role || "Técnico",
        dni: ""
      })) || [];

      console.log("✅ INITIALIZATION: Loaded current assignments:", staffFromAssignments);
      return { jobData, staffFromAssignments };
    } catch (error) {
      console.error("❌ INITIALIZATION: Error loading job assignments:", error);
      return null;
    }
  }, []);

  // Auto-populate basic job data with assignments
  const autoPopulateBasicJobData = useCallback(async (jobId: string) => {
    if (!jobId) return;
    
    console.log("🔄 INITIALIZATION: Auto-populating basic job data with assignments for:", jobId);
    
    try {
      const assignmentData = await loadCurrentJobAssignments(jobId);
      if (!assignmentData) return;

      const { jobData, staffFromAssignments } = assignmentData;

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

      const basicEventData: EventData = {
        eventName: jobData.title || "",
        eventDates,
        venue: {
          name: jobData.location?.name || "",
          address: jobData.location?.formatted_address || "",
          coordinates: jobData.location?.latitude != null && jobData.location?.longitude != null
            ? { lat: jobData.location.latitude, lng: jobData.location.longitude }
            : undefined,
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
        staff: staffFromAssignments.length > 0 ? staffFromAssignments : [{ name: "", surname1: "", surname2: "", position: "", dni: "" }],
        schedule: startDate ? `Load in: ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : "",
        powerRequirements: "",
        auxiliaryNeeds: "",
        weather: undefined,
      };

      console.log("✅ INITIALIZATION: Setting basic job data with assignments:", {
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
      console.error("❌ INITIALIZATION: Error auto-populating basic job data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos básicos del trabajo.",
        variant: "destructive",
      });
    }
  }, [toast, loadCurrentJobAssignments, setEventData, setHasBasicJobData, setDataSource]);

  // Initialize form with current job assignments, then merge with saved data if exists
  useEffect(() => {
    if (!selectedJobId || isLoadingHojaDeRuta) return;
    
    console.log("🔄 INITIALIZATION: Initialization effect triggered for job:", selectedJobId);
    
    const initializeFormData = async () => {
      // Always load current job assignments first
      const assignmentData = await loadCurrentJobAssignments(selectedJobId);
      
      if (!assignmentData) {
        console.log("❌ INITIALIZATION: No assignment data available");
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
        console.log("✅ INITIALIZATION: Initializing with SAVED data + current assignments");
        setHasSavedData(true);
        setDataSource('saved');
        
        const savedEventData = hojaDeRuta.eventData;
        
        setEventData({
          eventName: savedEventData?.eventName || jobData.title || "",
          eventDates: savedEventData?.eventDates || eventDates,
          venue: {
            name: savedEventData?.venue?.name || jobData.location?.name || "",
            address: savedEventData?.venue?.address || jobData.location?.formatted_address || "",
            coordinates: savedEventData?.venue?.coordinates || (
              jobData.location?.latitude != null && jobData.location?.longitude != null
                ? { lat: jobData.location.latitude, lng: jobData.location.longitude }
                : undefined
            )
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
        console.log("🆕 INITIALIZATION: No saved data, using current job data with assignments");
        setHasSavedData(false);
        setDataSource('job');
        
        const basicEventData: EventData = {
          eventName: jobData.title || "",
          eventDates,
          venue: {
            name: jobData.location?.name || "",
            address: jobData.location?.formatted_address || "",
            coordinates: jobData.location?.latitude != null && jobData.location?.longitude != null
              ? { lat: jobData.location.latitude, lng: jobData.location.longitude }
              : undefined,
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
          staff: staffFromAssignments.length > 0 ? staffFromAssignments : [{ name: "", surname1: "", surname2: "", position: "", dni: "" }],
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
  }, [selectedJobId, hojaDeRuta, isLoadingHojaDeRuta, loadCurrentJobAssignments, toast, setEventData, setTravelArrangements, setAccommodations, setIsInitialized, setHasSavedData, setDataSource]);

  return {
    autoPopulateBasicJobData,
    loadCurrentJobAssignments
  };
};
