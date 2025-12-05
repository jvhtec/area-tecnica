import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MapPin,
  Users,
  FileText,
  UtensilsCrossed,
  Truck,
  Clock,
  Phone,
  Globe,
  Download,
  Eye,
  ExternalLink,
  Calendar,
  AlertTriangle,
  CloudIcon,
  RefreshCw,
  Loader2,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlacesRestaurantService } from "@/utils/hoja-de-ruta/services/places-restaurant-service";
import type { Restaurant, WeatherData } from "@/types/hoja-de-ruta";
import { labelForCode } from '@/utils/roles';
import { useWeatherData } from '@/hooks/useWeatherData';
import { TourRatesPanel } from '@/components/tours/TourRatesPanel';
import { JobExtrasManagement } from '@/components/jobs/JobExtrasManagement';
import { JobPayoutTotalsPanel } from '@/components/jobs/JobPayoutTotalsPanel';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useTourRateSubscriptions } from "@/hooks/useTourRateSubscriptions";
import { useJobExtras } from '@/hooks/useJobExtras';
import { useJobRatesApproval } from '@/hooks/useJobRatesApproval';
import { useJobApprovalStatus } from '@/hooks/useJobApprovalStatus';
import { toast } from 'sonner';
import { syncFlexWorkOrdersForJob } from '@/services/flexWorkOrders';
import { resolveJobDocLocation } from '@/utils/jobDocuments';
import { mergePDFs } from '@/utils/pdf/pdfMerge';
import { generateTimesheetPDF } from '@/utils/timesheet-pdf';
import { generateJobPayoutPDF, generateRateQuotePDF } from '@/utils/rates-pdf-export';
import { sendJobPayoutEmails } from '@/lib/job-payout-email';

interface TechnicianProfile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  department?: string | null;
  autonomo?: boolean | null;
}

type SupabaseClientLike = typeof supabase;

export const enrichTimesheetsWithProfiles = async (
  client: SupabaseClientLike,
  timesheets: any[]
): Promise<{ timesheets: any[]; profileMap: Map<string, TechnicianProfile> }> => {
  const profileMap = new Map<string, TechnicianProfile>();
  const technicianIds = Array.from(
    new Set(
      (timesheets || [])
        .map((row) => row.technician_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );

  if (!technicianIds.length) {
    return { timesheets, profileMap };
  }

  const { data: profiles, error } = await client
    .from('profiles')
    .select('id, first_name, last_name, department, autonomo')
    .in('id', technicianIds);

  if (error) {
    console.error('[JobDetailsDialog] Failed to load technician profiles for timesheets', error);
    return { timesheets, profileMap };
  }

  (profiles || []).forEach((profile: TechnicianProfile) => {
    if (profile?.id) {
      profileMap.set(profile.id, profile);
    }
  });

  const enrichedTimesheets = timesheets.map((row) => {
    const fallbackProfile = profileMap.get(row.technician_id);
    if (!fallbackProfile) {
      return row;
    }

    const mergedTechnician = row.technician
      ? { ...fallbackProfile, ...row.technician }
      : fallbackProfile;

    return {
      ...row,
      technician: mergedTechnician,
    };
  });

  return { timesheets: enrichedTimesheets, profileMap };
};

interface JobDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: any;
  department?: string;
}

export const JobDetailsDialog: React.FC<JobDetailsDialogProps> = ({
  open,
  onOpenChange,
  job,
  department = 'sound'
}) => {
  const [selectedTab, setSelectedTab] = useState('info');
  const { userRole, user } = useOptimizedAuth();
  const isManager = ['admin', 'management'].includes(userRole || '');
  const isTechnicianRole = ['technician', 'house_tech'].includes(userRole || '');
  const isHouseTech = userRole === 'house_tech';
  const queryClient = useQueryClient();
  const [isSendingPayoutEmails, setIsSendingPayoutEmails] = useState(false);
  const triggerPayoutEmails = React.useCallback(
    async (jobId: string) => {
      if (!jobId || isSendingPayoutEmails) return;
      setIsSendingPayoutEmails(true);
      try {
        const result = await sendJobPayoutEmails({ jobId, supabase });

        if (result.error) {
          console.error('[JobDetailsDialog] Error sending payout emails', result.error);
          toast.error('No se pudieron enviar los correos de pagos');
        } else {
          const partialFailures = Array.isArray(result.response?.results)
            ? (result.response.results as Array<{ sent: boolean }>).some((r) => !r.sent)
            : false;

          if (result.success && !partialFailures) {
            toast.success('Pagos enviados por correo');
          } else {
            toast.warning('Algunos correos no se pudieron enviar. Revisa el registro.');
          }

          if (result.missingEmails.length) {
            toast.warning('Hay técnicos sin correo configurado.');
          }
        }
      } catch (err) {
        console.error('[JobDetailsDialog] Unexpected error sending payout emails', err);
        toast.error('Se produjo un error al enviar los correos de pagos');
      } finally {
        setIsSendingPayoutEmails(false);
      }
    },
    [isSendingPayoutEmails, supabase]
  );

  // Fetch comprehensive job data
  const { data: jobDetails, isLoading: isJobLoading, error: jobDocumentsError } = useQuery({
    queryKey: ['job-details', job.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          locations(id, name, formatted_address, latitude, longitude),
          job_assignments(
            job_id, technician_id, assigned_by, assigned_at,
            sound_role, lights_role, video_role, status,
            single_day, assignment_date,
            profiles(id, first_name, last_name, department, role)
          ),
          timesheets(technician_id, date),
          job_documents(id, file_name, file_path, uploaded_at, file_size, visible_to_tech, read_only, template_type),
          logistics_events(id, event_type, transport_type, event_date, event_time, license_plate)
        `)
        .eq('id', job.id)
        .single();

      if (error) throw error;
      console.log('JobDetailsDialog: Full job data loaded:', JSON.stringify(data, null, 2));
      console.log('JobDetailsDialog: Location data:', data?.locations);
      console.log('JobDetailsDialog: Job assignments:', data?.job_assignments?.length || 0);
      console.log('JobDetailsDialog: Job documents:', data?.job_documents?.length || 0);
      return data;
    },
    enabled: open
  });

  // Artist list for job (to avoid join issues under RLS)
  const { data: jobArtists = [] } = useQuery({
    queryKey: ['job-artists', job.id],
    enabled: open && !!job?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('festival_artists')
        .select('id, name')
        .eq('job_id', job.id);
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string }>;
    }
  });

  const artistIdList = React.useMemo(() => jobArtists.map(a => a.id), [jobArtists]);
  const artistNameMap = React.useMemo(() => new Map(jobArtists.map(a => [a.id, a.name])), [jobArtists]);

  // Extras setup and visibility
  const resolvedJobId = (jobDetails?.id as string) || job.id;
  const { data: jobExtras = [] } = useJobExtras(resolvedJobId);
  const { data: jobRatesApproval } = useJobRatesApproval(resolvedJobId);
  const jobRatesApproved = jobRatesApproval?.rates_approved ?? !!jobDetails?.rates_approved;
  const { data: approvalStatus, isLoading: approvalStatusLoading } = useJobApprovalStatus(resolvedJobId);
  const isDryhire = (jobDetails?.job_type || job?.job_type) === 'dryhire';
  console.log('JobDetailsDialog: isDryhire =', isDryhire, 'job_type =', jobDetails?.job_type || job?.job_type);
  const showExtrasTab = !isDryhire && (isManager || isHouseTech || (jobRatesApproved && jobExtras.length > 0));
  const canSeeRateTabs = (isManager || jobRatesApproved) && !isHouseTech;
  const showTourRatesTab = !isDryhire
    && jobDetails?.job_type === 'tourdate'
    && canSeeRateTabs;
  const resolvedDocuments = jobDetails?.job_documents || job?.job_documents || [];
  const documentsLoading = isJobLoading;
  const normalizedDepartment = department?.toLowerCase?.() ?? null;
  const filteredAssignments = React.useMemo(() => {
    const assignments = jobDetails?.job_assignments ?? [];
    if (!normalizedDepartment) {
      return assignments;
    }
    return assignments.filter((assignment: any) => {
      const profileDept = assignment.profiles?.department?.toLowerCase?.();
      if (profileDept === normalizedDepartment) {
        return true;
      }
      if (normalizedDepartment === 'sound' && assignment.sound_role) {
        return true;
      }
      if (normalizedDepartment === 'lights' && assignment.lights_role) {
        return true;
      }
      if (normalizedDepartment === 'video' && assignment.video_role) {
        return true;
      }
      return false;
    });
  }, [jobDetails?.job_assignments, normalizedDepartment]);

  const technicianDatesMap = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (jobDetails?.timesheets) {
      jobDetails.timesheets.forEach((t: any) => {
        if (t.technician_id && t.date) {
          if (!map.has(t.technician_id)) {
            map.set(t.technician_id, new Set());
          }
          map.get(t.technician_id)?.add(t.date);
        }
      });
    }
    return map;
  }, [jobDetails?.timesheets]);

  // Flex Work Orders progress (manager-only)
  const [isSyncingWorkOrders, setIsSyncingWorkOrders] = useState(false);
  const { data: workOrdersFolder } = useQuery({
    queryKey: ['flex-workorders-folder', resolvedJobId, jobDetails?.job_type, jobDetails?.tour_date_id],
    enabled: open && isManager && !!resolvedJobId,
    queryFn: async () => {
      const criteria: any = { folder_type: 'work_orders', department: 'personnel' };
      if ((jobDetails?.job_type || job?.job_type) === 'tourdate') {
        criteria.tour_date_id = jobDetails?.tour_date_id || job?.tour_date_id;
      } else {
        criteria.job_id = resolvedJobId;
      }
      const { data, error } = await supabase
        .from('flex_folders')
        .select('element_id')
        .match(criteria)
        .maybeSingle();
      if (error) return null;
      return data || null;
    }
  });

  const { data: existingWorkOrders = [] } = useQuery({
    queryKey: ['flex-workorders-rows', resolvedJobId],
    enabled: open && isManager && !!resolvedJobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flex_work_orders')
        .select(`
          technician_id,
          flex_element_id,
          flex_document_id,
          folder_element_id,
          flex_vendor_id,
          lpo_number,
          profiles:profiles!flex_work_orders_technician_id_fkey(first_name,last_name)
        `)
        .eq('job_id', resolvedJobId);
      if (error) return [];
      return (data || []) as Array<any>;
    }
  });

  const desiredTechCount = React.useMemo(() => {
    const assignments = jobDetails?.job_assignments || [];
    return assignments.filter((a: any) => a && a.status !== 'declined').length;
  }, [jobDetails?.job_assignments]);
  const existingWOCount = existingWorkOrders.length;

  const copyToClipboard = async (value: string | undefined | null) => {
    try {
      if (!value) return;
      await navigator.clipboard.writeText(value);
      toast.success('Copiado al portapapeles');
    } catch (_) {
      toast.error('No se pudo copiar');
    }
  };

  useEffect(() => {
    if (!showTourRatesTab && selectedTab === 'tour-rates') {
      setSelectedTab('info');
    }
    if (!showExtrasTab && selectedTab === 'extras') {
      setSelectedTab('info');
    }
  }, [showTourRatesTab, showExtrasTab, selectedTab]);

  // Reset selectedTab to 'info' when dialog opens OR when job changes
  // This prevents showing stale/empty tabs when switching between jobs
  const [lastOpenState, setLastOpenState] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  useEffect(() => {
    const jobIdChanged = job.id !== lastJobId;
    const dialogOpening = open && !lastOpenState;

    if (dialogOpening || (open && jobIdChanged)) {
      // Dialog is opening OR job changed while dialog is open - reset to info tab
      console.log('JobDetailsDialog: Resetting to info tab', { dialogOpening, jobIdChanged, jobId: job.id });
      setSelectedTab('info');
      setLastJobId(job.id);
    }
    setLastOpenState(open);
  }, [open, lastOpenState, job.id, lastJobId]);

  // Log tab changes for debugging
  useEffect(() => {
    console.log('JobDetailsDialog: selectedTab changed to:', selectedTab);
  }, [selectedTab]);

  // Invalidate all job-related queries when job changes to ensure fresh data
  useEffect(() => {
    if (open && job.id) {
      console.log('JobDetailsDialog: Job changed, invalidating queries for job', job.id);
      queryClient.invalidateQueries({ queryKey: ['job-details', job.id] });
      queryClient.invalidateQueries({ queryKey: ['job-artists', job.id] });
      queryClient.invalidateQueries({ queryKey: ['job-restaurants', job.id] });
      queryClient.invalidateQueries({ queryKey: ['job-rider-files', job.id] });
    }
  }, [job.id, open, queryClient]);

  // Reset selectedTab if user is on a dryhire-excluded tab when isDryhire is true
  // This runs AFTER the dialog has opened and should handle job type changes
  useEffect(() => {
    if (open && isDryhire && ['location', 'personnel', 'documents', 'restaurants', 'weather', 'extras'].includes(selectedTab)) {
      console.log('JobDetailsDialog: Dryhire job detected, resetting from', selectedTab, 'to info');
      setSelectedTab('info');
    }
  }, [open, isDryhire, selectedTab]);

  // Rider files for the artists of this job (2-step to be RLS-friendly)
  const { data: riderFiles = [], isLoading: isRidersLoading } = useQuery({
    queryKey: ['job-rider-files', job.id, artistIdList],
    enabled: open && !!job?.id && artistIdList.length > 0,
    queryFn: async () => {
      let query = supabase
        .from('festival_artist_files')
        .select('id, file_name, file_path, uploaded_at, artist_id')
        .order('uploaded_at', { ascending: false });
      if (artistIdList.length === 1) {
        query = query.eq('artist_id', artistIdList[0]);
      } else {
        const orExpr = artistIdList.map((id) => `artist_id.eq.${id}`).join(',');
        query = query.or(orExpr);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Array<{ id: string; file_name: string; file_path: string; uploaded_at: string; artist_id: string }>;
    }
  });

  const viewRider = async (file: { file_path: string }) => {
    const { data, error } = await supabase.storage
      .from('festival_artist_files')
      .createSignedUrl(file.file_path, 3600);
    if (error) throw error;
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  };

  const downloadRider = async (file: { file_path: string; file_name: string }) => {
    const { data, error } = await supabase.storage
      .from('festival_artist_files')
      .download(file.file_path);
    if (error) throw error;
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Fetch nearby restaurants
  const { data: restaurants = [], isLoading: isRestaurantsLoading } = useQuery({
    queryKey: ['job-restaurants', job.id, jobDetails?.locations?.formatted_address],
    queryFn: async () => {
      const locationData = jobDetails?.locations;
      const address = locationData?.formatted_address || locationData?.name;

      console.log('Restaurant query - location data:', locationData);
      console.log('Restaurant query - using address:', address);

      if (!address && !locationData?.latitude) {
        console.log('Restaurant query - no address or coordinates found, returning empty array');
        return [];
      }

      const coordinates = locationData?.latitude && locationData?.longitude
        ? { lat: Number(locationData.latitude), lng: Number(locationData.longitude) }
        : undefined;

      console.log('Restaurant query - coordinates:', coordinates);

      // If we have coordinates but no address, we can still search
      if (!address && coordinates) {
        console.log('Restaurant query - using coordinates only');
      }

      return await PlacesRestaurantService.searchRestaurantsNearVenue(
        address || `${coordinates?.lat},${coordinates?.lng}`,
        2000,
        10,
        coordinates
      );
    },
    // Wait for jobDetails to load before running this query
    enabled: open && !isJobLoading && !!jobDetails?.locations && (!!jobDetails?.locations?.formatted_address || !!jobDetails?.locations?.name || (!!jobDetails?.locations?.latitude && !!jobDetails?.locations?.longitude))
  });

  // Weather data for job dates
  const [weatherData, setWeatherData] = useState<WeatherData[] | undefined>(undefined);

  // Format event dates for weather API
  const eventDatesString = jobDetails?.start_time && jobDetails?.end_time
    ? new Date(jobDetails.start_time).toLocaleDateString('en-GB').split('/').join('/') +
    (new Date(jobDetails.start_time).toDateString() !== new Date(jobDetails.end_time).toDateString()
      ? ' - ' + new Date(jobDetails.end_time).toLocaleDateString('en-GB').split('/').join('/')
      : '')
    : '';

  const weatherVenue = {
    address: jobDetails?.locations?.formatted_address || jobDetails?.locations?.name,
    coordinates: jobDetails?.locations?.latitude && jobDetails?.locations?.longitude
      ? {
        lat: typeof jobDetails.locations.latitude === 'number'
          ? jobDetails.locations.latitude
          : parseFloat(jobDetails.locations.latitude),
        lng: typeof jobDetails.locations.longitude === 'number'
          ? jobDetails.locations.longitude
          : parseFloat(jobDetails.locations.longitude)
      }
      : undefined
  };

  const { isLoading: isWeatherLoading, error: weatherError, fetchWeather } = useWeatherData({
    venue: weatherVenue,
    eventDates: eventDatesString,
    onWeatherUpdate: setWeatherData
  });

  // Set up tour rates subscriptions for real-time updates
  useTourRateSubscriptions();

  // Static map preview via Google Static Maps (key fetched via Edge Function secret)
  const [googleStaticKey, setGoogleStaticKey] = useState<string | null>(null);
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState<boolean>(false);
  useEffect(() => {
    const loadStaticMap = async () => {
      try {
        if (!open) return;
        const loc = jobDetails?.locations;
        if (!loc) {
          setMapPreviewUrl(null);
          return;
        }
        const lat = typeof loc.latitude === 'number' ? loc.latitude : (typeof loc.latitude === 'string' ? parseFloat(loc.latitude) : undefined);
        const lng = typeof loc.longitude === 'number' ? loc.longitude : (typeof loc.longitude === 'string' ? parseFloat(loc.longitude) : undefined);
        const address = loc.formatted_address || (loc as any).address || loc.name || '';

        setIsMapLoading(true);

        // Ensure we have an API key (fetch from secrets if needed)
        let apiKey = googleStaticKey;
        if (!apiKey) {
          const { data, error } = await supabase.functions.invoke('get-google-maps-key');
          if (error || !data?.apiKey) {
            setMapPreviewUrl(null);
            setIsMapLoading(false);
            return;
          }
          apiKey = data.apiKey as string;
          setGoogleStaticKey(apiKey);
        }

        const zoom = 15;
        const width = 600;
        const height = 300;
        const scale = 2;
        const center = Number.isFinite(lat) && Number.isFinite(lng)
          ? `${lat},${lng}`
          : encodeURIComponent(address);
        const markers = Number.isFinite(lat) && Number.isFinite(lng)
          ? `&markers=color:red|label:A|${lat},${lng}`
          : (address ? `&markers=color:red|label:A|${encodeURIComponent(address)}` : '');
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
  }, [open, jobDetails]);

  const handleDownloadDocument = async (doc: any) => {
    try {
      const { bucket, path } = resolveJobDocLocation(doc.file_path);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = doc.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Descargando documento');
      } else {
        throw new Error('No se pudo generar el enlace de descarga');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error(`Error al descargar el documento: ${(error as Error).message || 'Error desconocido'}`);
    }
  };

  const handleViewDocument = async (doc: any) => {
    try {
      const { bucket, path } = resolveJobDocLocation(doc.file_path);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener');
      } else {
        throw new Error('No se pudo generar el enlace de visualización');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error(`Error al visualizar el documento: ${(error as Error).message || 'Error desconocido'}`);
    }
  };

  const openGoogleMaps = () => {
    if (jobDetails?.locations) {
      const address = encodeURIComponent(jobDetails.locations.formatted_address || jobDetails.locations.name || '');
      window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
    }
  };

  const formatDateTime = (dateTime: string | null | undefined) => {
    if (!dateTime) return 'Sin definir';
    try {
      const date = new Date(dateTime);
      if (isNaN(date.getTime())) return 'Fecha no válida';
      return format(date, 'PPPp', { locale: es });
    } catch (error) {
      return 'Fecha no válida';
    }
  };

  if (isJobLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col overflow-y-auto">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Calculate grid columns based on visible tabs
  // Base tabs: Info (1)
  // Conditional tabs: Location, Personnel, Documents, Restaurants, Weather (5) - hidden if dryhire
  // Optional tabs: Tour Rates, Extras
  const gridColsClass = isDryhire
    ? 'grid-cols-1' // Only Info tab for dryhire
    : showExtrasTab
      ? (showTourRatesTab ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-8' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-7')
      : (showTourRatesTab ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-7' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6');

  const showPendingRatesNotice = !isDryhire
    && jobDetails?.job_type === 'tourdate'
    && !isManager
    && isTechnicianRole
    && !jobRatesApproved;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] sm:w-[96vw] max-w-[1200px] xl:max-w-[1400px] max-h-[92vh] flex flex-col overflow-y-auto overflow-x-hidden px-3 sm:px-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
            <Calendar className="h-4 w-4 md:h-5 md:w-5" />
            <span className="truncate">{jobDetails?.title || 'Detalles del trabajo'}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Scroll wrapper to ensure the dialog always scrolls regardless of layout */}
        <div className="min-h-0 overflow-y-auto overflow-x-hidden max-h-[75vh]">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex flex-col min-w-0">
            <TabsList className={`grid w-full ${gridColsClass} flex-shrink-0 h-auto text-xs md:text-sm overflow-x-auto no-scrollbar`}>
              <TabsTrigger value="info" className="py-2">Información</TabsTrigger>
              {!isDryhire && <TabsTrigger value="location" className="py-2">Ubicación</TabsTrigger>}
              {!isDryhire && <TabsTrigger value="personnel" className="py-2">Personal</TabsTrigger>}
              {!isDryhire && <TabsTrigger value="documents" className="py-2">Documentos</TabsTrigger>}
              {!isDryhire && <TabsTrigger value="restaurants" className="py-2">Restaurantes</TabsTrigger>}
              {!isDryhire && <TabsTrigger value="weather" className="py-2">Clima</TabsTrigger>}
              {showTourRatesTab && (
                <TabsTrigger value="tour-rates" className="py-2">Tarifas</TabsTrigger>
              )}
              {!isDryhire && showExtrasTab && <TabsTrigger value="extras" className="py-2">Extras</TabsTrigger>}
            </TabsList>

            <div className="mt-3 md:mt-4 px-1 pr-1 min-w-0 overflow-x-hidden">
              <TabsContent value="info" className="space-y-4 min-w-0 overflow-x-hidden">
                <Card className="p-4 w-full min-w-0 overflow-hidden">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-lg">{jobDetails?.title}</h3>
                      {jobDetails?.description && (
                        <p className="text-muted-foreground mt-1">{jobDetails.description}</p>
                      )}
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Hora de inicio</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(jobDetails?.start_time)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Hora de finalización</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(jobDetails?.end_time)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Tipo de trabajo</p>
                      <Badge variant="outline">{jobDetails?.job_type}</Badge>
                    </div>

                    {isManager && !isDryhire && (
                      <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Badge variant={jobRatesApproved ? 'default' : 'secondary'}>
                            {jobRatesApproved ? 'Tarifas aprobadas' : 'Aprobación necesaria'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Controla la visibilidad de los pagos por trabajo para los técnicos</span>
                        </div>
                        <div>
                          {jobRatesApproved ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (!resolvedJobId) return;
                                await supabase
                                  .from('jobs')
                                  .update({ rates_approved: false, rates_approved_at: null, rates_approved_by: null } as any)
                                  .eq('id', resolvedJobId);
                                queryClient.invalidateQueries({ queryKey: ['job-details', resolvedJobId] });
                                queryClient.invalidateQueries({ queryKey: ['job-rates-approval', resolvedJobId] });
                                queryClient.invalidateQueries({ queryKey: ['job-rates-approval-map'] });
                                queryClient.invalidateQueries({ queryKey: ['job-approval-status', resolvedJobId] });
                              }}
                            >
                              Revocar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              disabled={!approvalStatusLoading && !!approvalStatus && !approvalStatus.canApprove}
                              onClick={async () => {
                                if (!resolvedJobId) return;
                                if (approvalStatus && !approvalStatus.canApprove) {
                                  const reasons = approvalStatus.blockingReasons.join(', ');
                                  toast.error(reasons ? `No se puede aprobar: ${reasons}` : 'No se puede aprobar mientras haya elementos pendientes');
                                  return;
                                }
                                let approvalSucceeded = false;
                                try {
                                  const { data: u } = await supabase.auth.getUser();
                                  const { error: approvalError } = await supabase
                                    .from('jobs')
                                    .update({
                                      rates_approved: true,
                                      rates_approved_at: new Date().toISOString(),
                                      rates_approved_by: u?.user?.id || null,
                                    } as any)
                                    .eq('id', resolvedJobId);

                                  if (approvalError) throw approvalError;
                                  approvalSucceeded = true;

                                  try {
                                    const result = await syncFlexWorkOrdersForJob(resolvedJobId);
                                    if (result.created > 0) {
                                      toast.success(`Órdenes de trabajo creadas en Flex: ${result.created}`);
                                    }
                                    result.errors.forEach((message) => toast.error(message));
                                  } catch (flexError) {
                                    console.error('[JobDetailsDialog] Flex work-order sync failed', flexError);
                                    toast.error(
                                      `No se pudieron generar las órdenes de trabajo en Flex: ${(flexError as Error).message}`
                                    );
                                  }
                                } catch (err) {
                                  console.error('[JobDetailsDialog] Job rates approval failed', err);
                                  toast.error('No se pudieron aprobar las tarifas del trabajo.');
                                } finally {
                                  queryClient.invalidateQueries({ queryKey: ['job-details', resolvedJobId] });
                                  queryClient.invalidateQueries({ queryKey: ['job-rates-approval', resolvedJobId] });
                                  queryClient.invalidateQueries({ queryKey: ['job-rates-approval-map'] });
                                  queryClient.invalidateQueries({ queryKey: ['job-approval-status', resolvedJobId] });
                                  if (approvalSucceeded) {
                                    toast.success('Tarifas aprobadas', {
                                      description: '¿Quieres enviar los resúmenes de pagos por correo ahora?',
                                      action: resolvedJobId
                                        ? {
                                          label: 'Enviar ahora',
                                          onClick: () => {
                                            if (isSendingPayoutEmails) return;
                                            triggerPayoutEmails(resolvedJobId);
                                          },
                                        }
                                        : undefined,
                                    });
                                  }
                                }
                              }}
                            >
                              Aprobar
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {showPendingRatesNotice && (
                      <Alert
                        variant="default"
                        className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-sm text-amber-800 dark:text-amber-100">
                          Las tarifas de este trabajo están pendientes de aprobación y no son visibles por el momento.
                        </AlertDescription>
                      </Alert>
                    )}

                    {approvalStatus && approvalStatus.blockingReasons.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Pendiente: {approvalStatus.blockingReasons.join(', ')}
                      </div>
                    )}

                    {jobDetails?.locations && (
                      <div>
                        <p className="text-sm font-medium">Recinto</p>
                        <p className="text-sm text-muted-foreground">
                          {jobDetails.locations.name}
                        </p>
                        {jobDetails.locations.formatted_address && (
                          <p className="text-sm text-muted-foreground">
                            {jobDetails.locations.formatted_address}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>

                {isManager && resolvedJobId && (
                  <JobPayoutTotalsPanel jobId={resolvedJobId} />
                )}

                {isManager && !isDryhire && (
                  <Card className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <div className="font-medium">Órdenes de Trabajo (Flex)</div>
                        <div className="text-muted-foreground">
                          Progreso: {existingWOCount}/{desiredTechCount} {desiredTechCount > 0 ? 'técnicos' : ''}
                        </div>
                        <div className="text-muted-foreground">
                          Carpeta: {workOrdersFolder?.element_id ? 'creada' : 'no creada'}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!resolvedJobId) return;
                          setIsSyncingWorkOrders(true);
                          try {
                            const result = await syncFlexWorkOrdersForJob(resolvedJobId);
                            if (result.created > 0) {
                              toast.success(`Órdenes de trabajo creadas en Flex: ${result.created}`);
                            } else if (result.skipped > 0) {
                              toast(`Sin cambios. Técnicos omitidos: ${result.skipped}`);
                            }
                            result.errors.forEach((message) => toast.error(message));
                          } catch (e) {
                            toast.error(`No se pudo sincronizar con Flex: ${(e as Error).message}`);
                          } finally {
                            setIsSyncingWorkOrders(false);
                            queryClient.invalidateQueries({ queryKey: ['flex-workorders-folder', resolvedJobId] });
                            queryClient.invalidateQueries({ queryKey: ['flex-workorders-rows', resolvedJobId] });
                          }
                        }}
                        disabled={isSyncingWorkOrders}
                      >
                        {isSyncingWorkOrders ? 'Sincronizando…' : 'Sincronizar órdenes de trabajo'}
                      </Button>
                    </div>
                  </Card>
                )}

                {isManager && !isDryhire && (
                  <Card className="p-3 mt-2">
                    <div className="text-sm space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">Impresión rápida</div>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={async () => {
                            try {
                              // 1) Fetch approved timesheets for this job
                              const { data: ts } = await supabase
                                .from('timesheets')
                                .select('*')
                                .eq('job_id', resolvedJobId)
                                .eq('approved_by_manager', true);

                              // Fallback to visibility function when RLS blocks
                              let timesheets = ts || [];
                              if (!timesheets.length) {
                                const { data: visible } = await supabase.rpc('get_timesheet_amounts_visible');
                                timesheets = (visible as any[] | null)?.filter((r) => r.job_id === resolvedJobId) || [];
                              }

                              const { timesheets: enrichedTimesheets, profileMap } = await enrichTimesheetsWithProfiles(
                                supabase,
                                timesheets as any[]
                              );

                              timesheets = enrichedTimesheets;

                              // 2) Build job object for timesheet PDF
                              const jobObj = {
                                id: resolvedJobId,
                                title: jobDetails?.title || job?.title || 'Job',
                                start_time: jobDetails?.start_time || job?.start_time,
                                end_time: jobDetails?.end_time || job?.end_time,
                                job_type: jobDetails?.job_type || job?.job_type,
                                created_at: jobDetails?.created_at || new Date().toISOString(),
                              } as any;

                              const tsDoc = await generateTimesheetPDF({ job: jobObj, timesheets: timesheets as any, date: 'all-dates' });
                              const tsBlob = tsDoc.output('blob') as Blob;

                              // 3) Build inputs for payout PDF (tourdate uses rate quotes, others use payout totals)
                              const { data: lpoRows } = await supabase
                                .from('flex_work_orders')
                                .select('technician_id, lpo_number')
                                .eq('job_id', resolvedJobId);
                              const lpoMap = new Map((lpoRows || []).map((r: any) => [r.technician_id, r.lpo_number || null]));

                              // Timesheet breakdowns for payout details (non-tourdate PDF section)
                              const tsByTech = new Map<string, any[]>();
                              (timesheets || []).forEach((row: any) => {
                                const b = (row.amount_breakdown || row.amount_breakdown_visible || {}) as any;
                                const line = {
                                  date: row.date,
                                  hours_rounded: Number(b.hours_rounded ?? b.worked_hours_rounded ?? 0) || 0,
                                  base_day_eur: b.base_day_eur != null ? Number(b.base_day_eur) : undefined,
                                  plus_10_12_hours: b.plus_10_12_hours != null ? Number(b.plus_10_12_hours) : undefined,
                                  plus_10_12_amount_eur: b.plus_10_12_amount_eur != null ? Number(b.plus_10_12_amount_eur) : undefined,
                                  overtime_hours: b.overtime_hours != null ? Number(b.overtime_hours) : undefined,
                                  overtime_hour_eur: b.overtime_hour_eur != null ? Number(b.overtime_hour_eur) : undefined,
                                  overtime_amount_eur: b.overtime_amount_eur != null ? Number(b.overtime_amount_eur) : undefined,
                                  total_eur: b.total_eur != null ? Number(b.total_eur) : undefined,
                                };
                                const arr = tsByTech.get(row.technician_id) || [];
                                arr.push(line);
                                tsByTech.set(row.technician_id, arr);
                              });

                              let payoutBlob: Blob;
                              const isTourDateJob = (jobDetails?.job_type || job?.job_type) === 'tourdate';
                              if (isTourDateJob) {
                                // Compute quotes via RPC per technician for this tour date job
                                const { data: jobAssignments, error: jaErr } = await supabase
                                  .from('job_assignments')
                                  .select('technician_id')
                                  .eq('job_id', resolvedJobId);
                                if (jaErr) {
                                  console.error('[JobDetailsDialog] Failed loading job assignments for quotes', jaErr);
                                }
                                const techIdsForQuotes = Array.from(
                                  new Set(((jobAssignments || []) as any[]).map((a: any) => a.technician_id).filter(Boolean))
                                );

                                let quotes: any[] = [];
                                if (techIdsForQuotes.length > 0) {
                                  quotes = await Promise.all(
                                    techIdsForQuotes.map(async (techId: string) => {
                                      const { data, error } = await supabase.rpc('compute_tour_job_rate_quote_2025', {
                                        _job_id: resolvedJobId,
                                        _tech_id: techId,
                                      });
                                      if (error) {
                                        console.error('[JobDetailsDialog] RPC quote error', error);
                                        return {
                                          job_id: resolvedJobId,
                                          technician_id: techId,
                                          start_time: jobObj.start_time,
                                          end_time: jobObj.end_time,
                                          job_type: 'tourdate',
                                          tour_id: jobDetails?.tour_id ?? null,
                                          title: jobObj.title,
                                          is_house_tech: false,
                                          is_tour_team_member: false,
                                          category: '',
                                          base_day_eur: 0,
                                          week_count: 1,
                                          multiplier: 1,
                                          per_job_multiplier: 1,
                                          iso_year: null,
                                          iso_week: null,
                                          total_eur: 0,
                                          extras: undefined,
                                          extras_total_eur: undefined,
                                          total_with_extras_eur: undefined,
                                          breakdown: { error: error.message || String(error) },
                                        } as any;
                                      }
                                      return data as any;
                                    })
                                  );
                                }

                                // Ensure we have profiles for all quoted technicians
                                const missingProfileIds = techIdsForQuotes.filter(
                                  (id): id is string => typeof id === 'string' && !profileMap.has(id)
                                );
                                if (missingProfileIds.length) {
                                  const { data: extraProfiles, error: extraProfilesError } = await supabase
                                    .from('profiles')
                                    .select('id, first_name, last_name, department, autonomo')
                                    .in('id', missingProfileIds);
                                  if (extraProfilesError) {
                                    console.error('[JobDetailsDialog] Failed to load technician profiles for quotes', extraProfilesError);
                                  } else {
                                    (extraProfiles || []).forEach((profile: TechnicianProfile) => {
                                      if (profile?.id) profileMap.set(profile.id, profile);
                                    });
                                  }
                                }

                                const payoutProfiles = Array.from(profileMap.values());
                                const quoteBlob = (await generateRateQuotePDF(
                                  quotes as any,
                                  { id: jobObj.id, title: jobObj.title, start_time: jobObj.start_time, tour_id: jobDetails?.tour_id ?? null, job_type: jobObj.job_type },
                                  payoutProfiles as any,
                                  lpoMap,
                                  { download: false }
                                )) as Blob;
                                payoutBlob = quoteBlob;
                              } else {
                                // Standard jobs: use aggregated payout totals view
                                const { data: payouts } = await supabase
                                  .from('v_job_tech_payout_2025')
                                  .select('*')
                                  .eq('job_id', resolvedJobId);

                                const techIds = Array.from(new Set((payouts || []).map((p: any) => p.technician_id)));
                                const missingProfileIds = techIds.filter(
                                  (id): id is string => typeof id === 'string' && !profileMap.has(id)
                                );
                                if (missingProfileIds.length) {
                                  const { data: extraProfiles, error: extraProfilesError } = await supabase
                                    .from('profiles')
                                    .select('id, first_name, last_name, department, autonomo')
                                    .in('id', missingProfileIds);
                                  if (extraProfilesError) {
                                    console.error('[JobDetailsDialog] Failed to load technician profiles for payouts', extraProfilesError);
                                  } else {
                                    (extraProfiles || []).forEach((profile: TechnicianProfile) => {
                                      if (profile?.id) profileMap.set(profile.id, profile);
                                    });
                                  }
                                }

                                const payoutProfiles = Array.from(profileMap.values());
                                payoutBlob = (await generateJobPayoutPDF(
                                  (payouts || []) as any,
                                  { id: jobObj.id, title: jobObj.title, start_time: jobObj.start_time, end_time: jobObj.end_time, tour_id: jobDetails?.tour_id ?? null },
                                  payoutProfiles as any,
                                  lpoMap,
                                  tsByTech as any,
                                  { download: false }
                                )) as Blob;
                              }

                              // 4) Merge into a single pack and download
                              const merged = await mergePDFs([tsBlob, payoutBlob]);
                              const url = URL.createObjectURL(merged);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `pack_${(jobObj.title || 'job').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              URL.revokeObjectURL(url);
                            } catch (e) {
                              console.error('Failed to generate document pack', e);
                              toast.error('No se pudo generar el pack de documentos');
                            }
                          }}
                        >
                          Imprimir Pack (Partes + Pagos)
                        </Button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">Mapa de LPO (depuración)</div>
                          <div className="text-muted-foreground">
                            Carpeta padre (work_orders): {workOrdersFolder?.element_id || '—'}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(workOrdersFolder?.element_id)}>Copiar carpeta</Button>
                      </div>

                      {existingWorkOrders && existingWorkOrders.length > 0 ? (
                        <div className="border-t pt-2 space-y-1">
                          {existingWorkOrders.map((row: any) => {
                            const name = [row?.profiles?.first_name, row?.profiles?.last_name].filter(Boolean).join(' ') || row.technician_id;
                            const elementId = row?.flex_element_id || row?.flex_document_id || '—';
                            const vendorId = row?.flex_vendor_id || '—';
                            const lpoNumber = row?.lpo_number || '—';
                            return (
                              <div key={`${row.technician_id}-${elementId}`} className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate"><span className="font-medium">{name}</span></div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    LPO: {elementId}
                                    {elementId && (
                                      <a
                                        className="ml-2 text-primary hover:underline inline-flex items-center"
                                        href={`https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#fin-doc/${encodeURIComponent(elementId)}/doc-view/8238f39c-f42e-11e0-a8de-00e08175e43e/detail`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir en Flex
                                      </a>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">Vendor: {vendorId}</div>
                                  <div className="text-xs text-muted-foreground truncate">Número: {lpoNumber}</div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(String(elementId))}>Copiar LPO</Button>
                                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(String(lpoNumber))}>Copiar Nº</Button>
                                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(String(vendorId))}>Copiar Vendor</Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No hay LPO registrados en BD para este trabajo.</div>
                      )}
                    </div>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="location" className="space-y-4 min-w-0 overflow-x-hidden">
                <Card className="p-4 w-full min-w-0 overflow-hidden">
                  {isJobLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : jobDetails?.locations ? (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{jobDetails.locations.name}</h3>
                          {jobDetails.locations.formatted_address && (
                            <p className="text-muted-foreground">{jobDetails.locations.formatted_address}</p>
                          )}
                        </div>
                        <Button onClick={openGoogleMaps} size="sm">
                          <MapPin className="h-4 w-4 mr-2" />
                          Abrir mapas
                        </Button>
                      </div>

                      {(isMapLoading) && (
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                            <p className="text-sm text-muted-foreground">Cargando vista previa del mapa...</p>
                          </div>
                        </div>
                      )}
                      {!isMapLoading && mapPreviewUrl && (
                        <div className="rounded-lg overflow-hidden border">
                          <img src={mapPreviewUrl} alt="Mapa del recinto" className="w-full h-auto" />
                          <div className="p-2 flex justify-end">
                            <Button onClick={openGoogleMaps} size="sm">
                              Ver indicaciones
                            </Button>
                          </div>
                        </div>
                      )}
                      {!isMapLoading && !mapPreviewUrl && (
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Vista previa del mapa no disponible</p>
                            <Button onClick={openGoogleMaps} size="sm" className="mt-2">
                              Abrir Google Maps
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Logistics Events */}
                      {jobDetails.logistics_events && jobDetails.logistics_events.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            Logística
                          </h4>
                          <div className="space-y-2">
                            {jobDetails.logistics_events.map((event: any) => (
                              <div key={event.id} className="flex items-center justify-between p-2 bg-muted rounded">
                                <div>
                                  <span className="capitalize font-medium">{event.event_type}</span>
                                  <span className="text-muted-foreground ml-2">
                                    ({event.transport_type})
                                  </span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {event.event_date ? format(new Date(event.event_date), 'PPP', { locale: es }) : 'Sin fecha'} a las {event.event_time || 'sin hora'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No hay información de ubicación disponible</p>
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="personnel" className="space-y-4 min-w-0 overflow-x-hidden">
                <Card className="p-4 w-full min-w-0 overflow-hidden">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Personal asignado
                  </h3>

                  {isJobLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredAssignments.length > 0 ? (
                    <div className="space-y-3">
                      {filteredAssignments.map((assignment: any) => (
                        <div key={assignment.technician_id} className="flex items-center justify-between p-3 bg-muted rounded">
                          <div>
                            <p className="font-medium">
                              {assignment.profiles
                                ? `${assignment.profiles.first_name} ${assignment.profiles.last_name}`
                                : assignment.external_technician_name || 'Desconocido'
                              }
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {assignment.profiles?.department || 'Externo'}
                            </p>
                            {assignment.single_day && (
                              <p className="text-xs text-muted-foreground">
                                {(() => {
                                  const dates = technicianDatesMap.get(assignment.technician_id);
                                  if (dates && dates.size > 0) {
                                    const sortedDates = Array.from(dates).sort();
                                    if (sortedDates.length === 1) {
                                      return `Solo día: ${format(new Date(sortedDates[0]), 'PPP', { locale: es })}`;
                                    } else {
                                      return `Días: ${sortedDates.map(d => format(new Date(d), 'dd/MM')).join(', ')}`;
                                    }
                                  }
                                  return assignment.assignment_date
                                    ? `Solo día: ${format(new Date(assignment.assignment_date), 'PPP', { locale: es })}`
                                    : 'Sin fecha definida';
                                })()}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {assignment.sound_role && (
                              <Badge variant="outline" className="text-xs">
                                Sonido: {labelForCode(assignment.sound_role)}
                              </Badge>
                            )}
                            {assignment.lights_role && (
                              <Badge variant="outline" className="text-xs">
                                Luces: {labelForCode(assignment.lights_role)}
                              </Badge>
                            )}
                            {assignment.video_role && (
                              <Badge variant="outline" className="text-xs">
                                Vídeo: {labelForCode(assignment.video_role)}
                              </Badge>
                            )}
                            {assignment.single_day && (
                              <Badge variant="secondary" className="text-xs">
                                {(() => {
                                  const dates = technicianDatesMap.get(assignment.technician_id);
                                  if (dates && dates.size > 0) {
                                    return dates.size === 1 ? 'Día único' : 'Varios días';
                                  }
                                  return 'Día único';
                                })()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No hay personal asignado aún</p>
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4 min-w-0 overflow-x-hidden">
                <Card className="p-4 w-full min-w-0 overflow-hidden">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documentos del trabajo
                  </h3>

                  {jobDocumentsError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertDescription>
                        No se pudieron cargar todos los documentos. {jobDocumentsError.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {documentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : resolvedDocuments.length > 0 ? (
                    <div className="space-y-2">
                      {resolvedDocuments.map((doc: any) => {
                        const isTemplate = doc.template_type === 'soundvision';
                        const isReadOnly = Boolean(doc.read_only);
                        return (
                          <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-[#0f1219] border border-[#1f232e] rounded min-w-0">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium flex items-center gap-2 break-words">
                                {doc.file_name}
                                {isTemplate && (
                                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                    Plantilla SoundVision
                                  </Badge>
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground break-words">
                                {doc.uploaded_at ? `Subido el ${format(new Date(doc.uploaded_at), 'PPP', { locale: es })}` : 'Fecha de subida desconocida'}
                                {isReadOnly && <span className="ml-2 italic">Solo lectura</span>}
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:shrink-0">
                              <Button
                                onClick={() => handleViewDocument(doc)}
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Ver
                              </Button>
                              <Button
                                onClick={() => handleDownloadDocument(doc)}
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Descargar
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No se han subido documentos</p>
                    </div>
                  )}
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Riders de artistas
                  </h3>
                  {isRidersLoading ? (
                    <div className="text-center py-4 text-muted-foreground">Cargando riders…</div>
                  ) : riderFiles.length > 0 ? (
                    <div className="space-y-2">
                      {riderFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-muted rounded">
                          <div>
                            <p className="font-medium">{file.file_name}</p>
                            <p className="text-sm text-muted-foreground">Artista: {artistNameMap.get(file.artist_id) || 'Desconocido'}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => viewRider(file)}>
                              <Eye className="h-4 w-4 mr-1" /> Ver
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => downloadRider(file)}>
                              <Download className="h-4 w-4 mr-1" /> Descargar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No se han subido riders de artistas</p>
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="restaurants" className="space-y-4 min-w-0 overflow-x-hidden">
                <Card className="p-4 w-full min-w-0 overflow-hidden">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4" />
                    Restaurantes cercanos
                  </h3>

                  {(isJobLoading || isRestaurantsLoading) ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-muted-foreground">Buscando restaurantes cercanos...</p>
                    </div>
                  ) : restaurants && restaurants.length > 0 ? (
                    <div className="space-y-3">
                      {restaurants.map((restaurant: Restaurant) => (
                        <div key={restaurant.id} className="p-3 bg-[#0f1219] border border-[#1f232e] rounded">
                          <div className="flex items-start justify-between gap-3 min-w-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium break-words">{restaurant.name}</p>
                              <p className="text-sm text-muted-foreground break-words">{restaurant.address}</p>

                              <div className="flex items-center gap-2 mt-2">
                                {restaurant.rating && (
                                  <Badge variant="outline" className="text-xs">
                                    ⭐ {restaurant.rating}
                                  </Badge>
                                )}
                                {restaurant.priceLevel !== undefined && (
                                  <Badge variant="outline" className="text-xs">
                                    {'€'.repeat(restaurant.priceLevel + 1)}
                                  </Badge>
                                )}
                                {restaurant.distance && (
                                  <Badge variant="outline" className="text-xs">
                                    A {Math.round(restaurant.distance)} m
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-1">
                              {restaurant.phone && (
                                <Button size="sm" variant="outline" asChild>
                                  <a href={`tel:${restaurant.phone}`}>
                                    <Phone className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              {restaurant.website && (
                                <Button size="sm" variant="outline" asChild>
                                  <a href={restaurant.website} target="_blank" rel="noopener noreferrer">
                                    <Globe className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {jobDetails?.locations?.formatted_address
                          ? "No se encontraron restaurantes cercanos"
                          : "No hay dirección del recinto para buscar restaurantes"
                        }
                      </p>
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="weather" className="space-y-4 min-w-0 overflow-x-hidden">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <CloudIcon className="h-4 w-4" />
                      Pronóstico del Tiempo
                    </h3>
                    {!isJobLoading && weatherVenue.address && eventDatesString && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchWeather}
                        disabled={isWeatherLoading}
                        className="flex items-center gap-1"
                      >
                        {isWeatherLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {isWeatherLoading ? 'Cargando...' : 'Actualizar'}
                      </Button>
                    )}
                  </div>

                  {isJobLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : !weatherVenue.address && !weatherVenue.coordinates ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <AlertCircle className="h-4 w-4" />
                      El pronóstico del tiempo requiere ubicación del lugar
                    </div>
                  ) : !eventDatesString ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <AlertCircle className="h-4 w-4" />
                      El pronóstico del tiempo requiere fechas del evento
                    </div>
                  ) : weatherError ? (
                    <div className="flex items-center gap-2 text-sm text-destructive py-4">
                      <AlertCircle className="h-4 w-4" />
                      {weatherError}
                    </div>
                  ) : isWeatherLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Obteniendo pronóstico del tiempo...
                    </div>
                  ) : weatherData && weatherData.length > 0 ? (
                    <div className="space-y-2">
                      {weatherData.map((weather, index) => {
                        const getWeatherIcon = (condition: string) => {
                          if (condition.toLowerCase().includes('sun')) return '☀️';
                          if (condition.toLowerCase().includes('cloud')) return '☁️';
                          if (condition.toLowerCase().includes('rain')) return '🌧️';
                          if (condition.toLowerCase().includes('snow')) return '❄️';
                          if (condition.toLowerCase().includes('storm')) return '⛈️';
                          return '🌤️';
                        };

                        const formatDate = (dateStr: string) => {
                          try {
                            const date = new Date(dateStr);
                            return date.toLocaleDateString('es-ES', {
                              month: 'long',
                              day: 'numeric'
                            });
                          } catch {
                            return dateStr;
                          }
                        };

                        return (
                          <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{getWeatherIcon(weather.condition)}</span>
                              <div>
                                <div className="font-medium text-sm">
                                  {formatDate(weather.date)} – {weather.condition}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {Math.round(weather.maxTemp)}°C / {Math.round(weather.minTemp)}°C
                                  {weather.precipitationProbability > 0 && (
                                    <span>, {weather.precipitationProbability}% lluvia</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div className="text-xs text-muted-foreground mt-4">
                        <strong>Fuente:</strong> Los datos del tiempo se obtienen de Open-Meteo y se actualizan automáticamente.
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CloudIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground text-sm">
                        Datos del tiempo no disponibles para las fechas y ubicación seleccionadas.
                      </p>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {showTourRatesTab && resolvedJobId && (
                <TabsContent value="tour-rates" className="space-y-4 min-w-0 overflow-x-hidden">
                  <TourRatesPanel jobId={resolvedJobId} />
                </TabsContent>
              )}

              {!isDryhire && showExtrasTab && (
                <TabsContent value="extras" className="space-y-4 min-w-0 overflow-x-hidden">
                  <JobExtrasManagement
                    jobId={resolvedJobId}
                    isManager={isManager}
                    technicianId={isManager ? undefined : (user?.id || undefined)}
                  />
                </TabsContent>
              )}
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
