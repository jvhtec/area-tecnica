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
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlacesRestaurantService } from "@/utils/hoja-de-ruta/services/places-restaurant-service";
import type { Restaurant } from "@/types/hoja-de-ruta";
import { labelForCode } from '@/utils/roles';
import { TourRatesPanel } from '@/components/tours/TourRatesPanel';
import { JobExtrasManagement } from '@/components/jobs/JobExtrasManagement';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useTourRateSubscriptions } from "@/hooks/useTourRateSubscriptions";
import { useJobExtras } from '@/hooks/useJobExtras';
import { useJobRatesApproval } from '@/hooks/useJobRatesApproval';
import { useJobApprovalStatus } from '@/hooks/useJobApprovalStatus';
import { toast } from 'sonner';
import { syncFlexWorkOrdersForJob } from '@/services/flexWorkOrders';
import { resolveJobDocBucket } from '@/utils/jobDocuments';

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
  const isManager = ['admin','management'].includes(userRole || '');
  const isTechnicianRole = ['technician', 'house_tech'].includes(userRole || '');
  const queryClient = useQueryClient();

  // Fetch comprehensive job data
  const { data: jobDetails, isLoading: isJobLoading } = useQuery({
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
            profiles(id, first_name, last_name, department, role)
          ),
          job_documents(id, file_name, file_path, uploaded_at, file_size, visible_to_tech, read_only, template_type),
          logistics_events(id, event_type, transport_type, event_date, event_time, license_plate)
        `)
        .eq('id', job.id)
        .single();

      if (error) throw error;
      console.log('JobDetailsDialog: Full job data loaded:', JSON.stringify(data, null, 2));
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
  const showExtrasTab = !isDryhire && (isManager || (jobRatesApproved && jobExtras.length > 0));
  const showTourRatesTab = !isDryhire
    && jobDetails?.job_type === 'tourdate'
    && (isManager || jobRatesApproved);

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
  const { data: restaurants, isLoading: isRestaurantsLoading } = useQuery({
    queryKey: ['job-restaurants', job.id, jobDetails?.locations?.formatted_address],
    queryFn: async () => {
      const locationData = jobDetails?.locations;
      const address = locationData?.formatted_address;
      
      console.log('Restaurant query - location data:', locationData);
      console.log('Restaurant query - using address:', address);
      
      if (!address) {
        console.log('Restaurant query - no address found, returning empty array');
        return [];
      }
      
      const coordinates = locationData?.latitude && locationData?.longitude 
        ? { lat: Number(locationData.latitude), lng: Number(locationData.longitude) }
        : undefined;

      console.log('Restaurant query - coordinates:', coordinates);
      
      return await PlacesRestaurantService.searchRestaurantsNearVenue(
        address,
        2000,
        10,
        coordinates
      );
    },
    enabled: open && !!jobDetails?.locations?.formatted_address
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
      const bucket = resolveJobDocBucket(doc.file_path);
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(doc.file_path, 3600);

      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = doc.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const handleViewDocument = async (doc: any) => {
    try {
      const bucket = resolveJobDocBucket(doc.file_path);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(doc.file_path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
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
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const gridColsClass = isDryhire
    ? 'grid-cols-1'
    : showExtrasTab
      ? (showTourRatesTab ? 'grid-cols-7' : 'grid-cols-6')
      : (showTourRatesTab ? 'grid-cols-6' : 'grid-cols-5');

  const showPendingRatesNotice = !isDryhire
    && jobDetails?.job_type === 'tourdate'
    && !isManager
    && isTechnicianRole
    && !jobRatesApproved;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {jobDetails?.title || 'Detalles del trabajo'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className={`grid w-full ${gridColsClass}`}>
            <TabsTrigger value="info">Información</TabsTrigger>
            {!isDryhire && <TabsTrigger value="location">Ubicación</TabsTrigger>}
            {!isDryhire && <TabsTrigger value="personnel">Personal</TabsTrigger>}
            {!isDryhire && <TabsTrigger value="documents">Documentos</TabsTrigger>}
            {!isDryhire && <TabsTrigger value="restaurants">Restaurantes</TabsTrigger>}
            {showTourRatesTab && (
              <TabsTrigger value="tour-rates">Tarifas de gira</TabsTrigger>
            )}
            {!isDryhire && showExtrasTab && <TabsTrigger value="extras">Extras</TabsTrigger>}
          </TabsList>

          <ScrollArea className="h-[500px] mt-4">
            <TabsContent value="info" className="space-y-4">
              <Card className="p-4">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">{jobDetails?.title}</h3>
                    {jobDetails?.description && (
                      <p className="text-muted-foreground mt-1">{jobDetails.description}</p>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4">
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
                                <div className="text-xs text-muted-foreground truncate">LPO: {elementId}</div>
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

            {!isDryhire && (
            <TabsContent value="location" className="space-y-4">
              <Card className="p-4">
                {jobDetails?.locations ? (
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
            )}

            {!isDryhire && (
            <TabsContent value="personnel" className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Personal asignado
                </h3>

                {jobDetails?.job_assignments && jobDetails.job_assignments.length > 0 ? (
                  <div className="space-y-3">
                    {jobDetails.job_assignments.map((assignment: any) => (
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
            )}

            {!isDryhire && (
            <TabsContent value="documents" className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentos del trabajo
                </h3>

                {jobDetails?.job_documents && jobDetails.job_documents.length > 0 ? (
                  <div className="space-y-2">
                    {jobDetails.job_documents.map((doc: any) => {
                      const isTemplate = doc.template_type === 'soundvision';
                      const isReadOnly = Boolean(doc.read_only);
                      return (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-muted rounded">
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {doc.file_name}
                              {isTemplate && (
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                  Template SoundVision File
                                </Badge>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {doc.uploaded_at ? `Subido el ${format(new Date(doc.uploaded_at), 'PPP', { locale: es })}` : 'Fecha de subida desconocida'}
                              {isReadOnly && <span className="ml-2 italic">Solo lectura</span>}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleViewDocument(doc)}
                              size="sm"
                              variant="outline"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver
                            </Button>
                            <Button
                              onClick={() => handleDownloadDocument(doc)}
                              size="sm"
                              variant="outline"
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
            )}

            {!isDryhire && (
            <TabsContent value="restaurants" className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4" />
                  Restaurantes cercanos
                </h3>

                {isRestaurantsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-muted-foreground">Buscando restaurantes cercanos...</p>
                  </div>
                ) : restaurants && restaurants.length > 0 ? (
                  <div className="space-y-3">
                    {restaurants.map((restaurant: Restaurant) => (
                      <div key={restaurant.id} className="p-3 bg-muted rounded">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{restaurant.name}</p>
                            <p className="text-sm text-muted-foreground">{restaurant.address}</p>
                            
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
            )}

            {showTourRatesTab && resolvedJobId && (
              <TabsContent value="tour-rates" className="space-y-4">
                <TourRatesPanel jobId={resolvedJobId} />
              </TabsContent>
            )}

            {!isDryhire && showExtrasTab && (
              <TabsContent value="extras" className="space-y-4">
                <JobExtrasManagement
                  jobId={resolvedJobId}
                  isManager={isManager}
                  technicianId={isManager ? undefined : (user?.id || undefined)}
                />
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
