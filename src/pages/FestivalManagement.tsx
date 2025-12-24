import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Music2, Layout, Calendar, Printer, Loader2, FileText, Download, Eye, Clock, FolderPlus, RefreshCw, MapPin, Link as LinkIcon, Box, Upload, Trash2, Archive, RotateCw, MessageCircle, Scale, Zap, AlertCircle, DollarSign } from "lucide-react";
import createFolderIcon from "@/assets/icons/icon.png";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format, isValid } from "date-fns";
import { FestivalLogoManager } from "@/components/festival/FestivalLogoManager";
import { FestivalScheduling } from "@/components/festival/scheduling/FestivalScheduling";
import { PrintOptionsDialog, PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { generateAndMergeFestivalPDFs } from "@/utils/pdf/festivalPdfGenerator";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import { generateIndividualStagePDFs } from "@/utils/pdf/individualStagePdfGenerator";
import { FestivalWeatherSection } from "@/components/festival/FestivalWeatherSection";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Department } from "@/types/department";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { JobDetailsDialog } from "@/components/jobs/JobDetailsDialog";
import { ModernHojaDeRuta } from "@/components/hoja-de-ruta/ModernHojaDeRuta";
import { FlexSyncLogDialog } from "@/components/jobs/FlexSyncLogDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CrewCallLinkerDialog } from "@/components/jobs/CrewCallLinker";
import { FlexFolderPicker } from "@/components/flex/FlexFolderPicker";
import { createAllFoldersForJob, openFlexElement } from "@/utils/flex-folders";
import type { CreateFoldersOptions } from "@/utils/flex-folders";
import { JobPresetManagerDialog } from "@/components/jobs/JobPresetManagerDialog";
import { resolveJobDocLocation } from "@/utils/jobDocuments";
import { TechnicianIncidentReportDialog } from "@/components/incident-reports/TechnicianIncidentReportDialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CreatePresupuestoDialog } from "@/components/festival/CreatePresupuestoDialog";

interface FestivalJob {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
}

interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  profile_complete: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  show_start: string;
  show_end: string;
  technical_info: any;
  infrastructure_info: any;
  extras: any;
  notes?: string;
}

interface Stage {
  id: string;
  name: string;
  number: number;
}

interface JobDocumentEntry {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  read_only?: boolean;
  template_type?: string | null;
}

interface ArtistRiderFile {
  id: string;
  file_name: string;
  file_path: string;
  created_at: string;
  artist_id?: string;
  festival_artists?: {
    id: string;
    name: string;
  } | null;
}

const FestivalManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isSingleJobMode = searchParams.get('singleJob') === 'true';
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
  const { flexUuid, isLoading: isFlexLoading, error: flexError, folderExists, refetch: refetchFlexUuid } = useFlexUuid(jobId || '');
  const [jobDocuments, setJobDocuments] = useState<JobDocumentEntry[]>([]);
  const [artistRiderFiles, setArtistRiderFiles] = useState<ArtistRiderFile[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [assignmentDepartment, setAssignmentDepartment] = useState<Department>('sound');
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isRouteSheetOpen, setIsRouteSheetOpen] = useState(false);
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);
  const [isFlexLogOpen, setIsFlexLogOpen] = useState(false);
  const [isCreatingFlexFolders, setIsCreatingFlexFolders] = useState(false);
  const [isFlexPickerOpen, setIsFlexPickerOpen] = useState(false);
  const [flexPickerOptions, setFlexPickerOptions] = useState<CreateFoldersOptions | undefined>(undefined);
  const [flexPickerMode, setFlexPickerMode] = useState<'create' | 'add'>('add');
  const [isJobPresetsOpen, setIsJobPresetsOpen] = useState(false);

  // New action states
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isCreatingLocalFolders, setIsCreatingLocalFolders] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<any | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveMode, setArchiveMode] = useState<'by-prefix' | 'all-tech'>('by-prefix');
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
  const [uuidSound, setUuidSound] = useState('');
  const [uuidLights, setUuidLights] = useState('');
  const [uuidVideo, setUuidVideo] = useState('');
  const [uuidProduction, setUuidProduction] = useState('');
  const [isWhatsappDialogOpen, setIsWhatsappDialogOpen] = useState(false);
  const [isAlmacenDialogOpen, setIsAlmacenDialogOpen] = useState(false);
  const [waMessage, setWaMessage] = useState<string>("");
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPresupuestoDialogOpen, setIsPresupuestoDialogOpen] = useState(false);

  const resolveJobDocumentLocation = useCallback((path: string) => resolveJobDocLocation(path), []);

  const fetchJobDetails = useCallback(async (options?: { silent?: boolean }) => {
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

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (jobError) {
        console.error("Error fetching job data:", jobError);
        throw jobError;
      }

      console.log("Job data retrieved:", jobData);
      setJob(jobData);

      const { count: artistCountValue, error: artistError } = await supabase
        .from("festival_artists")
        .select("*", { count: 'exact' })
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
              typeof loc.latitude === 'number' && typeof loc.longitude === 'number'
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
                typeof hojaData.venue_latitude === 'number' && typeof hojaData.venue_longitude === 'number'
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
              typeof hojaData.venue_latitude === 'number' && typeof hojaData.venue_longitude === 'number'
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

        const { data: dateTypes, error: dateTypesError } = await supabase
          .from("job_date_types")
          .select("*")
          .eq("job_id", jobId);

        if (dateTypesError) {
          console.error("Error fetching date types:", dateTypesError);
        } else if (dateTypes && dateTypes.length > 0) {
          const uniqueDates = Array.from(new Set(
            dateTypes
              .map(dt => {
                try {
                  return new Date(dt.date);
                } catch (e) {
                  return null;
                }
              })
              .filter(date => date && isValid(date))
          )) as Date[];

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
  }, [jobId, toast]);

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
        .from('job_documents')
        .select('id, file_name, file_path, uploaded_at, read_only, template_type')
        .eq('job_id', jobId)
        .order('uploaded_at', { ascending: false });

      if (jobDocsError) {
        throw jobDocsError;
      }

      setJobDocuments((jobDocs || []) as JobDocumentEntry[]);

      // Two-step: get artists, then rider files for those artists
      const { data: artistsForJob, error: artistsErr } = await supabase
        .from('festival_artists')
        .select('id, name')
        .eq('job_id', jobId);
      if (artistsErr) throw artistsErr;
      const artistIds = (artistsForJob || []).map(a => a.id);
      let riderData: any[] = [];
      if (artistIds.length > 0) {
        let query = supabase
          .from('festival_artist_files')
          .select('id, file_name, file_path, uploaded_at, artist_id')
          .order('uploaded_at', { ascending: false });
        if (artistIds.length === 1) {
          query = query.eq('artist_id', artistIds[0]);
        } else {
          const orExpr = artistIds.map((id) => `artist_id.eq.${id}`).join(',');
          query = query.or(orExpr);
        }
        const { data, error } = await query;
        if (error) throw error;
        riderData = data || [];
        // re-attach artist names for grouping
        const nameMap = new Map((artistsForJob || []).map(a => [a.id, (a as any).name]));
        riderData = riderData.map((f: any) => ({ ...f, festival_artists: { id: f.artist_id, name: nameMap.get(f.artist_id) || 'Unknown' } }));
      }

      setArtistRiderFiles((riderData || []) as unknown as ArtistRiderFile[]);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error al cargar documentos',
        description: error.message || 'No se pudieron cargar los documentos para este trabajo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [jobId, toast]);

  const handleJobDocumentView = useCallback(async (docEntry: JobDocumentEntry) => {
    try {
      const { bucket, path } = resolveJobDocumentLocation(docEntry.file_path);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener');
      }
    } catch (error: any) {
      console.error('Error viewing document:', error);
      toast({
        title: 'No se puede abrir el documento',
        description: error.message || 'Por favor, inténtalo de nuevo en unos momentos.',
        variant: 'destructive',
      });
    }
  }, [resolveJobDocumentLocation, toast]);

  const handleJobDocumentDownload = useCallback(async (docEntry: JobDocumentEntry) => {
    try {
      const { bucket, path } = resolveJobDocumentLocation(docEntry.file_path);
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const downloadLink = window.document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = docEntry.file_name;
      window.document.body.appendChild(downloadLink);
      downloadLink.click();
      window.document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading document:', error);
      toast({
        title: 'Descarga fallida',
        description: error.message || 'No se pudo descargar ese archivo.',
        variant: 'destructive',
      });
    }
  }, [resolveJobDocumentLocation, toast]);

  const handleRiderView = useCallback(async (file: ArtistRiderFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('festival_artist_files')
        .createSignedUrl(file.file_path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener');
      }
    } catch (error: any) {
      console.error('Error viewing rider:', error);
      toast({
        title: 'No se puede abrir el rider',
        description: error.message || 'Por favor, inténtalo de nuevo más tarde.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleRiderDownload = useCallback(async (file: ArtistRiderFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('festival_artist_files')
        .download(file.file_path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const downloadLink = window.document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = file.file_name;
      window.document.body.appendChild(downloadLink);
      downloadLink.click();
      window.document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading rider:', error);
      toast({
        title: 'Descarga fallida',
        description: error.message || 'No se pudo descargar ese archivo de rider.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleRefreshDocuments = useCallback(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const groupedRiderFiles = useMemo(() => {
    const map = new Map<string, { artistId: string; artistName: string; files: ArtistRiderFile[] }>();
    artistRiderFiles.forEach((file) => {
      const artistId = file.artist_id || file.festival_artists?.id || 'unknown';
      const artistName = file.festival_artists?.name || 'Unknown Artist';
      if (!map.has(artistId)) {
        map.set(artistId, { artistId, artistName, files: [] });
      }
      map.get(artistId)!.files.push(file);
    });

    return Array.from(map.values()).sort((a, b) => a.artistName.localeCompare(b.artistName));
  }, [artistRiderFiles]);

  const formatDateLabel = useCallback((value?: string | null) => {
    if (!value) return 'Unknown date';
    const parsed = new Date(value);
    return isValid(parsed) ? format(parsed, 'MMM d, yyyy') : 'Unknown date';
  }, []);

  const departmentOptions: Department[] = ['sound', 'lights', 'video', 'production', 'logistics', 'administrative', 'personnel', 'comercial'];

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
    setFlexPickerMode('add');
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
    setFlexPickerMode('create');
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
      if (flexPickerMode === 'create') {
        try {
          const { data: existingFolders, error: existingError } = await supabase
            .from('flex_folders')
            .select('id')
            .eq('job_id', jobId)
            .limit(1);

          if (existingError) {
            throw existingError;
          }

          if (existingFolders && existingFolders.length > 0) {
            toast({
              title: 'Las carpetas ya existen',
              description: 'Ya se han creado carpetas Flex para este trabajo.',
            });
            return;
          }
        } catch (error: any) {
          console.error('Error checking existing folders:', error);
          toast({
            title: 'Error al verificar carpetas',
            description: error.message || 'Por favor, inténtalo de nuevo en un momento.',
            variant: 'destructive',
          });
          return;
        }
      }

      if (!job.start_time || !job.end_time) {
        toast({
          title: 'Fechas del trabajo faltantes',
          description: `Actualiza las fechas del trabajo antes de ${flexPickerMode === 'create' ? 'crear' : 'añadir'} carpetas Flex.`,
          variant: 'destructive',
        });
        return;
      }

      const startDate = new Date(job.start_time);
      const endDate = new Date(job.end_time);

      if (!isValid(startDate) || !isValid(endDate)) {
        toast({
          title: 'Fechas del trabajo inválidas',
          description: 'Por favor, verifica las fechas del trabajo antes de crear carpetas Flex.',
          variant: 'destructive',
        });
        return;
      }

      try {
        setIsCreatingFlexFolders(true);

        const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, '');
        const formattedStartDate = startDate.toISOString().split('.')[0] + '.000Z';
        const formattedEndDate = endDate.toISOString().split('.')[0] + '.000Z';

        toast({
          title: flexPickerMode === 'create' ? 'Creando carpetas Flex…' : 'Añadiendo carpetas Flex…',
          description: flexPickerMode === 'create' ? 'Esto puede tardar unos segundos.' : 'Las carpetas seleccionadas se crearán en Flex.',
        });

        await createAllFoldersForJob(
          job,
          formattedStartDate,
          formattedEndDate,
          documentNumber,
          options,
        );

        // Broadcast push notification: Flex folders created for job
        try {
          void supabase.functions.invoke('push', {
            body: { action: 'broadcast', type: 'flex.folders.created', job_id: jobId }
          });
        } catch (pushError) {
          console.error('Error sending push notification:', pushError);
        }

        toast({
          title: flexPickerMode === 'create' ? 'Carpetas Flex listas' : 'Carpetas Flex actualizadas',
          description: flexPickerMode === 'create' ? 'Las carpetas se han creado exitosamente.' : 'Las carpetas seleccionadas se han añadido exitosamente.',
        });

        await Promise.all([
          refetchFlexUuid(),
          fetchJobDetails({ silent: true }),
          fetchDocuments(),
        ]);
      } catch (error: any) {
        console.error('Error adding Flex folders:', error);
        toast({
          title: 'Error al actualizar carpetas Flex',
          description: error.message || 'Por favor, inténtalo de nuevo en un momento.',
          variant: 'destructive',
        });
      } finally {
        setIsCreatingFlexFolders(false);
      }
    },
    [job, jobId, flexPickerMode, toast, refetchFlexUuid, fetchJobDetails, fetchDocuments],
  );

  const flexStatus = useMemo(() => {
    if (isFlexLoading) {
      return { label: 'Verificando estado…', variant: 'outline' as const };
    }
    if (flexError) {
      return { label: 'Error de Flex', variant: 'destructive' as const };
    }
    if (folderExists) {
      return { label: 'Carpetas listas', variant: 'secondary' as const };
    }
    return { label: 'Carpetas no creadas', variant: 'outline' as const };
  }, [isFlexLoading, flexError, folderExists]);

  const isSchedulingRoute = location.pathname.includes('/scheduling');
  const isArtistRoute = location.pathname.includes('/artists');
  const isGearRoute = location.pathname.includes('/gear');
  
  const canEdit = ['admin', 'management', 'logistics'].includes(userRole || '');
  const isViewOnly = userRole === 'technician';

  useEffect(() => {
    fetchJobDetails();

    if (!jobId) {
      return;
    }

    const channel = supabase
      .channel(`job-${jobId}-updates`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: `id=eq.${jobId}`,
      }, () => {
        fetchJobDetails({ silent: true });
        fetchDocuments();
      })
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
        const { data, error } = await supabase.functions.invoke('get-google-maps-key');
        if (error || !data?.apiKey) {
          console.warn('Failed to load Google Maps API key');
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
          : encodeURIComponent(venueData.address || '');

        const markers = venueData.coordinates
          ? `&markers=color:red|label:V|${venueData.coordinates.lat},${venueData.coordinates.lng}`
          : (venueData.address ? `&markers=color:red|label:V|${encodeURIComponent(venueData.address)}` : '');

        const url = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${width}x${height}&scale=${scale}${markers}&key=${encodeURIComponent(apiKey)}`;

        setMapPreviewUrl(url);
      } catch (e: any) {
        console.warn('Failed to load static map preview:', e?.message || e);
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
        result = await generateIndividualStagePDFs(jobId, job?.title || 'Festival', options, maxStages);
      } else {
        console.log("Generating combined PDF");
        result = await generateAndMergeFestivalPDFs(jobId, job?.title || 'Festival', options, filename);
      }
      
      console.log(`Generated file, size: ${result.blob.size} bytes`);
      if (!result.blob || result.blob.size === 0) {
        throw new Error('Generated file is empty');
      }
      
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Éxito",
        description: options.generateIndividualStagePDFs
          ? 'PDFs individuales de escenarios generados exitosamente'
          : 'Documentación generada exitosamente'
      });
    } catch (error: any) {
      console.error('Error generating documentation:', error);
      toast({
        title: "Error",
        description: `Error al generar documentación: ${error.message}`,
        variant: "destructive"
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
  const handleDocumentUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !jobId) return;

    setIsUploadingDocument(true);
    try {
      const filePath = `${jobId}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('job_documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('job_documents')
        .insert({
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
      console.error('Error uploading document:', error);
      toast({
        title: "Error al subir",
        description: error.message || "Error al subir documento",
        variant: "destructive",
      });
    } finally {
      setIsUploadingDocument(false);
      e.target.value = '';
    }
  }, [jobId, toast, fetchDocuments]);

  const handleCreateLocalFolders = useCallback(async () => {
    if (!job) return;

    setIsCreatingLocalFolders(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-local-folders', {
        body: { job_id: job.id }
      });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: data?.message || "Carpetas locales creadas exitosamente",
      });
    } catch (error: any) {
      console.error('Error creating local folders:', error);
      toast({
        title: "Error",
        description: error.message || "Error al crear carpetas locales",
        variant: "destructive",
      });
    } finally {
      setIsCreatingLocalFolders(false);
    }
  }, [job, toast]);

  const handleArchiveToFlex = useCallback(async () => {
    setIsArchiving(true);
    setArchiveError(null);
    setArchiveResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('archive-to-flex', {
        body: {
          job_id: jobId,
          mode: archiveMode,
          include_templates: archiveIncludeTemplates,
          dry_run: archiveDryRun,
        }
      });
      if (error) throw error;
      setArchiveResult(data);
      toast({
        title: archiveDryRun ? 'Prueba completada' : 'Archivo completado',
        description: `${data?.uploaded ?? 0} subidos, ${data?.failed ?? 0} fallidos`,
      });
      if (!archiveDryRun && (data?.uploaded ?? 0) > 0) {
        fetchDocuments();
      }
    } catch (err: any) {
      console.error('Archive error', err);
      setArchiveError(err?.message || 'Failed to archive');
      toast({ title: 'Error al archivar', description: err?.message || 'Error al archivar', variant: 'destructive' });
    } finally {
      setIsArchiving(false);
    }
  }, [jobId, archiveMode, archiveIncludeTemplates, archiveDryRun, toast, fetchDocuments]);

  const handleBackfill = useCallback(async () => {
    setIsBackfilling(true);
    setBackfillMessage(null);
    setBackfillResult(null);
    try {
      const depts: string[] = [];
      if (bfSound) depts.push('sound');
      if (bfLights) depts.push('lights');
      if (bfVideo) depts.push('video');
      if (bfProduction) depts.push('production');
      const body: any = { job_id: jobId };
      if (depts.length) body.departments = depts;
      const manual: Array<{ dept: string; element_id: string }> = [];
      if (uuidSound.trim()) manual.push({ dept: 'sound', element_id: uuidSound.trim() });
      if (uuidLights.trim()) manual.push({ dept: 'lights', element_id: uuidLights.trim() });
      if (uuidVideo.trim()) manual.push({ dept: 'video', element_id: uuidVideo.trim() });
      if (uuidProduction.trim()) manual.push({ dept: 'production', element_id: uuidProduction.trim() });
      if (manual.length) body.manual = manual;
      const { data, error } = await supabase.functions.invoke('backfill-flex-doc-tecnica', { body });
      if (error) throw error;
      setBackfillResult(data);
      setBackfillMessage(`Inserted ${data?.inserted ?? 0}, already ${data?.already ?? 0}`);
      toast({ title: 'Relleno completado', description: `Insertados ${data?.inserted ?? 0}, ya existían ${data?.already ?? 0}` });
    } catch (err: any) {
      console.error('Backfill error', err);
      setBackfillMessage(err?.message || 'Backfill failed');
      toast({ title: 'Error al rellenar', description: err?.message || 'Error al rellenar', variant: 'destructive' });
    } finally {
      setIsBackfilling(false);
    }
  }, [jobId, bfSound, bfLights, bfVideo, bfProduction, uuidSound, uuidLights, uuidVideo, uuidProduction, toast]);

  const handleCreateWhatsappGroup = useCallback(async () => {
    try {
      setIsSendingWa(true);
      const { error } = await supabase.functions.invoke('create-whatsapp-group', {
        body: { job_id: jobId }
      });
      if (error) throw error;
      toast({
        title: "Éxito",
        description: "Grupo de WhatsApp creado exitosamente",
      });
      setIsWhatsappDialogOpen(false);
    } catch (error: any) {
      console.error('Error creating WhatsApp group:', error);
      toast({
        title: "Error",
        description: error.message || "Error al crear grupo de WhatsApp",
        variant: "destructive",
      });
    } finally {
      setIsSendingWa(false);
    }
  }, [jobId, toast]);

  const handleSendToAlmacen = useCallback(async () => {
    try {
      setIsSendingWa(true);
      const defaultMsg = `He hecho cambios en el PS del ${job?.title || 'trabajo'} por favor echad un vistazo`;
      const trimmed = (waMessage || '').trim();
      const finalMsg = trimmed || defaultMsg;
      const isDefault = finalMsg.trim().toLowerCase() === defaultMsg.trim().toLowerCase();
      const { error } = await supabase
        .functions.invoke('send-warehouse-message', { body: { message: finalMsg, job_id: jobId, highlight: isDefault } });
      if (error) {
        toast({ title: 'Error al enviar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Enviado', description: 'Mensaje enviado a Almacén sonido.' });
        setIsAlmacenDialogOpen(false);
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setIsSendingWa(false);
    }
  }, [job?.title, jobId, waMessage, toast]);

  const handleDeleteJob = useCallback(async () => {
    if (!jobId) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Trabajo eliminado exitosamente",
      });

      navigate('/project-management');
    } catch (error: any) {
      console.error('Error deleting job:', error);
      toast({
        title: "Error",
        description: error.message || "Error al eliminar trabajo",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  }, [jobId, toast, navigate]);

  const navigateToCalculator = useCallback((type: 'pesos' | 'consumos') => {
    const params = new URLSearchParams({ jobId: jobId || '' });
    const path = type === 'pesos' ? '/sound/pesos' : '/sound/consumos';
    navigate(`${path}?${params.toString()}`);
  }, [jobId, navigate]);

  if (!jobId) {
    return <div>Se requiere ID del trabajo</div>;
  }

  if (isLoading) {
    return <div>Cargando...</div>;
  }

  if (!job) {
    return <div>Festival no encontrado</div>;
  }

  return (
    <div className="max-w-[1920px] mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6">
      {/* Modern Header Card with Gradient */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-background via-background to-accent/5">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {isSingleJobMode ? (
                    <FileText className="h-6 w-6 md:h-7 md:w-7" />
                  ) : (
                    <Music2 className="h-6 w-6 md:h-7 md:w-7" />
                  )}
                </div>
                <span className="truncate bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {job?.title}
                </span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-muted-foreground">
                <Badge variant="secondary" className="font-normal">
                  {isSingleJobMode ? 'Single Job' : 'Festival'}
                </Badge>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(job?.start_time || '').toLocaleDateString()} - {new Date(job?.end_time || '').toLocaleDateString()}
                </span>
                {venueData.address && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate max-w-xs">{venueData.address}</span>
                    </span>
                  </>
                )}
              </div>

              {/* Venue Map Preview */}
              {(venueData.address || venueData.coordinates) && (
                <div className="mt-3">
                  {isMapLoading ? (
                    <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : mapPreviewUrl ? (
                    <button
                      onClick={() => {
                        const url = venueData.coordinates
                          ? `https://www.google.com/maps/search/?api=1&query=${venueData.coordinates.lat},${venueData.coordinates.lng}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueData.address || '')}`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="w-full rounded-lg overflow-hidden border hover:border-primary transition-all hover:shadow-md group relative"
                    >
                      <img src={mapPreviewUrl} alt="Venue location" className="w-full h-auto" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Abrir en Google Maps
                        </div>
                      </div>
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 items-start">
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 hover:bg-accent/50 transition-all"
                    onClick={handlePrintButtonClick}
                    disabled={isPrinting}
                  >
                    {isPrinting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{isPrinting ? 'Generando...' : 'Imprimir'}</span>
                  </Button>

                  {(folderExists || isFlexLoading) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 hover:bg-accent/50 transition-all"
                      onClick={handleFlexClick}
                      disabled={!flexUuid || isFlexLoading}
                    >
                      {isFlexLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <img src={createFolderIcon} alt="Flex" className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">{isFlexLoading ? 'Cargando...' : 'Flex'}</span>
                    </Button>
                  )}

                  <FestivalLogoManager jobId={jobId} />

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 hover:bg-accent/50 transition-all"
                    onClick={() => setIsJobPresetsOpen(true)}
                  >
                    <Box className="h-4 w-4" />
                    <span className="hidden sm:inline">Presets</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 hover:bg-destructive/10 hover:text-destructive transition-all"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {!isSchedulingRoute && !isArtistRoute && !isGearRoute && (
        <>
          {/* Modern Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
            <Card
              className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 bg-gradient-to-br from-background to-accent/5"
              onClick={() => navigate(`/festival-management/${jobId}/artists`)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base md:text-lg">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                    <Users className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <span className="group-hover:text-primary transition-colors">Artistas</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">{artistCount}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Total de Artistas</p>
                </div>
                <Button className="w-full group-hover:shadow-md transition-shadow" size="sm" onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/festival-management/${jobId}/artists`);
                }}>
                  {isViewOnly ? "Ver Artistas" : "Gestionar Artistas"}
                </Button>
              </CardContent>
            </Card>

            <Card
              className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 bg-gradient-to-br from-background to-accent/5"
              onClick={() => navigate(`/festival-management/${jobId}/gear`)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base md:text-lg">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/20 transition-colors">
                    <Layout className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <span className="group-hover:text-primary transition-colors">Escenarios y Equipo</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs md:text-sm text-muted-foreground min-h-[2.5rem]">
                  Gestiona escenarios y equipo técnico
                </p>
                <Button className="w-full group-hover:shadow-md transition-shadow" size="sm" onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/festival-management/${jobId}/gear`);
                }}>
                  {isViewOnly ? "Ver Equipo" : "Gestionar Equipo"}
                </Button>
              </CardContent>
            </Card>

            <Card
              className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 bg-gradient-to-br from-background to-accent/5"
              onClick={() => navigate(`/festival-management/${jobId}/scheduling`)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base md:text-lg">
                  <div className="p-2 rounded-lg bg-green-500/10 text-green-500 group-hover:bg-green-500/20 transition-colors">
                    <Calendar className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <span className="group-hover:text-primary transition-colors">Planificación</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs md:text-sm text-muted-foreground min-h-[2.5rem]">
                  Gestiona turnos y asignaciones de personal
                </p>
                <Button className="w-full group-hover:shadow-md transition-shadow" size="sm" onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/festival-management/${jobId}/scheduling`);
                }}>
                  {isViewOnly ? "Ver Planificación" : "Gestionar Planificación"}
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <RefreshCw className="h-4 w-4 md:h-5 md:w-5" />
                  Acciones Rápidas
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefreshAll();
                  }}
                  disabled={isLoading || isLoadingDocuments}
                  className="w-full sm:w-auto gap-2"
                >
                  {isLoading || isLoadingDocuments ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Actualizar Datos
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 md:gap-4">
                <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <Users className="h-4 w-4 flex-shrink-0" />
                      Asignaciones
                    </div>
                    <Badge variant="outline" className="text-xs">{humanizeDepartment(assignmentDepartment)}</Badge>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Coordina asignaciones de crew por departamento.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Select value={assignmentDepartment} onValueChange={(value) => setAssignmentDepartment(value as Department)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {humanizeDepartment(dept)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleOpenAssignments}
                      disabled={!job || isAssignmentDialogOpen}
                      size="sm"
                      className="w-full"
                    >
                      Abrir
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3">
                  <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                    <LinkIcon className="h-4 w-4 flex-shrink-0" />
                    Flex Crew Calls
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Vincula los IDs de elementos de crew call de Sonido/Luces.
                  </p>
                  <div className="flex">
                    {jobId && <CrewCallLinkerDialog jobId={jobId} />}
                  </div>
                </div>

                <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3">
                  <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    Timesheets
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Revisa y aprueba las hojas de tiempo del crew para este trabajo.
                  </p>
                  <Button onClick={handleNavigateTimesheets} disabled={!jobId} size="sm" className="w-full">
                    Abrir Hojas de Tiempo
                  </Button>
                </div>

                <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3">
                  <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    Hoja de Ruta
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Genera y revisa la hoja de ruta para este trabajo.
                  </p>
                  <Button onClick={handleOpenRouteSheet} disabled={!jobId} size="sm" className="w-full">
                    Abrir Hoja de Ruta
                  </Button>
                </div>

                <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <FolderPlus className="h-4 w-4 flex-shrink-0" />
                      Flex Folders
                    </div>
                    <Badge variant={flexStatus.variant} className="text-xs">{flexStatus.label}</Badge>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Mantén las carpetas de Flex sincronizadas con los datos de este trabajo.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleCreateFlexFolders}
                      disabled={!canEdit || !job || isCreatingFlexFolders || isFlexLoading}
                      size="sm"
                      className="w-full"
                    >
                      {isCreatingFlexFolders ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creando…
                        </>
                      ) : (
                        'Crear / Verificar'
                      )}
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        onClick={handleOpenFlexPicker}
                        disabled={
                          !canEdit ||
                          !job ||
                          isCreatingFlexFolders ||
                          isFlexLoading ||
                          !folderExists
                        }
                        size="sm"
                      >
                        {isCreatingFlexFolders ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Actualizando…
                          </>
                        ) : (
                          'Añadir'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleOpenFlexLogs}
                        disabled={!canEdit}
                        size="sm"
                      >
                        Ver Registros
                      </Button>
                    </div>
                  </div>
                  {flexError && (
                    <p className="text-xs text-destructive">
                      {flexError}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3">
                  <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    Detalles del Trabajo
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Ve la configuración completa del trabajo y sus metadatos.
                  </p>
                  <Button onClick={handleOpenJobDetails} disabled={!job} size="sm" className="w-full">
                    Ver Detalles del Trabajo
                  </Button>
                </div>

                {/* Create Presupuesto */}
                {canEdit && (
                  <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-green-500/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <DollarSign className="h-4 w-4 flex-shrink-0 text-green-500" />
                      Crear Presupuesto
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Crea un presupuesto con el equipo del escenario seleccionado.
                    </p>
                    <Button
                      onClick={() => setIsPresupuestoDialogOpen(true)}
                      disabled={!job || !folderExists}
                      size="sm"
                      className="w-full"
                    >
                      Crear Presupuesto
                    </Button>
                  </div>
                )}

                {/* Upload Documents */}
                {canEdit && (
                  <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-blue-500/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <Upload className="h-4 w-4 flex-shrink-0 text-blue-500" />
                      Subir Documentos
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Sube documentos de trabajo y archivos técnicos.
                    </p>
                    <div className="relative">
                      <input
                        type="file"
                        onChange={handleDocumentUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={isUploadingDocument}
                      />
                      <Button
                        disabled={isUploadingDocument}
                        size="sm"
                        className="w-full relative"
                      >
                        {isUploadingDocument ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Subiendo...
                          </>
                        ) : (
                          'Elegir Archivo'
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Create Local Folders */}
                {canEdit && (
                  <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-purple-500/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <FolderPlus className="h-4 w-4 flex-shrink-0 text-purple-500" />
                      Carpetas Locales
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Crea estructura de carpetas locales para este trabajo.
                    </p>
                    <Button
                      onClick={handleCreateLocalFolders}
                      disabled={isCreatingLocalFolders}
                      size="sm"
                      className="w-full"
                    >
                      {isCreatingLocalFolders ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        'Crear Carpetas'
                      )}
                    </Button>
                  </div>
                )}

                {/* Archive to Flex */}
                {canEdit && (
                  <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-orange-500/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <Archive className="h-4 w-4 flex-shrink-0 text-orange-500" />
                      Archivar en Flex
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Archiva documentos en Flex Documentación Técnica.
                    </p>
                    <Button
                      onClick={() => setIsArchiveDialogOpen(true)}
                      disabled={isArchiving}
                      size="sm"
                      className="w-full"
                      variant="outline"
                    >
                      {isArchiving ? 'Archivando...' : 'Abrir Archivo'}
                    </Button>
                  </div>
                )}

                {/* Backfill Doc Técnica */}
                {canEdit && (
                  <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-cyan-500/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <RotateCw className="h-4 w-4 flex-shrink-0 text-cyan-500" />
                      Rellenar Doc Técnica
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Encuentra y persiste documentación técnica faltante.
                    </p>
                    <Button
                      onClick={() => setIsBackfillDialogOpen(true)}
                      disabled={isBackfilling}
                      size="sm"
                      className="w-full"
                      variant="outline"
                    >
                      {isBackfilling ? 'Rellenando...' : 'Abrir Relleno'}
                    </Button>
                  </div>
                )}

                {/* WhatsApp Group */}
                {(userRole === 'management' || userRole === 'admin') && (
                  <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-green-500/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <MessageCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
                      Grupo de WhatsApp
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Crea grupo de WhatsApp para coordinación del trabajo.
                    </p>
                    <Button
                      onClick={() => setIsWhatsappDialogOpen(true)}
                      size="sm"
                      className="w-full"
                      variant="outline"
                    >
                      Crear Grupo
                    </Button>
                  </div>
                )}

                {/* Almacén Messaging */}
                {(userRole === 'management' || userRole === 'admin') && (
                  <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-amber-500/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <MessageCircle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                      Almacén Sonido
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Envía mensaje al equipo de almacén.
                    </p>
                    <Button
                      onClick={() => {
                        setWaMessage(`He hecho cambios en el PS del ${job?.title} por favor echad un vistazo`);
                        setIsAlmacenDialogOpen(true);
                      }}
                      size="sm"
                      className="w-full"
                      variant="outline"
                    >
                      Enviar Mensaje
                    </Button>
                  </div>
                )}

                {/* Pesos Calculator */}
                {userRole === 'management' && (
                  <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-indigo-500/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <Scale className="h-4 w-4 flex-shrink-0 text-indigo-500" />
                      Calculadora de Pesos
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Calcula pesos y distribución de carga.
                    </p>
                    <Button
                      onClick={() => navigateToCalculator('pesos')}
                      size="sm"
                      className="w-full"
                      variant="outline"
                    >
                      Abrir Calculadora
                    </Button>
                  </div>
                )}

                {/* Consumos Calculator */}
                {userRole === 'management' && (
                  <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-yellow-500/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <Zap className="h-4 w-4 flex-shrink-0 text-yellow-500" />
                      Calculadora de Consumos
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Calcula consumo y requisitos de energía.
                    </p>
                    <Button
                      onClick={() => navigateToCalculator('consumos')}
                      size="sm"
                      className="w-full"
                      variant="outline"
                    >
                      Abrir Calculadora
                    </Button>
                  </div>
                )}

                {/* Incident Report */}
                {userRole === 'technician' && (
                  <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-red-500/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                      Reporte de Incidencia
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Crea un reporte de incidencia para este trabajo.
                    </p>
                    <TechnicianIncidentReportDialog job={job} techName={userRole} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add Weather Section */}
          <FestivalWeatherSection
            jobId={jobId}
            venue={venueData}
            jobDates={jobDates}
          />

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <FileText className="h-4 w-4 md:h-5 md:w-5" />
                  Documentos y Riders
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefreshDocuments();
                  }}
                  disabled={isLoadingDocuments}
                  className="w-full sm:w-auto"
                >
                  {isLoadingDocuments ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {isLoadingDocuments ? 'Actualizando…' : 'Actualizar'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              {isLoadingDocuments ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando documentos…
                </div>
              ) : (
                <>
                  <div>
                    <h4 className="text-xs md:text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      Documentos del Trabajo
                    </h4>
                    {jobDocuments.length > 0 ? (
                      <div className="space-y-2">
                        {jobDocuments.map((doc) => {
                          const isTemplate = doc.template_type === 'soundvision';
                          const isReadOnly = Boolean(doc.read_only);
                          return (
                            <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border bg-card p-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-xs md:text-sm font-medium text-foreground flex flex-wrap items-center gap-2">
                                  <span className="truncate">{doc.file_name}</span>
                                  {isTemplate && (
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide flex-shrink-0">
                                      Template SoundVision File
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Uploaded {formatDateLabel(doc.uploaded_at)}
                                  {isReadOnly && <span className="ml-2 italic">Read-only</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 sm:flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleJobDocumentView(doc);
                                  }}
                                  title="View"
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleJobDocumentDownload(doc);
                                  }}
                                  title="Download"
                                  className="h-8 w-8 p-0"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs md:text-sm text-muted-foreground">
                        Aún no se han subido documentos del trabajo.
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs md:text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 flex-shrink-0" />
                      Riders de Artistas
                    </h4>
                    {groupedRiderFiles.length > 0 ? (
                      <div className="space-y-4">
                        {groupedRiderFiles.map((artist) => (
                          <div key={artist.artistId} className="space-y-2">
                            <div className="text-xs md:text-sm font-medium text-foreground">{artist.artistName}</div>
                            <div className="space-y-2">
                              {artist.files.map((file) => (
                                <div key={file.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border bg-accent/20 p-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs md:text-sm font-medium text-foreground truncate">{file.file_name}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Uploaded {formatDateLabel(file.created_at)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 sm:flex-shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRiderView(file);
                                      }}
                                      title="View"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRiderDownload(file);
                                      }}
                                      title="Download"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs md:text-sm text-muted-foreground">
                        Aún no se han subido riders de artistas. Los riders añadidos a través de la tabla de artistas aparecerán aquí automáticamente.
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
      
      {job && (
        <JobAssignmentDialog
          isOpen={isAssignmentDialogOpen}
          onClose={() => setIsAssignmentDialogOpen(false)}
          onAssignmentChange={handleAssignmentChange}
          jobId={job.id}
          department={assignmentDepartment}
        />
      )}

      {job && (
        <JobDetailsDialog
          open={isJobDetailsOpen}
          onOpenChange={setIsJobDetailsOpen}
          job={job}
          department={assignmentDepartment}
        />
      )}

      {jobId && (
        <CreatePresupuestoDialog
          open={isPresupuestoDialogOpen}
          onOpenChange={setIsPresupuestoDialogOpen}
          jobId={jobId}
        />
      )}

      {jobId && (
        <FlexSyncLogDialog
          jobId={jobId}
          open={isFlexLogOpen}
          onOpenChange={setIsFlexLogOpen}
        />
      )}

      <FlexFolderPicker
        open={isFlexPickerOpen}
        onOpenChange={setIsFlexPickerOpen}
        onConfirm={handleFlexPickerConfirm}
        initialOptions={flexPickerOptions}
      />

      <Dialog open={isRouteSheetOpen} onOpenChange={setIsRouteSheetOpen}>
        <DialogContent className="max-w-[96vw] w-[96vw] max-h-[90vh] md:h-[90vh] p-0 overflow-hidden flex flex-col">
          <div className="h-full overflow-auto">
            {jobId && <ModernHojaDeRuta jobId={jobId} />}
          </div>
        </DialogContent>
      </Dialog>

      {isSchedulingRoute && (
        <div>
          <div className="mb-4">
            <Button
              variant="outline"
              onClick={() => navigate(`/festival-management/${jobId}`)}
              className="flex items-center gap-1"
            >
              Volver al Festival
            </Button>
          </div>
          
          {jobDates.length > 0 ? (
            <FestivalScheduling jobId={jobId} jobDates={jobDates} isViewOnly={isViewOnly} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-4">No hay fechas disponibles para planificación. Por favor, actualiza primero las fechas del festival.</p>
                <Button onClick={() => navigate(`/festival-management/${jobId}`)}>
                  Volver
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {isPrintDialogOpen && (
        <PrintOptionsDialog
          open={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          onConfirm={handlePrintAllDocumentation}
          maxStages={maxStages}
          jobTitle={job?.title || ''}
          jobId={jobId}
        />
      )}

      {/* Job Presets Manager */}
      {jobId && (
        <JobPresetManagerDialog
          open={isJobPresetsOpen}
          onOpenChange={setIsJobPresetsOpen}
          jobId={jobId}
        />
      )}

      {/* Archive to Flex Dialog */}
      <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Archivar documentos en Flex</DialogTitle>
            <DialogDescription>
              Sube todos los documentos del trabajo a la Documentación Técnica de cada departamento en Flex y los elimina de Supabase.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Modo</label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={archiveMode}
                  onChange={(e) => setArchiveMode(e.target.value as 'by-prefix' | 'all-tech')}
                >
                  <option value="by-prefix">Por prefijo (predeterminado)</option>
                  <option value="all-tech">Todos los depts. técnicos</option>
                </select>
              </div>
              <div className="flex items-center gap-2 mt-6 sm:mt-[30px]">
                <input
                  id="includeTemplates"
                  type="checkbox"
                  checked={archiveIncludeTemplates}
                  onChange={(e) => setArchiveIncludeTemplates(e.target.checked)}
                />
                <label htmlFor="includeTemplates" className="text-sm">Incluir templates</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="dryRun"
                  type="checkbox"
                  checked={archiveDryRun}
                  onChange={(e) => setArchiveDryRun(e.target.checked)}
                />
                <label htmlFor="dryRun" className="text-sm">Prueba (sin eliminar)</label>
              </div>
            </div>

            {isArchiving && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Archivando...
              </div>
            )}

            {archiveError && (
              <div className="text-sm text-red-600">{archiveError}</div>
            )}

            {archiveResult && (
              <div className="space-y-3">
                <div className="text-sm">Resumen</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Intentados: <span className="font-medium">{archiveResult.attempted ?? 0}</span></div>
                  <div>Subidos: <span className="font-medium">{archiveResult.uploaded ?? 0}</span></div>
                  <div>Omitidos: <span className="font-medium">{archiveResult.skipped ?? 0}</span></div>
                  <div>Fallidos: <span className="font-medium">{archiveResult.failed ?? 0}</span></div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)} disabled={isArchiving}>
              Cerrar
            </Button>
            <Button onClick={handleArchiveToFlex} disabled={isArchiving}>
              {isArchiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {archiveDryRun ? 'Ejecutar Prueba' : 'Iniciar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backfill Dialog */}
      <Dialog open={isBackfillDialogOpen} onOpenChange={setIsBackfillDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rellenar Documentación Técnica</DialogTitle>
            <DialogDescription>
              Encuentra y persiste elementos de Documentación Técnica faltantes para este trabajo, permitiendo que el archivado los localice de forma fiable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bfSound} onChange={(e) => setBfSound(e.target.checked)} /> Sonido
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bfLights} onChange={(e) => setBfLights(e.target.checked)} /> Luces
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bfVideo} onChange={(e) => setBfVideo(e.target.checked)} /> Video
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bfProduction} onChange={(e) => setBfProduction(e.target.checked)} /> Producción
              </label>
            </div>
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">UUIDs manuales (opcional)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs">UUID Sonido</label>
                  <input
                    className="w-full h-8 rounded border px-2 text-xs"
                    value={uuidSound}
                    onChange={(e) => setUuidSound(e.target.value)}
                    placeholder="pegar elementId"
                  />
                </div>
                <div>
                  <label className="text-xs">UUID Luces</label>
                  <input
                    className="w-full h-8 rounded border px-2 text-xs"
                    value={uuidLights}
                    onChange={(e) => setUuidLights(e.target.value)}
                    placeholder="pegar elementId"
                  />
                </div>
                <div>
                  <label className="text-xs">UUID Video</label>
                  <input
                    className="w-full h-8 rounded border px-2 text-xs"
                    value={uuidVideo}
                    onChange={(e) => setUuidVideo(e.target.value)}
                    placeholder="pegar elementId"
                  />
                </div>
                <div>
                  <label className="text-xs">UUID Producción</label>
                  <input
                    className="w-full h-8 rounded border px-2 text-xs"
                    value={uuidProduction}
                    onChange={(e) => setUuidProduction(e.target.value)}
                    placeholder="pegar elementId"
                  />
                </div>
              </div>
            </div>

            {isBackfilling && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Rellenando…
              </div>
            )}
            {backfillMessage && <div className="text-muted-foreground">{backfillMessage}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBackfillDialogOpen(false)} disabled={isBackfilling}>
              Cerrar
            </Button>
            <Button onClick={handleBackfill} disabled={isBackfilling}>
              {isBackfilling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Group Dialog */}
      <Dialog open={isWhatsappDialogOpen} onOpenChange={setIsWhatsappDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Grupo de WhatsApp</DialogTitle>
            <DialogDescription>
              Crea un grupo de WhatsApp para coordinar este trabajo con tu equipo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Se creará un grupo de WhatsApp con el título del trabajo: <span className="font-semibold">{job?.title}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWhatsappDialogOpen(false)} disabled={isSendingWa}>
              Cancelar
            </Button>
            <Button onClick={handleCreateWhatsappGroup} disabled={isSendingWa}>
              {isSendingWa ? 'Creando...' : 'Crear Grupo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Almacén Messaging Dialog */}
      <Dialog open={isAlmacenDialogOpen} onOpenChange={setIsAlmacenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar a Almacén sonido</DialogTitle>
            <DialogDescription>
              Este mensaje se enviará al grupo de WhatsApp "Almacén sonido" desde tu endpoint WAHA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mensaje</label>
            <Textarea
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              placeholder="Escribe tu mensaje…"
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAlmacenDialogOpen(false)} disabled={isSendingWa}>
              Cancelar
            </Button>
            <Button onClick={handleSendToAlmacen} disabled={isSendingWa}>
              {isSendingWa ? 'Enviando…' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Job Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Trabajo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar este trabajo? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              Trabajo: <span className="font-semibold">{job?.title}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteJob} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FestivalManagement;
