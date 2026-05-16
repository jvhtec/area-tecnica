import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

import type { TourDocument } from "@/hooks/useTourDocuments";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useWeatherData } from "@/hooks/useWeatherData";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { JobDocument, JobWithLocationAndDocs, StaffAssignment } from "@/types/job";
import type { WeatherData } from "@/types/hoja-de-ruta";
import { PlacesRestaurantService } from "@/utils/hoja-de-ruta/services/places-restaurant-service";
import { isTechnicianRole } from "@/utils/permissions";
import { labelForCode } from "@/utils/roles";
import { queryKeys } from "@/lib/react-query";

import {
  downloadJobDocument,
  downloadRider,
  downloadTourDocument,
  openJobDocument,
  openRider,
  openTourDocument,
} from "./documentActions";
import { isUuidLike } from "./formatters";
import type {
  DetailsModalProps,
  FestivalShiftAssignment,
  FestivalShiftInfo,
  FestivalStageName,
  HojaDeRutaAccommodation,
  HojaDeRutaMeta,
  HojaDeRutaTransport,
  HojaDeRutaTravelArrangement,
  JobArtist,
  RiderFile,
  RoomOccupantProfile,
  TechShiftAssignmentDetail,
  TabId,
} from "./types";

type JobDetailsRow = JobWithLocationAndDocs & {
  tour_id?: string | null;
};

type JobDateType = {
  date: string;
  type: string;
};

const supabaseForDocuments = dataLayerClient as SupabaseClient;

export const useDetailsModalData = ({ theme, isDark, job, onClose }: DetailsModalProps) => {
  const { user, userRole } = useOptimizedAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("Info");
  const [documentLoading, setDocumentLoading] = useState<Set<string>>(new Set());
  const [isUploadingTourDocument, setIsUploadingTourDocument] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData[] | undefined>(undefined);
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);

  const { data: jobDetails, isLoading: jobDetailsLoading } = useQuery({
    queryKey: queryKeys.scope("job-details-modal", job?.id),
    queryFn: async () => {
      if (!job?.id) return null;
      const { data, error } = await dataLayerClient.from("jobs")
        .select(`
          *,
          locations(id, name, formatted_address, latitude, longitude)
        `)
        .eq("id", job.id)
        .single();
      if (error) throw error;
      return data as JobDetailsRow;
    },
    enabled: !!job?.id,
  });

  const tourId: string | undefined =
    jobDetails?.tour_id ??
    (job as { tour_id?: string })?.tour_id;

  const { data: staffAssignments = [], isLoading: staffLoading } = useQuery({
    queryKey: queryKeys.scope("job-staff", job?.id),
    queryFn: async () => {
      if (!job?.id) return [];
      const { data, error } = await dataLayerClient.from("job_assignments")
        .select(`
          sound_role,
          lights_role,
          video_role,
          technician:profiles(id, first_name, last_name, email, profile_picture_url)
        `)
        .eq("job_id", job.id)
        .eq("status", "confirmed");
      if (error) throw error;
      return ((data || []) as unknown as StaffAssignment[]).map((assignment) => ({
        ...assignment,
        technician: Array.isArray(assignment.technician)
          ? assignment.technician[0] ?? undefined
          : assignment.technician ?? undefined,
      }));
    },
    enabled: !!job?.id,
  });

  const { data: assignedDates = [], isLoading: assignedDatesLoading } = useQuery({
    queryKey: queryKeys.scope("tech-assigned-dates", job?.id, user?.id),
    queryFn: async () => {
      if (!job?.id || !user?.id) return [];
      const { data, error } = await dataLayerClient.from("timesheets")
        .select("date")
        .eq("job_id", job.id)
        .eq("technician_id", user.id)
        .eq("is_active", true)
        .order("date", { ascending: true });
      if (error) throw error;
      return data?.map((timesheet) => timesheet.date) || [];
    },
    enabled: !!job?.id && !!user?.id,
  });

  const { data: festivalStages = [] } = useQuery({
    queryKey: queryKeys.scope("technician-job-festival-stages", job?.id),
    queryFn: async () => {
      if (!job?.id) return [];
      const { data, error } = await dataLayerClient.from("festival_stages")
        .select("number, name")
        .eq("job_id", job.id);
      if (error) throw error;
      return (data || []) as FestivalStageName[];
    },
    enabled: !!job?.id,
  });

  const { data: techShiftAssignments = [], isLoading: techShiftAssignmentsLoading } = useQuery({
    queryKey: queryKeys.scope("technician-job-shift-assignments", job?.id, user?.id),
    queryFn: async () => {
      if (!job?.id || !user?.id) return [];

      const { data: shifts, error: shiftsError } = await dataLayerClient.from("festival_shifts")
        .select("id, job_id, date, name, start_time, end_time, stage, department")
        .eq("job_id", job.id);

      if (shiftsError) throw shiftsError;

      const shiftIds = (shifts || []).map((shift) => shift.id);
      if (shiftIds.length === 0) return [];

      const { data: assignments, error: assignmentsError } = await dataLayerClient.from("festival_shift_assignments")
        .select("id, role, shift_id")
        .eq("technician_id", user.id)
        .in("shift_id", shiftIds);

      if (assignmentsError) throw assignmentsError;

      const shiftById = new Map((shifts || []).map((shift) => [shift.id, shift as FestivalShiftInfo]));

      return (assignments as FestivalShiftAssignment[])
        .map((assignment) => {
          if (!assignment.shift_id) return null;
          const shift = shiftById.get(assignment.shift_id);
          if (!shift) return null;
          return {
            assignment_id: assignment.id,
            role: assignment.role,
            shift,
          } as TechShiftAssignmentDetail;
        })
        .filter((item): item is TechShiftAssignmentDetail => Boolean(item));
    },
    enabled: !!job?.id && !!user?.id,
  });

  const { data: jobDateTypes = [], isLoading: jobDateTypesLoading } = useQuery({
    queryKey: queryKeys.scope("job-date-types", job?.id),
    queryFn: async () => {
      if (!job?.id) return [];
      const { data, error } = await dataLayerClient.from("job_date_types")
        .select("date, type")
        .eq("job_id", job.id);
      if (error) throw error;
      return (data || []) as JobDateType[];
    },
    enabled: !!job?.id,
  });

  const { data: tourDocuments = [], isLoading: tourDocumentsLoading } = useQuery({
    queryKey: queryKeys.scope("tour-documents-for-job", tourId),
    queryFn: async () => {
      if (!tourId) return [];
      const { data, error } = await dataLayerClient.from("tour_documents")
        .select("id, file_name, file_path, uploaded_at, file_type")
        .eq("tour_id", tourId)
        .eq("visible_to_tech", true)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TourDocument[];
    },
    enabled: !!tourId,
  });

  const { data: jobArtists = [], isLoading: isArtistsLoading, error: jobArtistsError } = useQuery({
    queryKey: queryKeys.scope("technician-job-artists", job?.id),
    queryFn: async () => {
      if (!job?.id) return [];
      const { data, error } = await dataLayerClient.from("festival_artists")
        .select("id, name, stage")
        .eq("job_id", job.id);
      if (error) throw error;
      return (data || []) as JobArtist[];
    },
    enabled: !!job?.id,
  });

  const artistIdList = useMemo(() => jobArtists.map((artist) => artist.id), [jobArtists]);
  const artistNameMap = useMemo(() => new Map(jobArtists.map((artist) => [artist.id, artist.name])), [jobArtists]);
  const artistStageMap = useMemo(() => new Map(jobArtists.map((artist) => [artist.id, artist.stage])), [jobArtists]);

  const { data: riderFiles = [], isLoading: isRidersLoading, error: riderFilesError } = useQuery({
    queryKey: queryKeys.scope("technician-job-rider-files", job?.id, artistIdList),
    queryFn: async () => {
      if (artistIdList.length === 0) return [];
      const { data, error } = await dataLayerClient.from("festival_artist_files")
        .select("id, file_name, file_path, uploaded_at, artist_id")
        .in("artist_id", artistIdList)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RiderFile[];
    },
    enabled: artistIdList.length > 0,
  });

  const { data: hojaDeRutaMeta, isLoading: hojaDeRutaLoading } = useQuery({
    queryKey: queryKeys.scope("technician-hoja-de-ruta-meta", job?.id),
    queryFn: async () => {
      if (!job?.id) return null;
      const { data, error } = await dataLayerClient.from("hoja_de_ruta")
        .select("id")
        .eq("job_id", job.id)
        .maybeSingle();

      if (error) {
        console.warn("No se pudo cargar hoja de ruta para el técnico:", error.message);
        return null;
      }

      return data as HojaDeRutaMeta | null;
    },
    enabled: !!job?.id,
  });

  const hojaDeRutaId = hojaDeRutaMeta?.id || null;

  const { data: hojaAccommodations = [], isLoading: hojaAccommodationsLoading } = useQuery({
    queryKey: queryKeys.scope("technician-hoja-accommodations", hojaDeRutaId),
    queryFn: async () => {
      if (!hojaDeRutaId) return [];
      const { data, error } = await dataLayerClient.from("hoja_de_ruta_accommodations")
        .select(`
          id,
          hotel_name,
          address,
          check_in,
          check_out,
          hoja_de_ruta_room_assignments(
            id,
            room_type,
            room_number,
            staff_member1_id,
            staff_member2_id
          )
        `)
        .eq("hoja_de_ruta_id", hojaDeRutaId)
        .order("check_in", { ascending: true });

      if (error) {
        console.warn("No se pudo cargar alojamientos de hoja de ruta:", error.message);
        return [];
      }

      return (data || []) as HojaDeRutaAccommodation[];
    },
    enabled: !!hojaDeRutaId,
  });

  const { data: hojaTravelArrangements = [], isLoading: hojaTravelLoading } = useQuery({
    queryKey: queryKeys.scope("technician-hoja-travel-arrangements", hojaDeRutaId),
    queryFn: async () => {
      if (!hojaDeRutaId) return [];
      const { data, error } = await dataLayerClient.from("hoja_de_ruta_travel_arrangements")
        .select(`
          id,
          transportation_type,
          pickup_address,
          pickup_time,
          departure_time,
          arrival_time,
          flight_train_number,
          driver_name,
          driver_phone,
          plate_number,
          notes
        `)
        .eq("hoja_de_ruta_id", hojaDeRutaId)
        .order("pickup_time", { ascending: true });

      if (error) {
        console.warn("No se pudo cargar traslados de hoja de ruta:", error.message);
        return [];
      }

      return (data || []) as HojaDeRutaTravelArrangement[];
    },
    enabled: !!hojaDeRutaId,
  });

  const { data: hojaTransportEntries = [], isLoading: hojaTransportLoading } = useQuery({
    queryKey: queryKeys.scope("technician-hoja-logistics-transport", hojaDeRutaId),
    queryFn: async () => {
      if (!hojaDeRutaId) return [];
      const { data, error } = await dataLayerClient.from("hoja_de_ruta_transport")
        .select(`
          id,
          transport_type,
          driver_name,
          driver_phone,
          license_plate,
          company,
          date_time,
          has_return,
          return_date_time,
          logistics_categories
        `)
        .eq("hoja_de_ruta_id", hojaDeRutaId)
        .or("is_hoja_relevant.eq.true,is_hoja_relevant.is.null")
        .order("date_time", { ascending: true });

      if (error) {
        console.warn("No se pudo cargar transporte logístico de hoja de ruta:", error.message);
        return [];
      }

      return (data || []) as HojaDeRutaTransport[];
    },
    enabled: !!hojaDeRutaId,
  });

  const { data: restaurants = [], isLoading: isRestaurantsLoading } = useQuery({
    queryKey: queryKeys.scope("job-restaurants-modal", job?.id, jobDetails?.locations?.formatted_address),
    queryFn: async () => {
      const locationData = jobDetails?.locations;
      const address = locationData?.formatted_address || locationData?.name;

      if (!address && !locationData?.latitude) {
        return [];
      }

      const coordinates = locationData?.latitude && locationData?.longitude
        ? { lat: Number(locationData.latitude), lng: Number(locationData.longitude) }
        : undefined;

      return await PlacesRestaurantService.searchRestaurantsNearVenue(
        address || `${coordinates?.lat},${coordinates?.lng}`,
        2000,
        10,
        coordinates,
      );
    },
    enabled: !!jobDetails?.locations && (!!jobDetails?.locations?.formatted_address || !!jobDetails?.locations?.name || (!!jobDetails?.locations?.latitude && !!jobDetails?.locations?.longitude)),
  });

  const eventDatesString = (jobDetails?.start_time || job?.start_time) && (jobDetails?.end_time || job?.end_time)
    ? new Date(jobDetails?.start_time || job?.start_time).toLocaleDateString("en-GB").split("/").join("/") +
    (new Date(jobDetails?.start_time || job?.start_time).toDateString() !== new Date(jobDetails?.end_time || job?.end_time).toDateString()
      ? " - " + new Date(jobDetails?.end_time || job?.end_time).toLocaleDateString("en-GB").split("/").join("/")
      : "")
    : "";

  const weatherVenue = {
    address: jobDetails?.locations?.formatted_address || jobDetails?.locations?.name,
    coordinates: jobDetails?.locations?.latitude && jobDetails?.locations?.longitude
      ? {
        lat: typeof jobDetails.locations.latitude === "number"
          ? jobDetails.locations.latitude
          : parseFloat(jobDetails.locations.latitude),
        lng: typeof jobDetails.locations.longitude === "number"
          ? jobDetails.locations.longitude
          : parseFloat(jobDetails.locations.longitude),
      }
      : undefined,
  };

  const { isLoading: isWeatherLoading, error: weatherError, fetchWeather } = useWeatherData({
    venue: weatherVenue,
    eventDates: eventDatesString,
    onWeatherUpdate: setWeatherData,
  });

  useEffect(() => {
    const loadStaticMap = async () => {
      try {
        const loc = jobDetails?.locations;
        if (!loc) {
          setMapPreviewUrl(null);
          return;
        }
        const lat = typeof loc.latitude === "number" ? loc.latitude : (typeof loc.latitude === "string" ? parseFloat(loc.latitude) : undefined);
        const lng = typeof loc.longitude === "number" ? loc.longitude : (typeof loc.longitude === "string" ? parseFloat(loc.longitude) : undefined);
        const address = loc.formatted_address || loc.name || "";

        setIsMapLoading(true);

        const { data, error } = await dataLayerClient.functions.invoke("get-google-maps-key");
        if (error || !data?.apiKey) {
          setMapPreviewUrl(null);
          setIsMapLoading(false);
          return;
        }
        const apiKey = data.apiKey as string;
        const zoom = 15;
        const width = 600;
        const height = 300;
        const scale = 2;
        const center = Number.isFinite(lat) && Number.isFinite(lng)
          ? `${lat},${lng}`
          : encodeURIComponent(address);
        const markers = Number.isFinite(lat) && Number.isFinite(lng)
          ? `&markers=color:red|label:A|${lat},${lng}`
          : (address ? `&markers=color:red|label:A|${encodeURIComponent(address)}` : "");
        const url = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${width}x${height}&scale=${scale}${markers}&key=${encodeURIComponent(apiKey)}`;

        setMapPreviewUrl(url);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("Failed to load static map preview:", message);
        setMapPreviewUrl(null);
      } finally {
        setIsMapLoading(false);
      }
    };
    if (jobDetails?.locations) {
      loadStaticMap();
    }
  }, [jobDetails?.locations]);

  const runDocumentAction = useCallback(async (key: string, action: () => Promise<void>, errorMessage: string) => {
    setDocumentLoading((prev) => new Set(prev).add(key));
    try {
      await action();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`${errorMessage}: ${message}`);
    } finally {
      setDocumentLoading((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const handleViewDocument = useCallback((doc: JobDocument) => {
    return runDocumentAction(doc.id, () => openJobDocument(supabaseForDocuments, doc), "No se pudo abrir el documento");
  }, [runDocumentAction]);

  const handleDownload = useCallback((doc: JobDocument) => {
    return runDocumentAction(doc.id, () => downloadJobDocument(supabaseForDocuments, doc), "No se pudo descargar el documento");
  }, [runDocumentAction]);

  const handleViewTourDocument = useCallback((doc: TourDocument) => {
    const key = `tour:${doc.id}`;
    return runDocumentAction(key, () => openTourDocument(supabaseForDocuments, doc), "No se pudo abrir el documento de gira");
  }, [runDocumentAction]);

  const handleDownloadTourDocument = useCallback((doc: TourDocument) => {
    const key = `tour:${doc.id}`;
    return runDocumentAction(key, () => downloadTourDocument(supabaseForDocuments, doc), "No se pudo descargar el documento de gira");
  }, [runDocumentAction]);

  const handleViewRider = useCallback((file: RiderFile) => {
    const key = `rider:${file.id}`;
    return runDocumentAction(key, () => openRider(supabaseForDocuments, file), "No se pudo abrir el rider");
  }, [runDocumentAction]);

  const handleDownloadRider = useCallback((file: RiderFile) => {
    const key = `rider:${file.id}`;
    return runDocumentAction(key, () => downloadRider(supabaseForDocuments, file), "No se pudo descargar el rider");
  }, [runDocumentAction]);

  const handleOpenMaps = useCallback(() => {
    const address = jobDetails?.locations?.formatted_address || jobDetails?.locations?.name || job?.location?.name || "";
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  }, [job?.location?.name, jobDetails?.locations?.formatted_address, jobDetails?.locations?.name]);

  const handleOpenAddressInMaps = useCallback((address: string) => {
    if (!address) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  }, []);

  const locationData = jobDetails?.locations || job?.location;
  const jobStartDate = (jobDetails?.start_time || job?.start_time)
    ? format(new Date(jobDetails?.start_time || job?.start_time), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })
    : "Fecha no disponible";
  const jobEndDate = (jobDetails?.end_time || job?.end_time)
    ? format(new Date(jobDetails?.end_time || job?.end_time), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })
    : "Fecha no disponible";

  const getDepartmentFromAssignment = useCallback((assignment: StaffAssignment): string => {
    if (assignment.sound_role) return "sound";
    if (assignment.lights_role) return "lights";
    if (assignment.video_role) return "video";
    return "unknown";
  }, []);

  const getRoleFromAssignment = useCallback((assignment: StaffAssignment): string => {
    const role = assignment.sound_role || assignment.lights_role || assignment.video_role;
    return role ? (labelForCode(role) || role) : "Técnico";
  }, []);

  const dateTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    jobDateTypes.forEach((dateType) => map.set(dateType.date, dateType.type));
    return map;
  }, [jobDateTypes]);

  const festivalStageNameMap = useMemo(() => {
    const map = new Map<number, string>();
    festivalStages.forEach((stage) => {
      map.set(stage.number, stage.name);
    });
    return map;
  }, [festivalStages]);

  const techShiftAssignmentsByDate = useMemo(() => {
    const map = new Map<string, TechShiftAssignmentDetail[]>();
    techShiftAssignments.forEach((assignment) => {
      const date = assignment.shift.date;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(assignment);
    });

    map.forEach((list) => {
      list.sort((a, b) => a.shift.start_time.localeCompare(b.shift.start_time));
    });

    return map;
  }, [techShiftAssignments]);

  const allAssignedDates = useMemo(() => {
    const dates = new Set<string>(assignedDates);
    techShiftAssignmentsByDate.forEach((_, date) => dates.add(date));
    return Array.from(dates).sort((a, b) => a.localeCompare(b));
  }, [assignedDates, techShiftAssignmentsByDate]);

  const assignedTechNameById = useMemo(() => {
    const map = new Map<string, string>();
    staffAssignments.forEach((assignment, index) => {
      const tech = assignment.technician;
      if (!tech?.id) return;
      const fullName = [tech.first_name, tech.last_name]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join(" ");
      map.set(tech.id, fullName || tech.email || `Técnico ${index + 1}`);
    });
    return map;
  }, [staffAssignments]);

  const assignedTechIdByIndex = useMemo(() => {
    const map = new Map<string, string>();
    staffAssignments.forEach((assignment, index) => {
      const techId = assignment.technician?.id;
      if (!techId) return;
      map.set(String(index), techId);
    });
    return map;
  }, [staffAssignments]);

  const roomStaffIds = useMemo(() => {
    const ids = new Set<string>();
    hojaAccommodations.forEach((accommodation) => {
      (accommodation.hoja_de_ruta_room_assignments || []).forEach((room) => {
        if (room.staff_member1_id) ids.add(room.staff_member1_id);
        if (room.staff_member2_id) ids.add(room.staff_member2_id);
      });
    });
    return Array.from(ids).sort((a, b) => a.localeCompare(b));
  }, [hojaAccommodations]);

  const roomStaffProfileIds = useMemo(
    () => roomStaffIds.filter((id) => isUuidLike(id)),
    [roomStaffIds],
  );

  const { data: roomOccupantProfiles = [], isLoading: roomOccupantsLoading } = useQuery({
    queryKey: queryKeys.scope("technician-hoja-room-occupants", roomStaffProfileIds),
    queryFn: async () => {
      if (roomStaffProfileIds.length === 0) return [];
      const { data, error } = await dataLayerClient.from("profiles")
        .select("id, first_name, last_name, nickname")
        .in("id", roomStaffProfileIds);

      if (error) {
        console.warn("No se pudieron cargar perfiles de rooming:", error.message);
        return [];
      }

      return (data || []) as RoomOccupantProfile[];
    },
    enabled: roomStaffProfileIds.length > 0,
  });

  const roomOccupantNameMap = useMemo(() => {
    const map = new Map<string, string>();
    assignedTechNameById.forEach((name, id) => map.set(id, name));

    roomOccupantProfiles.forEach((profile) => {
      const fullName = [profile.first_name, profile.last_name]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join(" ");
      map.set(profile.id, fullName || profile.nickname || "Técnico");
    });
    return map;
  }, [assignedTechNameById, roomOccupantProfiles]);

  const normalizeRoomOccupantId = useCallback((rawId?: string | null): string | null => {
    if (!rawId || !rawId.trim()) return null;
    const trimmed = rawId.trim();
    return assignedTechIdByIndex.get(trimmed) || trimmed;
  }, [assignedTechIdByIndex]);

  const resolveRoomOccupantName = useCallback((rawId?: string | null): string => {
    const normalizedId = normalizeRoomOccupantId(rawId);
    if (!normalizedId) return "Sin asignar";

    const mappedName = roomOccupantNameMap.get(normalizedId);
    if (mappedName) return mappedName;

    if (rawId && /^\d+$/.test(rawId)) {
      const byIndex = staffAssignments[Number(rawId)]?.technician;
      if (byIndex) {
        const fullName = [byIndex.first_name, byIndex.last_name]
          .filter((value): value is string => Boolean(value && value.trim()))
          .join(" ");
        if (fullName) return fullName;
        if (byIndex.email) return byIndex.email;
      }
    }

    return `Técnico (${normalizedId.slice(0, 8)})`;
  }, [normalizeRoomOccupantId, roomOccupantNameMap, staffAssignments]);

  const roomieNamesByTechId = useMemo(() => {
    const map = new Map<string, Set<string>>();

    hojaAccommodations.forEach((accommodation) => {
      (accommodation.hoja_de_ruta_room_assignments || []).forEach((room) => {
        const normalizedOccupants = [room.staff_member1_id, room.staff_member2_id]
          .map((id) => normalizeRoomOccupantId(id))
          .filter((id): id is string => Boolean(id));
        const uniqueOccupants = Array.from(new Set(normalizedOccupants));
        if (uniqueOccupants.length < 2) return;

        uniqueOccupants.forEach((techId) => {
          const others = uniqueOccupants.filter((otherId) => otherId !== techId);
          if (others.length === 0) return;

          if (!map.has(techId)) map.set(techId, new Set<string>());
          const roomieSet = map.get(techId)!;
          others.forEach((otherId) => roomieSet.add(resolveRoomOccupantName(otherId)));
        });
      });
    });

    return new Map(
      Array.from(map.entries()).map(([techId, names]) => [
        techId,
        Array.from(names).sort((a, b) => a.localeCompare(b)),
      ]),
    );
  }, [hojaAccommodations, normalizeRoomOccupantId, resolveRoomOccupantName]);

  const getRoomOccupantsLabel = useCallback((room: { staff_member1_id?: string | null; staff_member2_id?: string | null }): string => {
    const occupants = [room.staff_member1_id, room.staff_member2_id]
      .filter((id): id is string => Boolean(id))
      .map((id) => resolveRoomOccupantName(id));
    return occupants.length > 0 ? occupants.join(" · ") : "Sin ocupantes asignados";
  }, [resolveRoomOccupantName]);

  const hasHojaAccommodationData = hojaAccommodations.length > 0;
  const hasHojaTransportData = hojaTravelArrangements.length > 0 || hojaTransportEntries.length > 0;
  const isTransportDataLoading = hojaDeRutaLoading || hojaTravelLoading || hojaTransportLoading;
  const canUploadTourDocuments = isTechnicianRole(userRole);

  const handleTourDocumentUploadSuccess = useCallback(() => {
    setIsUploadingTourDocument(false);
    queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-documents-for-job", tourId) });
  }, [queryClient, tourId]);

  return {
    activeTab,
    assignedDatesLoading,
    allAssignedDates,
    artistNameMap,
    artistStageMap,
    canUploadTourDocuments,
    dateTypeMap,
    documentLoading,
    eventDatesString,
    festivalStageNameMap,
    fetchWeather,
    getDepartmentFromAssignment,
    getRoleFromAssignment,
    getRoomOccupantsLabel,
    handleDownload,
    handleDownloadRider,
    handleDownloadTourDocument,
    handleOpenAddressInMaps,
    handleOpenMaps,
    handleTourDocumentUploadSuccess,
    handleViewDocument,
    handleViewRider,
    handleViewTourDocument,
    hasHojaAccommodationData,
    hasHojaTransportData,
    hojaAccommodations,
    hojaAccommodationsLoading,
    hojaDeRutaId,
    hojaDeRutaLoading,
    hojaTransportEntries,
    hojaTravelArrangements,
    isArtistsLoading,
    isDark,
    isMapLoading,
    isRestaurantsLoading,
    isRidersLoading,
    isTransportDataLoading,
    isUploadingTourDocument,
    isWeatherLoading,
    job,
    jobArtists,
    jobArtistsError,
    jobDateTypesLoading,
    jobDetails,
    jobDetailsLoading,
    jobEndDate,
    jobStartDate,
    locationData,
    mapPreviewUrl,
    onClose,
    restaurants,
    riderFiles,
    riderFilesError,
    roomieNamesByTechId,
    roomOccupantsLoading,
    roomStaffIds,
    setActiveTab,
    setIsUploadingTourDocument,
    staffAssignments,
    staffLoading,
    techShiftAssignmentsByDate,
    techShiftAssignmentsLoading,
    theme,
    tourDocuments,
    tourDocumentsLoading,
    tourId,
    user,
    userRole,
    weatherData,
    weatherError,
    weatherVenue,
  };
};

export type DetailsModalViewModel = ReturnType<typeof useDetailsModalData>;
