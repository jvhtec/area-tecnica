import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Database } from '@/integrations/supabase/types';
import type {
  Accommodation,
  EventData,
  TravelArrangement,
} from '@/types/hoja-de-ruta';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatPowerRequirementsText } from '@/utils/powerRequirementSelection';
import {
  mergeStaffWithAssignments,
  remapAccommodationStaffReferences,
} from '@/utils/hoja-de-ruta/staffSync';
import { getErrorMessage } from '@/utils/errorMessage';
import { labelForCode } from '@/types/roles';
import { formatInTimeZone } from 'date-fns-tz';
import type { HojaDocument } from '@/features/hoja-de-ruta/model/HojaDocument';

type JobRow = Database['public']['Tables']['jobs']['Row'];
type JobAssignmentRow = Database['public']['Tables']['job_assignments']['Row'];
type LocationRow = Database['public']['Tables']['locations']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

type JobWithHojaRelations = JobRow & {
  location: Pick<LocationRow, 'name' | 'formatted_address' | 'latitude' | 'longitude'> | null;
  job_assignments: Array<JobAssignmentRow & {
    profiles: Pick<ProfileRow, 'first_name' | 'last_name' | 'dni' | 'phone'> | null;
  }>;
};

type HojaContact = {
  id?: string;
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
};

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

const normalizeTourContacts = (value: unknown): HojaContact[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((contact): contact is Record<string, unknown> => Boolean(
      contact && typeof contact === "object" && !Array.isArray(contact),
    ))
    .map((contact) => ({
      // Tour contacts are shared across tour dates; each Hoja owns its row identity.
      id: crypto.randomUUID(),
      name: typeof contact.name === "string" ? contact.name : "",
      role: typeof contact.role === "string" ? contact.role : "",
      phone: typeof contact.phone === "string" ? contact.phone : "",
      email: typeof contact.email === "string" ? contact.email : "",
    }))
    .filter((contact) => contact.name.trim());
};

const mergeContacts = (...groups: Array<HojaContact[] | undefined>) => {
  const merged: Array<Required<HojaContact>> = [];
  const seen = new Set<string>();
  groups.flatMap((group) => group || []).forEach((contact) => {
    const name = contact.name || "";
    const role = contact.role || "";
    const phone = contact.phone || "";
    const email = contact.email || "";
    const key = [name, role, phone, email]
      .map((value) => value.trim().toLowerCase())
      .join("|");
    if (!name.trim() || seen.has(key)) return;
    seen.add(key);
    merged.push({ id: contact.id || crypto.randomUUID(), name, role, phone, email });
  });
  return merged.length
    ? merged
    : [{ id: crypto.randomUUID(), name: "", role: "", phone: "", email: "" }];
};

const formatJobEventDates = (
  jobData: Pick<JobRow, 'start_time' | 'end_time'>,
) => {
  const startDate = jobData.start_time ? new Date(jobData.start_time) : null;
  const endDate = jobData.end_time ? new Date(jobData.end_time) : null;
  const eventStartDate = startDate && !Number.isNaN(startDate.getTime())
    ? formatInTimeZone(startDate, "Europe/Madrid", "yyyy-MM-dd")
    : undefined;
  const eventEndDate = endDate && !Number.isNaN(endDate.getTime())
    ? formatInTimeZone(endDate, "Europe/Madrid", "yyyy-MM-dd")
    : undefined;

  let eventDates = "";
  if (eventStartDate && eventEndDate && startDate && endDate) {
    const startLabel = formatInTimeZone(startDate, "Europe/Madrid", "dd/MM/yyyy");
    const endLabel = formatInTimeZone(endDate, "Europe/Madrid", "dd/MM/yyyy");
    eventDates = eventStartDate === eventEndDate ? startLabel : `${startLabel} - ${endLabel}`;
  }

  return { startDate, eventStartDate, eventEndDate, eventDates };
};

const buildEventDataFromJob = ({
  jobData,
  staffFromAssignments,
  tourContacts,
  powerRequirementsText,
  powerRequirementsSourceUpdatedAt,
}: {
  jobData: JobWithHojaRelations;
  staffFromAssignments: NonNullable<EventData['staff']>;
  tourContacts: HojaContact[];
  powerRequirementsText: string;
  powerRequirementsSourceUpdatedAt?: string;
}): EventData => {
  const { startDate, eventStartDate, eventEndDate, eventDates } = formatJobEventDates(jobData);

  return {
    eventName: jobData.title || "",
    eventDates,
    eventStartDate,
    eventEndDate,
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
    staff: staffFromAssignments.length > 0 ? staffFromAssignments : [{
      id: crypto.randomUUID(),
      name: "",
      surname1: "",
      surname2: "",
      position: "",
      dni: "",
    }],
    schedule: startDate
      ? `Inicio del evento: ${formatInTimeZone(startDate, "Europe/Madrid", "HH:mm")}`
      : "",
    powerRequirements: powerRequirementsText || "",
    powerRequirementsSourceUpdatedAt,
    auxiliaryNeeds: "",
    auxiliaryStaffSetupQty: 0,
    auxiliaryStaffDismantleQty: 0,
    auxiliaryMachinery: [],
    weather: undefined,
    printExcludedSections: [],
  };
};

export const useHojaDocumentInitialization = (
  selectedJobId: string,
  hojaDeRuta: HojaDocument | null | undefined,
  isLoadingHojaDeRuta: boolean,
  isInitialized: boolean,
  setEventData: Dispatch<SetStateAction<EventData>>,
  setTravelArrangements: Dispatch<SetStateAction<TravelArrangement[]>>,
  setAccommodations: Dispatch<SetStateAction<Accommodation[]>>,
  setIsInitialized: Dispatch<SetStateAction<boolean>>,
  setHasSavedData: Dispatch<SetStateAction<boolean>>,
  setHasBasicJobData: Dispatch<SetStateAction<boolean>>,
  setDataSource: Dispatch<SetStateAction<'none' | 'saved' | 'job' | 'mixed'>>
) => {
  const { toast } = useToast();
  // Token of the initialization run currently in flight (see the effect below)
  const initializingRunRef = useRef<{ jobId: string } | null>(null);

  // Fetch current Consumos-derived power requirements and its source revision.
  const fetchPowerRequirements = useCallback(async (
    jobId: string,
  ): Promise<{ text: string; sourceUpdatedAt?: string }> => {
    if (!jobId) return { text: "" };

    try {
      const { data: powerRequirements, error } = await supabase
        .from("power_requirement_tables")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (error || !powerRequirements?.length) {
        if (error) {
          console.warn("No se pudieron cargar los requisitos de potencia:", error);
        }
        return { text: "" };
      }

      const sourceUpdatedAt = powerRequirements
        .map((row) => row.updated_at || row.created_at)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1);

      return {
        text: formatPowerRequirementsText(powerRequirements),
        sourceUpdatedAt,
      };
    } catch (error) {
      console.warn("No se pudieron cargar los requisitos de potencia:", error);
      return { text: "" };
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

      const typedJobData = jobData as JobWithHojaRelations;
      const staffFromAssignments = typedJobData.job_assignments
        .filter((assignment) => assignment.status === "confirmed")
        .map((assignment) => {
          const roleEntries = [
            ["Sonido", assignment.sound_role],
            ["Luces", assignment.lights_role],
            ["Vídeo", assignment.video_role],
            ["Producción", assignment.production_role],
          ].filter(([, code]) => Boolean(code)) as Array<[string, string]>;

          return {
            id: crypto.randomUUID(),
            technician_id: assignment.technician_id,
            name: assignment.profiles?.first_name || "",
            surname1: assignment.profiles?.last_name || "",
            surname2: "",
            position: roleEntries.length
              ? roleEntries.map(([department, code]) => `${department}: ${labelForCode(code)}`).join(" · ")
              : "Técnico",
            department: roleEntries.map(([department]) => department).join(", "),
            dni: assignment.profiles?.dni || "",
            phone: assignment.profiles?.phone || "",
          };
        });

      let tourContacts: HojaContact[] = [];
      if (typedJobData.tour_id) {
        const { data: tourData, error: tourError } = await supabase
          .from('tours')
          .select('tour_contacts')
          .eq('id', typedJobData.tour_id)
          .maybeSingle();
        if (!tourError) {
          tourContacts = normalizeTourContacts(tourData?.tour_contacts);
        }
      }

      console.log("✅ INITIALIZATION: Loaded current assignments:", staffFromAssignments);
      return { jobData: typedJobData, staffFromAssignments, tourContacts };
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
      const [assignmentData, powerRequirements] = await Promise.all([
        loadCurrentJobAssignments(jobId),
        fetchPowerRequirements(jobId)
      ]);
      const powerRequirementsText = powerRequirements.text;

      if (!assignmentData) return;

      const { jobData, staffFromAssignments, tourContacts } = assignmentData;

      const basicEventData = buildEventDataFromJob({
        jobData,
        staffFromAssignments,
        tourContacts,
        powerRequirementsText,
        powerRequirementsSourceUpdatedAt: powerRequirements.sourceUpdatedAt,
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
        title: "Datos básicos cargados",
        description: description
          ? `Se han cargado los datos básicos del trabajo con ${description}.`
          : "Se han cargado los datos básicos del trabajo seleccionado.",
      });
    } catch (error) {
      console.error("❌ INITIALIZATION: Error auto-populating basic job data:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudieron cargar los datos básicos del trabajo."),
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
      const [assignmentData, powerRequirements] = await Promise.all([
        loadCurrentJobAssignments(selectedJobId),
        fetchPowerRequirements(selectedJobId)
      ]);
      const powerRequirementsText = powerRequirements.text;

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
      const { startDate, eventStartDate, eventEndDate, eventDates } = formatJobEventDates(jobData);

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
          eventStartDate: savedEventData?.eventStartDate || eventStartDate,
          eventEndDate: savedEventData?.eventEndDate || eventEndDate,
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
            : [{
                id: crypto.randomUUID(),
                name: "",
                surname1: "",
                surname2: "",
                position: "",
                dni: "",
              }],
          schedule: savedEventData?.schedule || (
            startDate ? `Inicio del evento: ${formatInTimeZone(startDate, "Europe/Madrid", "HH:mm")}` : ""
          ),
          // Structured program schedules
          programSchedule: savedEventData?.programSchedule || undefined,
          programScheduleDays: savedEventData?.programScheduleDays || undefined,
          powerRequirements: resolvePowerRequirementsForHojaInitialization({
            savedPowerRequirements: savedEventData?.powerRequirements,
            generatedPowerRequirements: powerRequirementsText,
          }),
          powerRequirementsSourceUpdatedAt:
            savedEventData?.powerRequirements?.trim()
              ? savedEventData?.powerRequirementsSourceUpdatedAt
              : powerRequirements.sourceUpdatedAt,
          auxiliaryNeeds: savedEventData?.auxiliaryNeeds || "",
          auxiliaryStaffSetupQty: savedEventData?.auxiliaryStaffSetupQty ?? 0,
          auxiliaryStaffDismantleQty: savedEventData?.auxiliaryStaffDismantleQty ?? 0,
          auxiliaryMachinery: savedEventData?.auxiliaryMachinery || [],
          weather: savedEventData?.weather || undefined,
          weatherFetchedAt: savedEventData?.weatherFetchedAt || undefined,
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
          title: "Datos cargados",
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
          powerRequirementsSourceUpdatedAt: powerRequirements.sourceUpdatedAt,
        }));
        setTravelArrangements([]);
        setAccommodations([]);

        const description = [
          staffFromAssignments.length > 0 && `${staffFromAssignments.length} miembros del personal asignado`,
          powerRequirementsText && 'requisitos de potencia'
        ].filter(Boolean).join(' y ');

        toast({
          title: "Datos del trabajo cargados",
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
    loadCurrentJobAssignments,
    fetchPowerRequirements,
  };
};
