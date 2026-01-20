import { useEffect, useState, useCallback, useMemo, type ChangeEvent } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import type { PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { Department } from "@/types/department";
import { createAllFoldersForJob, openFlexElement } from "@/utils/flex-folders";
import type { CreateFoldersOptions } from "@/utils/flex-folders";
import { resolveJobDocLocation } from "@/utils/jobDocuments";
import { generateIndividualStagePDFs } from "@/utils/pdf/individualStagePdfGenerator";
import { generateAndMergeFestivalPDFs } from "@/utils/pdf/festivalPdfGenerator";
import { format, isValid } from "date-fns";

import type { ArtistRiderFile, FestivalJob, JobDocumentEntry } from "./types";

export type FestivalManagementVmResult =
  | { status: "missing_job_id" }
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "ready"; vm: any };

export const useFestivalManagementVm = (): FestivalManagementVmResult => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isSingleJobMode = searchParams.get("singleJob") === "true";
  const { toast } = useToast();
  const [job, setJob] = useState<FestivalJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [artistCount, setArtistCount] = useState(0);
  const [jobDates, setJobDates] = useState<Date[]>([]);
  const [venueData, setVenueData] = useState<{
    address?: string;
    coordinates?: { lat: number; lng: number };
  }>({});
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const { userRole } = useOptimizedAuth();
  const [maxStages, setMaxStages] = useState(1);
  const { flexUuid, isLoading: isFlexLoading, error: flexError, folderExists, refetch: refetchFlexUuid } = useFlexUuid(jobId || "");
  const [jobDocuments, setJobDocuments] = useState<JobDocumentEntry[]>([]);
  const [artistRiderFiles, setArtistRiderFiles] = useState<ArtistRiderFile[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [assignmentDepartment, setAssignmentDepartment] = useState<Department>("sound");
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isRouteSheetOpen, setIsRouteSheetOpen] = useState(false);
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);
  const [isFlexLogOpen, setIsFlexLogOpen] = useState(false);
  const [isCreatingFlexFolders, setIsCreatingFlexFolders] = useState(false);
  const [isFlexPickerOpen, setIsFlexPickerOpen] = useState(false);
  const [flexPickerOptions, setFlexPickerOptions] = useState<CreateFoldersOptions | undefined>(undefined);
  const [flexPickerMode, setFlexPickerMode] = useState<"create" | "add">("add");
  const [isJobPresetsOpen, setIsJobPresetsOpen] = useState(false);

  // New action states
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isCreatingLocalFolders, setIsCreatingLocalFolders] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<any | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveMode, setArchiveMode] = useState<"by-prefix" | "all-tech">("by-prefix");
  const [archiveIncludeTemplates, setArchiveIncludeTemplates] = useState(false);
  const [archiveDryRun, setArchiveDryRun] = useState(false);
  const [isBackfillDialogOpen, setIsBackfillDialogOpen] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<any | null>(null);
  const [bfSound, setBfSound] = useState(true);
  const [bfLights, setBfLights] = useState(true);
  const [bfVideo, setBfVideo] = useState(true);
  const [bfProduction, setBfProduction] = useState(true);
  const [uuidSound, setUuidSound] = useState("");
  const [uuidLights, setUuidLights] = useState("");
  const [uuidVideo, setUuidVideo] = useState("");
  const [uuidProduction, setUuidProduction] = useState("");
  const [isWhatsappDialogOpen, setIsWhatsappDialogOpen] = useState(false);
  const [waDepartment, setWaDepartment] = useState<'sound' | 'lights' | 'video'>('sound');
  const [isAlmacenDialogOpen, setIsAlmacenDialogOpen] = useState(false);
  const [waMessage, setWaMessage] = useState<string>("");
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if WhatsApp group already exists for this job/department
  const { data: waGroup, refetch: refetchWaGroup } = useQuery({
    queryKey: ['job-whatsapp-group', jobId, waDepartment],
    enabled: !!jobId && !!waDepartment && (userRole === 'management' || userRole === 'admin'),
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await supabase
        .from('job_whatsapp_groups')
        .select('id, wa_group_id')
        .eq('job_id', jobId)
        .eq('department', waDepartment)
        .maybeSingle();
      if (error) return null;
      return data;
    }
  });

  const { data: waRequest, refetch: refetchWaRequest } = useQuery({
    queryKey: ['job-whatsapp-group-request', jobId, waDepartment],
    enabled: !!jobId && !!waDepartment && (userRole === 'management' || userRole === 'admin'),
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await supabase
        .from('job_whatsapp_group_requests')
        .select('id, created_at')
        .eq('job_id', jobId)
        .eq('department', waDepartment)
        .maybeSingle();
      if (error) return null;
      return data;
    }
  });

  const resolveJobDocumentLocation = useCallback((path: string) => resolveJobDocLocation(path), []);

  const fetchJobDetails = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (!jobId) {
        setJob(null);
        setArtistCount(0);
        setJobDates([]);
        setVenueData({});
        if (!silent) {
          setIsLoading(false);
        }
        return;
      }

      if (!silent) {
        setIsLoading(true);
      }

      try {
        console.log("Fetching job details for jobId:", jobId);

        const { data: jobData, error: jobError } = await supabase.from("jobs").select("*").eq("id", jobId).single();

        if (jobError) {
          console.error("Error fetching job data:", jobError);
          throw jobError;
        }

        console.log("Job data retrieved:", jobData);
        setJob(jobData);

        const { count: artistCountValue, error: artistError } = await supabase
          .from("festival_artists")
          .select("*", { count: "exact" })
          .eq("job_id", jobId);

        if (artistError) {
          console.error("Error fetching artist count:", artistError);
          throw artistError;
        }

        setArtistCount(artistCountValue || 0);

        const { data: gearSetups, error: gearError } = await supabase
          .from("festival_gear_setups")
          .select("max_stages")
          .eq("job_id", jobId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (gearError) {
          console.error("Error fetching gear setup:", gearError);
        } else if (gearSetups && gearSetups.length > 0) {
          setMaxStages(gearSetups[0].max_stages || 1);
        }

        if (jobData.location_id) {
          const { data: loc, error: locError } = await supabase
            .from("locations")
            .select("name, formatted_address, latitude, longitude")
            .eq("id", jobData.location_id)
            .single();

          if (!locError && loc) {
            setVenueData({
              address: (loc.formatted_address || loc.name || undefined) as string | undefined,
              coordinates:
                typeof loc.latitude === "number" && typeof loc.longitude === "number"
                  ? { lat: loc.latitude, lng: loc.longitude }
                  : undefined,
            });
          } else {
            console.log("No location found for job; falling back to hoja_de_ruta if available");
            const { data: hojaData, error: hojaError } = await supabase
              .from("hoja_de_ruta")
              .select("venue_address, venue_latitude, venue_longitude")
              .eq("job_id", jobId)
              .maybeSingle();

            if (!hojaError && hojaData) {
              setVenueData({
                address: hojaData.venue_address || undefined,
                coordinates:
                  typeof hojaData.venue_latitude === "number" && typeof hojaData.venue_longitude === "number"
                    ? { lat: hojaData.venue_latitude, lng: hojaData.venue_longitude }
                    : undefined,
              });
            }
          }
        } else {
          console.log("Job has no location_id; attempting hoja_de_ruta fallback");
          const { data: hojaData, error: hojaError } = await supabase
            .from("hoja_de_ruta")
            .select("venue_address, venue_latitude, venue_longitude")
            .eq("job_id", jobId)
            .maybeSingle();

          if (!hojaError && hojaData) {
            setVenueData({
              address: hojaData.venue_address || undefined,
              coordinates:
                typeof hojaData.venue_latitude === "number" && typeof hojaData.venue_longitude === "number"
                  ? { lat: hojaData.venue_latitude, lng: hojaData.venue_longitude }
                  : undefined,
            });
          }
        }

        const startDate = new Date(jobData.start_time);
        const endDate = new Date(jobData.end_time);

        if (isValid(startDate) && isValid(endDate)) {
          const dates: Date[] = [];
          const currentDate = new Date(startDate);

          while (currentDate <= endDate) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }

          setJobDates(dates);
        } else {
          console.warn("Invalid dates in job data, checking for date types");

          const { data: dateTypes, error: dateTypesError } = await supabase.from("job_date_types").select("*").eq("job_id", jobId);

          if (dateTypesError) {
            console.error("Error fetching date types:", dateTypesError);
          } else if (dateTypes && dateTypes.length > 0) {
            const uniqueDates = Array.from(
              new Set(
                dateTypes
                  .map((dt) => {
                    try {
                      return new Date(dt.date);
                    } catch (e) {
                      return null;
                    }
                  })
                  .filter((date) => date && isValid(date)),
              ),
            ) as Date[];

            setJobDates(uniqueDates);
          } else {
            console.warn("No valid dates found for this job");
            setJobDates([new Date()]);
          }
        }
      } catch (error: any) {
        console.error("Error fetching festival details:", error);
        if (!silent) {
          toast({
            title: "Error",
            description: "Could not load festival details",
            variant: "destructive",
          });
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [jobId, toast],
  );

  const fetchDocuments = useCallback(async () => {
    if (!jobId) {
      setJobDocuments([]);
      setArtistRiderFiles([]);
      setIsLoadingDocuments(false);
      return;
    }

    setIsLoadingDocuments(true);
    try {
      const { data: jobDocs, error: jobDocsError } = await supabase
        .from("job_documents")
        .select("id, file_name, file_path, uploaded_at, read_only, template_type")
        .eq("job_id", jobId)
        .order("uploaded_at", { ascending: false });

      if (jobDocsError) {
        throw jobDocsError;
      }

      setJobDocuments((jobDocs || []) as JobDocumentEntry[]);

      // Two-step: get artists, then rider files for those artists
      const { data: artistsForJob, error: artistsErr } = await supabase.from("festival_artists").select("id, name").eq("job_id", jobId);
      if (artistsErr) throw artistsErr;
      const artistIds = (artistsForJob || []).map((a) => a.id);
      let riderData: any[] = [];
      if (artistIds.length > 0) {
        let query = supabase
          .from("festival_artist_files")
          .select("id, file_name, file_path, uploaded_at, artist_id")
          .order("uploaded_at", { ascending: false });
        if (artistIds.length === 1) {
          query = query.eq("artist_id", artistIds[0]);
        } else {
          const orExpr = artistIds.map((id) => `artist_id.eq.${id}`).join(",");
          query = query.or(orExpr);
        }
        const { data, error } = await query;
        if (error) throw error;
        riderData = data || [];
        // re-attach artist names for grouping
        const nameMap = new Map((artistsForJob || []).map((a) => [a.id, (a as any).name]));
        riderData = riderData.map((f: any) => ({
          ...f,
          festival_artists: { id: f.artist_id, name: nameMap.get(f.artist_id) || "Unknown" },
        }));
      }

      setArtistRiderFiles((riderData || []) as unknown as ArtistRiderFile[]);
    } catch (error: any) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Error al cargar documentos",
        description: error.message || "No se pudieron cargar los documentos para este trabajo.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [jobId, toast]);

  const handleJobDocumentView = useCallback(
    async (docEntry: JobDocumentEntry) => {
      try {
        const { bucket, path } = resolveJobDocumentLocation(docEntry.file_path);
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);

        if (error) throw error;

        if (data?.signedUrl) {
          window.open(data.signedUrl, "_blank", "noopener");
        }
      } catch (error: any) {
        console.error("Error viewing document:", error);
        toast({
          title: "No se puede abrir el documento",
          description: error.message || "Por favor, inténtalo de nuevo en unos momentos.",
          variant: "destructive",
        });
      }
    },
    [resolveJobDocumentLocation, toast],
  );

  const handleJobDocumentDownload = useCallback(
    async (docEntry: JobDocumentEntry) => {
      try {
        const { bucket, path } = resolveJobDocumentLocation(docEntry.file_path);
        const { data, error } = await supabase.storage.from(bucket).download(path);

        if (error) throw error;

        const url = window.URL.createObjectURL(data);
        const downloadLink = window.document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = docEntry.file_name;
        window.document.body.appendChild(downloadLink);
        downloadLink.click();
        window.document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(url);
      } catch (error: any) {
        console.error("Error downloading document:", error);
        toast({
          title: "Descarga fallida",
          description: error.message || "No se pudo descargar ese archivo.",
          variant: "destructive",
        });
      }
    },
    [resolveJobDocumentLocation, toast],
  );

  const handleRiderView = useCallback(
    async (file: ArtistRiderFile) => {
      try {
        const { data, error } = await supabase.storage.from("festival_artist_files").createSignedUrl(file.file_path, 3600);

        if (error) throw error;

        if (data?.signedUrl) {
          window.open(data.signedUrl, "_blank", "noopener");
        }
      } catch (error: any) {
        console.error("Error viewing rider:", error);
        toast({
          title: "No se puede abrir el rider",
          description: error.message || "Por favor, inténtalo de nuevo más tarde.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleRiderDownload = useCallback(
    async (file: ArtistRiderFile) => {
      try {
        const { data, error } = await supabase.storage.from("festival_artist_files").download(file.file_path);

        if (error) throw error;

        const url = window.URL.createObjectURL(data);
        const downloadLink = window.document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = file.file_name;
        window.document.body.appendChild(downloadLink);
        downloadLink.click();
        window.document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(url);
      } catch (error: any) {
        console.error("Error downloading rider:", error);
        toast({
          title: "Descarga fallida",
          description: error.message || "No se pudo descargar ese archivo de rider.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleRefreshDocuments = useCallback(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const groupedRiderFiles = useMemo(() => {
    const map = new Map<string, { artistId: string; artistName: string; files: ArtistRiderFile[] }>();
    artistRiderFiles.forEach((file) => {
      const artistId = file.artist_id || file.festival_artists?.id || "unknown";
      const artistName = file.festival_artists?.name || "Unknown Artist";
      if (!map.has(artistId)) {
        map.set(artistId, { artistId, artistName, files: [] });
      }
      map.get(artistId)!.files.push(file);
    });

    return Array.from(map.values()).sort((a, b) => a.artistName.localeCompare(b.artistName));
  }, [artistRiderFiles]);

  const formatDateLabel = useCallback((value?: string | null) => {
    if (!value) return "Unknown date";
    const parsed = new Date(value);
    return isValid(parsed) ? format(parsed, "MMM d, yyyy") : "Unknown date";
  }, []);

  const departmentOptions: Department[] = [
    "sound",
    "lights",
    "video",
    "production",
    "logistics",
    "administrative",
    "personnel",
    "comercial",
  ];

  const humanizeDepartment = useCallback((dep: Department) => dep.charAt(0).toUpperCase() + dep.slice(1), []);

  const handleAssignmentChange = useCallback(() => {
    fetchJobDetails({ silent: true });
    fetchDocuments();
  }, [fetchJobDetails, fetchDocuments]);

  const handleOpenAssignments = useCallback(() => {
    if (!jobId) return;
    setIsAssignmentDialogOpen(true);
  }, [jobId]);

  const handleNavigateTimesheets = useCallback(() => {
    if (!jobId) return;
    navigate(`/timesheets?jobId=${jobId}`);
  }, [jobId, navigate]);

  const handleOpenRouteSheet = useCallback(() => {
    setIsRouteSheetOpen(true);
  }, []);

  const handleOpenJobDetails = useCallback(() => {
    if (!job) return;
    setIsJobDetailsOpen(true);
  }, [job]);

  const handleOpenFlexLogs = useCallback(() => {
    setIsFlexLogOpen(true);
  }, []);

  const handleOpenFlexPicker = useCallback(() => {
    if (!job || isCreatingFlexFolders) {
      return;
    }
    // Open the FlexFolderPicker in 'add' mode
    setFlexPickerMode("add");
    setIsFlexPickerOpen(true);
  }, [job, isCreatingFlexFolders]);

  const handleRefreshAll = useCallback(() => {
    fetchJobDetails();
    fetchDocuments();
    refetchFlexUuid();
  }, [fetchJobDetails, fetchDocuments, refetchFlexUuid]);

  const handleCreateFlexFolders = useCallback(() => {
    if (!job || isCreatingFlexFolders) return;

    // Open the FlexFolderPicker in 'create' mode
    setFlexPickerMode("create");
    setIsFlexPickerOpen(true);
  }, [job, isCreatingFlexFolders]);

  const handleFlexPickerConfirm = useCallback(
    async (options?: CreateFoldersOptions) => {
      if (!job || !jobId) {
        return;
      }

      setFlexPickerOptions(options);
      setIsFlexPickerOpen(false);

      // Check for existing folders if in 'create' mode
      if (flexPickerMode === "create") {
        try {
          const { data: existingFolders, error: existingError } = await supabase
            .from("flex_folders")
            .select("id")
            .eq("job_id", jobId)
            .limit(1);

          if (existingError) {
            throw existingError;
          }

          if (existingFolders && existingFolders.length > 0) {
            toast({
              title: "Las carpetas ya existen",
              description: "Ya se han creado carpetas Flex para este trabajo.",
            });
            return;
          }
        } catch (error: any) {
          console.error("Error checking existing folders:", error);
          toast({
            title: "Error al verificar carpetas",
            description: error.message || "Por favor, inténtalo de nuevo en un momento.",
            variant: "destructive",
          });
          return;
        }
      }

      if (!job.start_time || !job.end_time) {
        toast({
          title: "Fechas del trabajo faltantes",
          description: `Actualiza las fechas del trabajo antes de ${flexPickerMode === "create" ? "crear" : "añadir"} carpetas Flex.`,
          variant: "destructive",
        });
        return;
      }

      const startDate = new Date(job.start_time);
      const endDate = new Date(job.end_time);

      if (!isValid(startDate) || !isValid(endDate)) {
        toast({
          title: "Fechas del trabajo inválidas",
          description: "Por favor, verifica las fechas del trabajo antes de crear carpetas Flex.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsCreatingFlexFolders(true);

        const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, "");
        const formattedStartDate = startDate.toISOString().split(".")[0] + ".000Z";
        const formattedEndDate = endDate.toISOString().split(".")[0] + ".000Z";

        toast({
          title: flexPickerMode === "create" ? "Creando carpetas Flex…" : "Añadiendo carpetas Flex…",
          description: flexPickerMode === "create" ? "Esto puede tardar unos segundos." : "Las carpetas seleccionadas se crearán en Flex.",
        });

        await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber, options);

        // Broadcast push notification: Flex folders created for job
        try {
          void supabase.functions.invoke("push", {
            body: { action: "broadcast", type: "flex.folders.created", job_id: jobId },
          });
        } catch (pushError) {
          console.error("Error sending push notification:", pushError);
        }

        toast({
          title: flexPickerMode === "create" ? "Carpetas Flex listas" : "Carpetas Flex actualizadas",
          description: flexPickerMode === "create" ? "Las carpetas se han creado exitosamente." : "Las carpetas seleccionadas se han añadido exitosamente.",
        });

        await Promise.all([refetchFlexUuid(), fetchJobDetails({ silent: true }), fetchDocuments()]);
      } catch (error: any) {
        console.error("Error adding Flex folders:", error);
        toast({
          title: "Error al actualizar carpetas Flex",
          description: error.message || "Por favor, inténtalo de nuevo en un momento.",
          variant: "destructive",
        });
      } finally {
        setIsCreatingFlexFolders(false);
      }
    },
    [job, jobId, flexPickerMode, toast, refetchFlexUuid, fetchJobDetails, fetchDocuments],
  );

  const flexStatus = useMemo(() => {
    if (isFlexLoading) {
      return { label: "Verificando estado…", variant: "outline" as const };
    }
    if (flexError) {
      return { label: "Error de Flex", variant: "destructive" as const };
    }
    if (folderExists) {
      return { label: "Carpetas listas", variant: "secondary" as const };
    }
    return { label: "Carpetas no creadas", variant: "outline" as const };
  }, [isFlexLoading, flexError, folderExists]);

  const isSchedulingRoute = location.pathname.includes("/scheduling");
  const isArtistRoute = location.pathname.includes("/artists");
  const isGearRoute = location.pathname.includes("/gear");

  const canEdit = ["admin", "management", "logistics"].includes(userRole || "");
  const isViewOnly = userRole === "technician";

  useEffect(() => {
    fetchJobDetails();

    if (!jobId) {
      return;
    }

    const channel = supabase
      .channel(`job-${jobId}-updates`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
          filter: `id=eq.${jobId}`,
        },
        () => {
          fetchJobDetails({ silent: true });
          fetchDocuments();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [jobId, fetchJobDetails, fetchDocuments]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Load static map preview when venue data is available
  useEffect(() => {
    const loadStaticMap = async () => {
      try {
        if (!venueData.address && !venueData.coordinates) {
          setMapPreviewUrl(null);
          return;
        }

        setIsMapLoading(true);

        // Fetch Google Maps API key
        const { data, error } = await supabase.functions.invoke("get-google-maps-key");
        if (error || !data?.apiKey) {
          console.warn("Failed to load Google Maps API key");
          setMapPreviewUrl(null);
          setIsMapLoading(false);
          return;
        }

        const apiKey = data.apiKey as string;
        const zoom = 13;
        const width = 400;
        const height = 200;
        const scale = 2;

        const center = venueData.coordinates
          ? `${venueData.coordinates.lat},${venueData.coordinates.lng}`
          : encodeURIComponent(venueData.address || "");

        const markers = venueData.coordinates
          ? `&markers=color:red|label:V|${venueData.coordinates.lat},${venueData.coordinates.lng}`
          : venueData.address
            ? `&markers=color:red|label:V|${encodeURIComponent(venueData.address)}`
            : "";

        const url = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${width}x${height}&scale=${scale}${markers}&key=${encodeURIComponent(apiKey)}`;

        setMapPreviewUrl(url);
      } catch (e: any) {
        console.warn("Failed to load static map preview:", e?.message || e);
        setMapPreviewUrl(null);
      } finally {
        setIsMapLoading(false);
      }
    };

    loadStaticMap();
  }, [venueData]);

  const handlePrintAllDocumentation = async (options: PrintOptions, filename: string) => {
    if (!jobId) return;

    setIsPrinting(true);
    try {
      console.log("Starting documentation print process with options:", options);

      let result: { blob: Blob; filename: string };

      if (options.generateIndividualStagePDFs) {
        console.log("Generating individual stage PDFs");
        result = await generateIndividualStagePDFs(jobId, job?.title || "Festival", options, maxStages);
      } else {
        console.log("Generating combined PDF");
        result = await generateAndMergeFestivalPDFs(jobId, job?.title || "Festival", options, filename);
      }

      console.log(`Generated file, size: ${result.blob.size} bytes`);
      if (!result.blob || result.blob.size === 0) {
        throw new Error("Generated file is empty");
      }

      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Éxito",
        description: options.generateIndividualStagePDFs
          ? "PDFs individuales de escenarios generados exitosamente"
          : "Documentación generada exitosamente",
      });
    } catch (error: any) {
      console.error("Error generating documentation:", error);
      toast({
        title: "Error",
        description: `Error al generar documentación: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintButtonClick = () => {
    setIsPrintDialogOpen(true);
  };

  const handleFlexClick = async () => {
    if (isFlexLoading) {
      toast({ title: "Cargando", description: "Por favor espera mientras cargamos la carpeta Flex..." });
      return;
    }

    if (flexUuid) {
      await openFlexElement({
        elementId: flexUuid,
        onError: (error) => {
          toast({ title: "Error", description: error.message || "Error al abrir Flex", variant: "destructive" });
        },
        onWarning: (message) => {
          toast({ title: "Advertencia", description: message });
        },
      });
    } else if (flexError) {
      toast({ title: "Error", description: flexError, variant: "destructive" });
    } else {
      toast({ title: "Info", description: "Carpeta Flex no disponible para este festival" });
    }
  };

  // New action handlers
  const handleDocumentUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !jobId) return;

      setIsUploadingDocument(true);
      try {
        const filePath = `${jobId}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from("job_documents").upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase.from("job_documents").insert({
          job_id: jobId,
          file_name: file.name,
          file_path: filePath,
        });

        if (dbError) throw dbError;

        toast({
          title: "Éxito",
          description: "Documento subido exitosamente",
        });

        fetchDocuments();
      } catch (error: any) {
        console.error("Error uploading document:", error);
        toast({
          title: "Error al subir",
          description: error.message || "Error al subir documento",
          variant: "destructive",
        });
      } finally {
        setIsUploadingDocument(false);
        e.target.value = "";
      }
    },
    [jobId, toast, fetchDocuments],
  );

  const handleCreateLocalFolders = useCallback(
    async () => {
      if (!job) return;

      setIsCreatingLocalFolders(true);
      try {
        const { data, error } = await supabase.functions.invoke("create-local-folders", {
          body: { job_id: job.id },
        });

        if (error) throw error;

        toast({
          title: "Éxito",
          description: data?.message || "Carpetas locales creadas exitosamente",
        });
      } catch (error: any) {
        console.error("Error creating local folders:", error);
        toast({
          title: "Error",
          description: error.message || "Error al crear carpetas locales",
          variant: "destructive",
        });
      } finally {
        setIsCreatingLocalFolders(false);
      }
    },
    [job, toast],
  );

  const handleArchiveToFlex = useCallback(
    async () => {
      setIsArchiving(true);
      setArchiveError(null);
      setArchiveResult(null);
      try {
        const { data, error } = await supabase.functions.invoke("archive-to-flex", {
          body: {
            job_id: jobId,
            mode: archiveMode,
            include_templates: archiveIncludeTemplates,
            dry_run: archiveDryRun,
          },
        });
        if (error) throw error;
        setArchiveResult(data);
        toast({
          title: archiveDryRun ? "Prueba completada" : "Archivo completado",
          description: `${data?.uploaded ?? 0} subidos, ${data?.failed ?? 0} fallidos`,
        });
        if (!archiveDryRun && (data?.uploaded ?? 0) > 0) {
          fetchDocuments();
        }
      } catch (err: any) {
        console.error("Archive error", err);
        setArchiveError(err?.message || "Failed to archive");
        toast({ title: "Error al archivar", description: err?.message || "Error al archivar", variant: "destructive" });
      } finally {
        setIsArchiving(false);
      }
    },
    [jobId, archiveMode, archiveIncludeTemplates, archiveDryRun, toast, fetchDocuments],
  );

  const handleBackfill = useCallback(
    async () => {
      setIsBackfilling(true);
      setBackfillMessage(null);
      setBackfillResult(null);
      try {
        const depts: string[] = [];
        if (bfSound) depts.push("sound");
        if (bfLights) depts.push("lights");
        if (bfVideo) depts.push("video");
        if (bfProduction) depts.push("production");
        const body: any = { job_id: jobId };
        if (depts.length) body.departments = depts;
        const manual: Array<{ dept: string; element_id: string }> = [];
        if (uuidSound.trim()) manual.push({ dept: "sound", element_id: uuidSound.trim() });
        if (uuidLights.trim()) manual.push({ dept: "lights", element_id: uuidLights.trim() });
        if (uuidVideo.trim()) manual.push({ dept: "video", element_id: uuidVideo.trim() });
        if (uuidProduction.trim()) manual.push({ dept: "production", element_id: uuidProduction.trim() });
        if (manual.length) body.manual = manual;
        const { data, error } = await supabase.functions.invoke("backfill-flex-doc-tecnica", { body });
        if (error) throw error;
        setBackfillResult(data);
        setBackfillMessage(`Inserted ${data?.inserted ?? 0}, already ${data?.already ?? 0}`);
        toast({ title: "Relleno completado", description: `Insertados ${data?.inserted ?? 0}, ya existían ${data?.already ?? 0}` });
      } catch (err: any) {
        console.error("Backfill error", err);
        setBackfillMessage(err?.message || "Backfill failed");
        toast({ title: "Error al rellenar", description: err?.message || "Error al rellenar", variant: "destructive" });
      } finally {
        setIsBackfilling(false);
      }
    },
    [jobId, bfSound, bfLights, bfVideo, bfProduction, uuidSound, uuidLights, uuidVideo, uuidProduction, toast],
  );

  const handleCreateWhatsappGroup = useCallback(
    async () => {
      try {
        setIsSendingWa(true);
        const { error } = await supabase.functions.invoke("create-whatsapp-group", {
          body: { job_id: jobId, department: waDepartment },
        });
        if (error) throw error;
        toast({
          title: "Éxito",
          description: "Grupo de WhatsApp creado exitosamente",
        });
        setIsWhatsappDialogOpen(false);
        await Promise.all([refetchWaGroup(), refetchWaRequest()]);
      } catch (error: any) {
        console.error("Error creating WhatsApp group:", error);
        toast({
          title: "Error",
          description: error.message || "Error al crear grupo de WhatsApp",
          variant: "destructive",
        });
        await Promise.all([refetchWaGroup(), refetchWaRequest()]);
      } finally {
        setIsSendingWa(false);
      }
    },
    [jobId, waDepartment, refetchWaGroup, refetchWaRequest, toast],
  );

  const handleRetryWhatsappGroup = useCallback(
    async () => {
      if (!jobId) {
        toast({ title: 'Error', description: 'No se encontró el trabajo.', variant: 'destructive' });
        return;
      }

      setIsSendingWa(true);
      try {
        // Clear the failed request using RPC function
        const { data: clearResult, error: clearError } = await supabase.rpc(
          'clear_whatsapp_group_request',
          { p_job_id: jobId, p_department: waDepartment }
        );

        if (clearError) {
          toast({
            title: 'Error',
            description: `No se pudo limpiar la solicitud: ${clearError.message}`,
            variant: 'destructive'
          });
          setIsSendingWa(false);
          return;
        }

        const result = clearResult as any;

        if (!result.success) {
          toast({
            title: 'Aviso',
            description: result.error || result.message,
            variant: result.can_retry ? 'default' : 'destructive'
          });
          await Promise.all([refetchWaGroup(), refetchWaRequest()]);
          setIsSendingWa(false);
          return;
        }

        toast({
          title: 'Solicitud limpiada',
          description: 'Intentando crear el grupo de nuevo...'
        });

        await Promise.all([refetchWaGroup(), refetchWaRequest()]);

        // Wait a moment for state to update, then retry creation
        setTimeout(() => {
          handleCreateWhatsappGroup();
        }, 500);

      } catch (err: any) {
        toast({
          title: 'Error',
          description: `Error al reintentar: ${err.message}`,
          variant: 'destructive'
        });
        await Promise.all([refetchWaGroup(), refetchWaRequest()]);
        setIsSendingWa(false);
      }
    },
    [jobId, waDepartment, refetchWaGroup, refetchWaRequest, handleCreateWhatsappGroup, toast],
  );

  const handleSendToAlmacen = useCallback(
    async () => {
      try {
        setIsSendingWa(true);
        const defaultMsg = `He hecho cambios en el PS del ${job?.title || "trabajo"} por favor echad un vistazo`;
        const trimmed = (waMessage || "").trim();
        const finalMsg = trimmed || defaultMsg;
        const isDefault = finalMsg.trim().toLowerCase() === defaultMsg.trim().toLowerCase();
        const { error } = await supabase.functions.invoke("send-warehouse-message", { body: { message: finalMsg, job_id: jobId, highlight: isDefault } });
        if (error) {
          toast({ title: "Error al enviar", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Enviado", description: "Mensaje enviado a Almacén sonido." });
          setIsAlmacenDialogOpen(false);
        }
      } catch (e: any) {
        toast({ title: "Error", description: e?.message || String(e), variant: "destructive" });
      } finally {
        setIsSendingWa(false);
      }
    },
    [job?.title, jobId, waMessage, toast],
  );

  const handleDeleteJob = useCallback(
    async () => {
      if (!jobId) return;

      setIsDeleting(true);
      try {
        const { error } = await supabase.from("jobs").delete().eq("id", jobId);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Trabajo eliminado exitosamente",
        });

        navigate("/project-management");
      } catch (error: any) {
        console.error("Error deleting job:", error);
        toast({
          title: "Error",
          description: error.message || "Error al eliminar trabajo",
          variant: "destructive",
        });
      } finally {
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
      }
    },
    [jobId, toast, navigate],
  );

  const navigateToCalculator = useCallback(
    (type: "pesos" | "consumos") => {
      const params = new URLSearchParams({ jobId: jobId || "" });
      const path = type === "pesos" ? "/sound/pesos" : "/sound/consumos";
      navigate(`${path}?${params.toString()}`);
    },
    [jobId, navigate],
  );

  if (!jobId) return { status: "missing_job_id" };
  if (isLoading) return { status: "loading" };
  if (!job) return { status: "not_found" };

  const vm = {
    job,
    jobId,
    navigate,

    isSingleJobMode,
    isSchedulingRoute,
    isArtistRoute,
    isGearRoute,

    canEdit,
    isViewOnly,
    userRole,

    venueData,
    mapPreviewUrl,
    isMapLoading,

    isLoading,
    isLoadingDocuments,
    artistCount,
    jobDates,
    maxStages,

    jobDocuments,
    groupedRiderFiles,

    assignmentDepartment,
    setAssignmentDepartment,
    departmentOptions,
    humanizeDepartment,

    handleRefreshAll,
    handleRefreshDocuments,

    handleJobDocumentView,
    handleJobDocumentDownload,
    handleRiderView,
    handleRiderDownload,
    formatDateLabel,

    isAssignmentDialogOpen,
    setIsAssignmentDialogOpen,
    handleAssignmentChange,
    handleOpenAssignments,

    handleNavigateTimesheets,

    isRouteSheetOpen,
    setIsRouteSheetOpen,
    handleOpenRouteSheet,

    isJobDetailsOpen,
    setIsJobDetailsOpen,
    handleOpenJobDetails,

    isFlexLogOpen,
    setIsFlexLogOpen,
    handleOpenFlexLogs,

    flexUuid,
    isFlexLoading,
    flexError,
    folderExists,
    flexStatus,

    isFlexPickerOpen,
    setIsFlexPickerOpen,
    flexPickerOptions,
    handleFlexPickerConfirm,
    handleOpenFlexPicker,
    handleCreateFlexFolders,
    isCreatingFlexFolders,

    handleFlexClick,

    isPrinting,
    handlePrintButtonClick,
    isPrintDialogOpen,
    setIsPrintDialogOpen,
    handlePrintAllDocumentation,

    isJobPresetsOpen,
    setIsJobPresetsOpen,

    isArchiveDialogOpen,
    setIsArchiveDialogOpen,
    archiveMode,
    setArchiveMode,
    archiveIncludeTemplates,
    setArchiveIncludeTemplates,
    archiveDryRun,
    setArchiveDryRun,
    isArchiving,
    archiveResult,
    archiveError,
    handleArchiveToFlex,

    isBackfillDialogOpen,
    setIsBackfillDialogOpen,
    bfSound,
    setBfSound,
    bfLights,
    setBfLights,
    bfVideo,
    setBfVideo,
    bfProduction,
    setBfProduction,
    uuidSound,
    setUuidSound,
    uuidLights,
    setUuidLights,
    uuidVideo,
    setUuidVideo,
    uuidProduction,
    setUuidProduction,
    isBackfilling,
    backfillMessage,
    handleBackfill,

    isWhatsappDialogOpen,
    setIsWhatsappDialogOpen,
    waDepartment,
    setWaDepartment,
    waGroup,
    waRequest,
    isSendingWa,
    handleCreateWhatsappGroup,
    handleRetryWhatsappGroup,

    isAlmacenDialogOpen,
    setIsAlmacenDialogOpen,
    waMessage,
    setWaMessage,
    handleSendToAlmacen,

    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isDeleting,
    handleDeleteJob,

    handleDocumentUpload,
    isUploadingDocument,

    handleCreateLocalFolders,
    isCreatingLocalFolders,

    navigateToCalculator,
  };

  return { status: "ready", vm };
};

