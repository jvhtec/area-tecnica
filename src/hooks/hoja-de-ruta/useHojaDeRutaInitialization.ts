import { useCallback, useEffect } from 'react';
import { EventData } from '@/types/hoja-de-ruta';
import { supabase } from '@/integrations/supabase/client';
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

  // Fetch power requirements for a job
  const fetchPowerRequirements = useCallback(async (jobId: string): Promise<string> => {
    if (!jobId) return "";

    console.log("⚡ INITIALIZATION: Fetching power requirements for:", jobId);

    try {
      const { data: powerRequirements, error } = await supabase
        .from("power_requirement_tables")
        .select("*")
        .eq("job_id", jobId);

      if (error) {
        console.error("❌ INITIALIZATION: Error fetching power requirements:", error);
        return "";
      }

      if (!powerRequirements || powerRequirements.length === 0) {
        console.log("ℹ️ INITIALIZATION: No power requirements found for this job");
        return "";
      }

      // Deduplicate requirements based on table_name and department
      const uniqueRequirements = powerRequirements.reduce((acc: any[], current: any) => {
        const x = acc.find(item => item.table_name === current.table_name && item.department === current.department);
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
      }, []);

      const powerText = uniqueRequirements
        .map((req: any) => {
          const current = typeof req.current_per_phase === 'number' 
            ? req.current_per_phase.toFixed(2) 
            : req.current_per_phase;
            
          const pduType = req.custom_pdu_type || req.pdu_type;
          
          let text = `${req.department.toUpperCase()} - ${req.table_name}:\n` +
            `Potencia Total: ${req.total_watts}W\n` +
            `Corriente por Fase: ${current}A\n` +
            `PDU Recomendado: ${pduType}\n`;

          if (req.includes_hoist) {
            text += `Requiere potencia adicional de motores (CEE32A 3P+N+G)\n`;
          }

          return text;
        })
        .join("\n");

      console.log("✅ INITIALIZATION: Power requirements fetched successfully");
      return powerText;
    } catch (error) {
      console.error("❌ INITIALIZATION: Error fetching power requirements:", error);
      return "";
    }
  }, []);

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
            profiles:technician_id(first_name, last_name, dni, phone)
          )
        `)
        .eq('id', jobId)
        .single();

      if (jobError || !jobData) {
        console.error("❌ INITIALIZATION: Error fetching job assignments:", jobError);
        return null;
      }

      const staffFromAssignments = jobData.job_assignments?.map((assignment: any) => ({
        technician_id: assignment.technician_id,
        name: assignment.profiles?.first_name || "",
        surname1: assignment.profiles?.last_name || "",
        surname2: "",
        position: assignment.sound_role || assignment.lights_role || assignment.video_role || "Técnico",
        dni: assignment.profiles?.dni || "",
        phone: assignment.profiles?.phone || "",
        role: "house_tech",
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
      const [assignmentData, powerRequirementsText] = await Promise.all([
        loadCurrentJobAssignments(jobId),
        fetchPowerRequirements(jobId)
      ]);

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
        // Use fetched power requirements from database
        powerRequirements: powerRequirementsText || "",
        auxiliaryNeeds: "",
        weather: undefined,
      };

      console.log("✅ INITIALIZATION: Setting basic job data with assignments:", {
        eventName: basicEventData.eventName,
        staffCount: basicEventData.staff.length,
        staffData: basicEventData.staff,
        hasPowerRequirements: !!powerRequirementsText
      });

      setEventData(basicEventData);
      setHasBasicJobData(true);
      setDataSource('job');

      const description = [
        staffFromAssignments.length > 0 && `${staffFromAssignments.length} miembros del personal asignado`,
        powerRequirementsText && 'requisitos de potencia'
      ].filter(Boolean).join(' y ');

      toast({
        title: "📋 Datos básicos cargados",
        description: description
          ? `Se han cargado los datos básicos del trabajo con ${description}.`
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
  }, [toast, loadCurrentJobAssignments, fetchPowerRequirements, setEventData, setHasBasicJobData, setDataSource]);

  // Initialize form with current job assignments, then merge with saved data if exists
  useEffect(() => {
    if (!selectedJobId || isLoadingHojaDeRuta) return;
    
    console.log("🔄 INITIALIZATION: Initialization effect triggered for job:", selectedJobId);
    
    const initializeFormData = async () => {
      // Always load current job assignments and power requirements first
      const [assignmentData, powerRequirementsText] = await Promise.all([
        loadCurrentJobAssignments(selectedJobId),
        fetchPowerRequirements(selectedJobId)
      ]);

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
        // Merge saved staff with current assignments, preserving saved DNI and manual entries
        type StaffEntry = NonNullable<EventData['staff']>[number];
        const mergeStaff = (
          saved: StaffEntry[] = [],
          assigned: StaffEntry[] = [],
        ) => {
          const norm = (s?: string) => (s || '').trim().toLowerCase();
          const nameKey = (p: StaffEntry) => `${norm(p?.name)}|${norm(p?.surname1)}`;

          const mergeTwo = (a: StaffEntry, s: StaffEntry): StaffEntry => ({
            ...a,
            ...s,
            // Prefer saved DNI/position if present; otherwise take the assignment-derived values
            dni: s.dni || a.dni || '',
            position: s.position || a.position || '',
            technician_id: s.technician_id || a.technician_id,
            phone: s.phone || a.phone || '',
            role: s.role || a.role,
          });

          // Start from saved order.
          const result: StaffEntry[] = (saved || []).map((p) => ({ ...p }));
          const usedAssigned = new Set<number>();

          // PASS 1: match by technician_id (reliable)
          const savedIndexByTechId = new Map<string, number>();
          result.forEach((p, idx) => {
            if (p?.technician_id) savedIndexByTechId.set(p.technician_id, idx);
          });

          assigned.forEach((a, aIdx) => {
            const tid = a?.technician_id;
            if (!tid) return;
            const sIdx = savedIndexByTechId.get(tid);
            if (sIdx == null) return;
            result[sIdx] = mergeTwo(a, result[sIdx]);
            usedAssigned.add(aIdx);
          });

          // PASS 2: match remaining legacy saved entries (no technician_id) by name|surname1
          const legacySavedByName = new Map<string, number[]>();
          result.forEach((p, idx) => {
            if (p?.technician_id) return;
            const k = nameKey(p);
            if (!k || k === '|') return;
            const arr = legacySavedByName.get(k) || [];
            arr.push(idx);
            legacySavedByName.set(k, arr);
          });

          assigned.forEach((a, aIdx) => {
            if (usedAssigned.has(aIdx)) return;
            const k = nameKey(a);
            const arr = legacySavedByName.get(k);
            if (!arr || arr.length === 0) return;
            const sIdx = arr.shift()!;
            result[sIdx] = mergeTwo(a, result[sIdx]);
            usedAssigned.add(aIdx);
            if (arr.length === 0) legacySavedByName.delete(k);
          });

          // Append any remaining assigned staff not present in saved data.
          assigned.forEach((a, aIdx) => {
            if (usedAssigned.has(aIdx)) return;
            result.push({ ...a });
          });

          return result;
        };

        const mergedStaff = mergeStaff(savedEventData?.staff || [], staffFromAssignments || []);
        
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
          // Merge saved staff with current assignments to preserve DNIs and manual entries
          staff: (mergedStaff.length > 0)
            ? mergedStaff
            : [{ name: "", surname1: "", surname2: "", position: "", dni: "" }],
          schedule: savedEventData?.schedule || (startDate ? `Load in: ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ""),
          // Structured program schedules
          programSchedule: savedEventData?.programSchedule || undefined,
          programScheduleDays: savedEventData?.programScheduleDays || undefined,
          // Use fresh power requirements from database, fallback to saved if none found
          powerRequirements: powerRequirementsText || savedEventData?.powerRequirements || "",
          auxiliaryNeeds: savedEventData?.auxiliaryNeeds || "",
          weather: savedEventData?.weather || undefined,
          // Restaurants
          restaurants: savedEventData?.restaurants || undefined,
          selectedRestaurants: savedEventData?.selectedRestaurants || undefined,
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
          // Use fetched power requirements from database
          powerRequirements: powerRequirementsText || "",
          auxiliaryNeeds: "",
          weather: undefined,
        };

        setEventData(basicEventData);
        setTravelArrangements([]);
        setAccommodations([]);

        const description = [
          staffFromAssignments.length > 0 && `${staffFromAssignments.length} miembros del personal asignado`,
          powerRequirementsText && 'requisitos de potencia'
        ].filter(Boolean).join(' y ');

        toast({
          title: "📋 Datos del trabajo cargados",
          description: description
            ? `Se han cargado ${description}.`
            : "Se han cargado los datos básicos del trabajo.",
        });
      }
      
      setIsInitialized(true);
    };

    initializeFormData();
  }, [selectedJobId, hojaDeRuta, isLoadingHojaDeRuta, loadCurrentJobAssignments, fetchPowerRequirements, toast, setEventData, setTravelArrangements, setAccommodations, setIsInitialized, setHasSavedData, setDataSource]);

  return {
    autoPopulateBasicJobData,
    loadCurrentJobAssignments
  };
};
