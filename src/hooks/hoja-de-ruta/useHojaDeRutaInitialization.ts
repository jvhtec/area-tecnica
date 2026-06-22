import { useCallback, useEffect, useRef } from 'react';
import { EventData } from '@/types/hoja-de-ruta';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatPowerRequirementsText } from '@/utils/powerSummaryData';
import {
  mergeStaffWithAssignments,
  remapAccommodationStaffReferences,
} from '@/utils/hoja-de-ruta/staffSync';

export const resolvePowerRequirementsForHojaInitialization = ({
  savedPowerRequirements,
  generatedPowerRequirements,
}: {
  savedPowerRequirements?: string | null;
  generatedPowerRequirements?: string | null;
}) => {
  const saved = savedPowerRequirements ?? "";
  if (saved.trim().length > 0) return saved;

  return generatedPowerRequirements ?? "";
};

export const useHojaDeRutaInitialization = (
  selectedJobId: string,
  hojaDeRuta: any,
  isLoadingHojaDeRuta: boolean,
  isInitialized: boolean,
  setEventData: React.Dispatch<React.SetStateAction<EventData>>,
  setTravelArrangements: any,
  setAccommodations: any,
  setIsInitialized: React.Dispatch<React.SetStateAction<boolean>>,
  setHasSavedData: React.Dispatch<React.SetStateAction<boolean>>,
  setHasBasicJobData: React.Dispatch<React.SetStateAction<boolean>>,
  setDataSource: React.Dispatch<React.SetStateAction<'none' | 'saved' | 'job' | 'mixed'>>
) => {
  const { toast } = useToast();
  // Token of the initialization run currently in flight (see the effect below)
  const initializingRunRef = useRef<{ jobId: string } | null>(null);

  const normalizeTourContacts = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value
      .filter((contact): contact is Record<string, unknown> => Boolean(contact && typeof contact === "object" && !Array.isArray(contact)))
      .map((contact) => ({
        name: typeof contact.name === "string" ? contact.name : "",
        role: typeof contact.role === "string" ? contact.role : "",
        phone: typeof contact.phone === "string" ? contact.phone : "",
      }))
      .filter((contact) => contact.name.trim());
  };

  const mergeContacts = (...groups: Array<Array<{ name?: string; role?: string; phone?: string }> | undefined>) => {
    const merged: Array<{ name: string; role: string; phone: string }> = [];
    const seen = new Set<string>();
    groups.flatMap((group) => group || []).forEach((contact) => {
      const name = contact.name || "";
      const role = contact.role || "";
      const phone = contact.phone || "";
      const key = [name, role, phone].map((value) => value.trim().toLowerCase()).join("|");
      if (!name.trim() || seen.has(key)) return;
      seen.add(key);
      merged.push({ name, role, phone });
    });
    return merged.length ? merged : [{ name: "", role: "", phone: "" }];
  };

  const formatJobEventDates = (jobData: { start_time?: string | null; end_time?: string | null }) => {
    const startDate = jobData.start_time ? new Date(jobData.start_time) : null;
    const endDate = jobData.end_time ? new Date(jobData.end_time) : null;

    let eventDates = "";
    if (startDate && endDate) {
      eventDates = startDate.toDateString() === endDate.toDateString()
        ? startDate.toLocaleDateString('es-ES')
        : `${startDate.toLocaleDateString('es-ES')} - ${endDate.toLocaleDateString('es-ES')}`;
    }

    return { startDate, endDate, eventDates };
  };

  // Builds the EventData used when there is no saved hoja for the job, shared
  // by the initialization effect and autoPopulateBasicJobData.
  const buildEventDataFromJob = ({
    jobData,
    staffFromAssignments,
    tourContacts,
    powerRequirementsText,
  }: {
    jobData: any;
    staffFromAssignments: NonNullable<EventData['staff']>;
    tourContacts: Array<{ name: string; role: string; phone: string }>;
    powerRequirementsText: string;
  }): EventData => {
    const { startDate, eventDates } = formatJobEventDates(jobData);

    return {
      eventName: jobData.title || "",
      eventDates,
      venue: {
        name: jobData.location?.name || "",
        address: jobData.location?.formatted_address || "",
        coordinates: jobData.location?.latitude != null && jobData.location?.longitude != null
          ? { lat: jobData.location.latitude, lng: jobData.location.longitude }
          : undefined,
      },
      contacts: mergeContacts(tourContacts),
      logistics: {
        transport: [],
        loadingDetails: "",
        unloadingDetails: "",
        equipmentLogistics: "",
      },
      staff: staffFromAssignments.length > 0 ? staffFromAssignments : [{ name: "", surname1: "", surname2: "", position: "", dni: "" }],
      schedule: startDate ? `Load in: ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : "",
      powerRequirements: powerRequirementsText || "",
      auxiliaryNeeds: "",
      auxiliaryStaffSetupQty: 0,
      auxiliaryStaffDismantleQty: 0,
      auxiliaryMachinery: [],
      weather: undefined,
      printExcludedSections: [],
    };
  };

  // Fetch power requirements for a job
  const fetchPowerRequirements = useCallback(async (jobId: string): Promise<string> => {
    if (!jobId) return "";

    console.log("⚡ INITIALIZATION: Fetching power requirements for:", jobId);

    try {
      const { data: powerRequirements, error } = await supabase
        .from("power_requirement_tables")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("❌ INITIALIZATION: Error fetching power requirements:", error);
        return "";
      }

      if (!powerRequirements || powerRequirements.length === 0) {
        console.log("ℹ️ INITIALIZATION: No power requirements found for this job");
        return "";
      }

      const powerText = formatPowerRequirementsText(powerRequirements);

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

      let tourContacts: Array<{ name: string; role: string; phone: string }> = [];
      if ((jobData as any).tour_id) {
        const { data: tourData, error: tourError } = await supabase
          .from('tours')
          .select('tour_contacts')
          .eq('id', (jobData as any).tour_id)
          .maybeSingle();
        if (!tourError) {
          tourContacts = normalizeTourContacts((tourData as any)?.tour_contacts);
        }
      }

      console.log("✅ INITIALIZATION: Loaded current assignments:", staffFromAssignments);
      return { jobData, staffFromAssignments, tourContacts };
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

      const { jobData, staffFromAssignments, tourContacts } = assignmentData;

      const basicEventData = buildEventDataFromJob({
        jobData,
        staffFromAssignments,
        tourContacts,
        powerRequirementsText,
      });

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

  // Initialize form with current job assignments, then merge with saved data if exists.
  // Runs once per job selection: hojaDeRuta refetches (window focus, post-save
  // invalidation) must not re-run this, or they would wipe unsaved edits.
  useEffect(() => {
    if (!selectedJobId || isLoadingHojaDeRuta || isInitialized) return;
    // The async initialization below sets isInitialized only when it finishes;
    // block concurrent runs for the same job (e.g. a refetch landing
    // mid-initialization).
    if (initializingRunRef.current?.jobId === selectedJobId) return;
    const runToken = { jobId: selectedJobId };
    initializingRunRef.current = runToken;
    // A newer run (job change) replaces the token; stale completions must not
    // apply their results over the newer job's state.
    const isCurrentRun = () => initializingRunRef.current === runToken;

    console.log("🔄 INITIALIZATION: Initialization effect triggered for job:", selectedJobId);

    const initializeFormData = async () => {
      // Always load current job assignments and power requirements first
      const [assignmentData, powerRequirementsText] = await Promise.all([
        loadCurrentJobAssignments(selectedJobId),
        fetchPowerRequirements(selectedJobId)
      ]);

      // Everything below is synchronous, so this single check after the only
      // await guards every state mutation in this run.
      if (!isCurrentRun()) {
        console.log("⏭️ INITIALIZATION: Discarding stale initialization for job:", selectedJobId);
        return;
      }

      if (!assignmentData) {
        console.log("❌ INITIALIZATION: No assignment data available");
        setIsInitialized(true);
        return;
      }

      const { jobData, staffFromAssignments, tourContacts } = assignmentData;
      const { startDate, eventDates } = formatJobEventDates(jobData);

      // If we have saved data, merge current assignments with saved data
      if (hojaDeRuta) {
        console.log("✅ INITIALIZATION: Initializing with SAVED data + current assignments");
        setHasSavedData(true);
        setDataSource('saved');
        
        const savedEventData = hojaDeRuta.eventData;
        // Merge saved staff with current assignments: keeps saved DNIs and
        // manual entries, appends new assignments, and prunes entries whose
        // assignment was removed so they disappear from the hoja.
        const savedStaff = savedEventData?.staff || [];
        const { staff: mergedStaff, savedIndexMap } = mergeStaffWithAssignments(
          savedStaff,
          staffFromAssignments || [],
        );
        
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
            ? mergeContacts(savedEventData.contacts, tourContacts)
            : mergeContacts(tourContacts),
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
          powerRequirements: resolvePowerRequirementsForHojaInitialization({
            savedPowerRequirements: savedEventData?.powerRequirements,
            generatedPowerRequirements: powerRequirementsText,
          }),
          auxiliaryNeeds: savedEventData?.auxiliaryNeeds || "",
          auxiliaryStaffSetupQty: savedEventData?.auxiliaryStaffSetupQty ?? 0,
          auxiliaryStaffDismantleQty: savedEventData?.auxiliaryStaffDismantleQty ?? 0,
          auxiliaryMachinery: savedEventData?.auxiliaryMachinery || [],
          weather: savedEventData?.weather || undefined,
          // Restaurants
          restaurants: savedEventData?.restaurants || undefined,
          selectedRestaurants: savedEventData?.selectedRestaurants || undefined,
          printExcludedSections: savedEventData?.printExcludedSections || [],
        });

        // Set travel arrangements using transformed data
        setTravelArrangements(hojaDeRuta.travelArrangements || []);

        // Set accommodations, remapping room staff references against the
        // merged staff list (room assignments stored array indexes, which go
        // stale when staff entries are pruned or reordered)
        setAccommodations(
          remapAccommodationStaffReferences(
            hojaDeRuta.accommodations || [],
            savedStaff,
            savedIndexMap,
            mergedStaff,
          ),
        );
        
        toast({
          title: "✅ Datos cargados",
          description: `Se han cargado los datos guardados con ${staffFromAssignments.length} miembros del personal actual.`,
        });
      } else {
        // No saved data - use current job data with assignments
        console.log("🆕 INITIALIZATION: No saved data, using current job data with assignments");
        setHasSavedData(false);
        setDataSource('job');

        setEventData(buildEventDataFromJob({
          jobData,
          staffFromAssignments,
          tourContacts,
          powerRequirementsText,
        }));
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

    initializeFormData().finally(() => {
      if (isCurrentRun()) {
        initializingRunRef.current = null;
      }
    });
  }, [selectedJobId, hojaDeRuta, isLoadingHojaDeRuta, isInitialized, loadCurrentJobAssignments, fetchPowerRequirements, toast, setEventData, setTravelArrangements, setAccommodations, setIsInitialized, setHasSavedData, setDataSource]);

  return {
    autoPopulateBasicJobData,
    loadCurrentJobAssignments
  };
};
