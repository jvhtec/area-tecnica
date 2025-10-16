import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Calendar
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
          job_documents(id, file_name, file_path, uploaded_at, file_size),
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
  const jobIdForExtras = (jobDetails?.id as string) || job.id;
  const { data: jobExtras = [] } = useJobExtras(jobIdForExtras);
  const showExtrasTab = !!(jobDetails?.rates_approved) && (jobExtras.length > 0);

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
          const { data, error } = await supabase.functions.invoke('get-secret', {
            body: { secretName: 'GOOGLE_MAPS_API_KEY' }
          });
          if (error || !data?.GOOGLE_MAPS_API_KEY) {
            setMapPreviewUrl(null);
            setIsMapLoading(false);
            return;
          }
          apiKey = data.GOOGLE_MAPS_API_KEY as string;
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

  const resolveBucket = (path: string) => {
    const first = (path || '').split('/')[0];
    const dept = new Set(['sound','lights','video','production','logistics','administrative']);
    return dept.has(first) ? 'job_documents' : 'job-documents';
  };

  const handleDownloadDocument = async (doc: any) => {
    try {
      const bucket = resolveBucket(doc.file_path);
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
      const bucket = resolveBucket(doc.file_path);
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

  const isDryhire = (jobDetails?.job_type || job?.job_type) === 'dryhire';

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
          <TabsList className={`grid w-full ${isDryhire ? 'grid-cols-1' : (jobDetails?.job_type === 'tourdate' ? (showExtrasTab ? 'grid-cols-7' : 'grid-cols-6') : (showExtrasTab ? 'grid-cols-6' : 'grid-cols-5'))}`}>
            <TabsTrigger value="info">Información</TabsTrigger>
            {!isDryhire && <TabsTrigger value="location">Ubicación</TabsTrigger>}
            {!isDryhire && <TabsTrigger value="personnel">Personal</TabsTrigger>}
            {!isDryhire && <TabsTrigger value="documents">Documentos</TabsTrigger>}
            {!isDryhire && <TabsTrigger value="restaurants">Restaurantes</TabsTrigger>}
            {!isDryhire && jobDetails?.job_type === 'tourdate' && (
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
                        <Badge variant={jobDetails?.rates_approved ? 'default' : 'secondary'}>
                          {jobDetails?.rates_approved ? 'Tarifas aprobadas' : 'Aprobación necesaria'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Controla la visibilidad de los pagos por trabajo para los técnicos</span>
                      </div>
                      <div>
                        {jobDetails?.rates_approved ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await supabase
                                .from('jobs')
                                .update({ rates_approved: false, rates_approved_at: null, rates_approved_by: null } as any)
                                .eq('id', job.id);
                              queryClient.invalidateQueries({ queryKey: ['job-details', job.id] });
                            }}
                          >
                            Revocar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={async () => {
                              const { data: u } = await supabase.auth.getUser();
                              await supabase
                                .from('jobs')
                                .update({ rates_approved: true, rates_approved_at: new Date().toISOString(), rates_approved_by: u?.user?.id || null } as any)
                                .eq('id', job.id);
                              queryClient.invalidateQueries({ queryKey: ['job-details', job.id] });
                            }}
                          >
                            Aprobar
                          </Button>
                        )}
                      </div>
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
                    {jobDetails.job_documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-muted rounded">
                        <div>
                          <p className="font-medium">{doc.file_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.uploaded_at ? `Subido el ${format(new Date(doc.uploaded_at), 'PPP', { locale: es })}` : 'Fecha de subida desconocida'}
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
                    ))}
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

            {!isDryhire && jobDetails?.job_type === 'tourdate' && (
              <TabsContent value="tour-rates" className="space-y-4">
                <TourRatesPanel jobId={jobDetails.id} />
              </TabsContent>
            )}

            {!isDryhire && showExtrasTab && (
              <TabsContent value="extras" className="space-y-4">
                <JobExtrasManagement 
                  jobId={jobIdForExtras}
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
