import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, X, Calendar as CalendarIcon, MapPin, User, FileText, Eye, Download, Utensils, Phone, Globe, CloudRain, RefreshCw, AlertTriangle, Map as MapIcon, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWeatherData } from '@/hooks/useWeatherData';
import { PlacesRestaurantService } from '@/utils/hoja-de-ruta/services/places-restaurant-service';
import { createSignedUrl } from '@/utils/jobDocuments';
import { labelForCode } from '@/utils/roles';
import type { Restaurant, WeatherData } from '@/types/hoja-de-ruta';
import type { JobDocument } from '@/types/job';
import { TourRatesPanel } from '@/components/tours/TourRatesPanel';
import { JobExtrasManagement } from '@/components/jobs/JobExtrasManagement';
import { useJobExtras } from '@/hooks/useJobExtras';
import { useJobRatesApproval } from '@/hooks/useJobRatesApproval';
import { useJobApprovalStatus } from '@/hooks/useJobApprovalStatus';
import { JobPayoutTotalsPanel } from '@/components/jobs/JobPayoutTotalsPanel';

interface EnhancedJobDetailsModalProps {
    theme: {
        bg: string;
        card: string;
        textMain: string;
        textMuted: string;
        divider: string;
        accent: string;
        modalOverlay: string;
    };
    isDark: boolean;
    job: any;
    onClose: () => void;
    userRole?: string | null;
    department?: string;
}

type TabId = 'Info' | 'Ubicación' | 'Personal' | 'Docs' | 'Restau.' | 'Clima' | 'Tarifas' | 'Extras';

interface StaffAssignment {
    sound_role?: string | null;
    lights_role?: string | null;
    video_role?: string | null;
    technician: {
        id: string;
        first_name: string;
        last_name: string;
        email?: string;
    } | null;
}

export const EnhancedJobDetailsModal = ({ theme, isDark, job, onClose, userRole, department = 'sound' }: EnhancedJobDetailsModalProps) => {
    const [activeTab, setActiveTab] = useState<TabId>('Info');
    const [documentLoading, setDocumentLoading] = useState<Set<string>>(new Set());
    const [weatherData, setWeatherData] = useState<WeatherData[] | undefined>(undefined);
    const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
    const [isMapLoading, setIsMapLoading] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const queryClient = useQueryClient();

    const isManager = ['admin', 'management'].includes(userRole || '');
    const isHouseTech = userRole === 'house_tech';

    // Fetch full job details with location
    const { data: jobDetails, isLoading: jobDetailsLoading } = useQuery({
        queryKey: ['job-details-modal', job?.id],
        queryFn: async () => {
            if (!job?.id) return null;
            const { data, error } = await supabase
                .from('jobs')
                .select(`
          *,
          locations(id, name, formatted_address, latitude, longitude)
        `)
                .eq('id', job.id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!job?.id,
    });

    const resolvedJobId = jobDetails?.id || job?.id;

    // Fetch extras and rates approval status  
    const { data: jobExtras = [] } = useJobExtras(resolvedJobId);
    const { data: jobRatesApproval } = useJobRatesApproval(resolvedJobId);
    const { data: approvalStatus, isLoading: approvalStatusLoading } = useJobApprovalStatus(resolvedJobId);
    const jobRatesApproved = jobRatesApproval?.rates_approved ?? jobDetails?.rates_approved ?? job?.rates_approved ?? false;

    // Fetch staff assignments
    const { data: staffAssignments = [], isLoading: staffLoading } = useQuery({
        queryKey: ['job-staff', job?.id],
        queryFn: async () => {
            if (!job?.id) return [];
            const { data, error } = await supabase
                .from('job_assignments')
                .select(`
          sound_role,
          lights_role,
          video_role,
          technician:profiles(id, first_name, last_name, email)
        `)
                .eq('job_id', job.id)
                .eq('status', 'confirmed');
            if (error) throw error;
            return data || [];
        },
        enabled: !!job?.id,
    });

    // Fetch restaurants
    const { data: restaurants = [], isLoading: isRestaurantsLoading } = useQuery({
        queryKey: ['job-restaurants-modal', job?.id, jobDetails?.locations?.formatted_address],
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
                coordinates
            );
        },
        enabled: !!jobDetails?.locations && (!!jobDetails?.locations?.formatted_address || !!jobDetails?.locations?.name || (!!jobDetails?.locations?.latitude && !!jobDetails?.locations?.longitude))
    });

    // Weather setup
    const eventDatesString = (jobDetails?.start_time || job?.start_time) && (jobDetails?.end_time || job?.end_time)
        ? new Date(jobDetails?.start_time || job?.start_time).toLocaleDateString('en-GB').split('/').join('/') +
        (new Date(jobDetails?.start_time || job?.start_time).toDateString() !== new Date(jobDetails?.end_time || job?.end_time).toDateString()
            ? ' - ' + new Date(jobDetails?.end_time || job?.end_time).toLocaleDateString('en-GB').split('/').join('/')
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

    useEffect(() => {
        if (resolvedJobId) {
            setActiveTab('Info');
        }
    }, [resolvedJobId]);

    const invalidateJobQueries = () => {
        if (!resolvedJobId) return;
        queryClient.invalidateQueries({ queryKey: ['job-details-modal', resolvedJobId] });
        queryClient.invalidateQueries({ queryKey: ['job-approval-status', resolvedJobId] });
        queryClient.invalidateQueries({ queryKey: ['job-rates-approval', resolvedJobId] });
        queryClient.invalidateQueries({ queryKey: ['job-rates-approval-map'] });
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
    };

    const handleApproveRates = async () => {
        if (!resolvedJobId || isApproving) return;
        if (approvalStatus && !approvalStatus.canApprove) {
            const reasons = approvalStatus.blockingReasons.join(', ');
            toast.error(reasons ? `No se puede aprobar: ${reasons}` : 'No se puede aprobar mientras haya pendientes');
            return;
        }

        setIsApproving(true);
        try {
            const { data: u } = await supabase.auth.getUser();
            const { error } = await supabase
                .from('jobs')
                .update({
                    rates_approved: true,
                    rates_approved_at: new Date().toISOString(),
                    rates_approved_by: u?.user?.id || null,
                } as any)
                .eq('id', resolvedJobId);
            if (error) throw error;
            toast.success('Tarifas aprobadas');
        } catch (err) {
            console.error('[EnhancedJobDetailsModal] Job rates approval failed', err);
            toast.error('No se pudieron aprobar las tarifas del trabajo');
        } finally {
            setIsApproving(false);
            invalidateJobQueries();
        }
    };

    const handleRevokeRates = async () => {
        if (!resolvedJobId || isApproving) return;
        setIsApproving(true);
        try {
            const { error } = await supabase
                .from('jobs')
                .update({ rates_approved: false, rates_approved_at: null, rates_approved_by: null } as any)
                .eq('id', resolvedJobId);
            if (error) throw error;
            toast.success('Aprobación revocada');
        } catch (err) {
            console.error('[EnhancedJobDetailsModal] Revoke approval failed', err);
            toast.error('No se pudo revocar la aprobación');
        } finally {
            setIsApproving(false);
            invalidateJobQueries();
        }
    };

    // Load map
    useEffect(() => {
        const loadStaticMap = async () => {
            try {
                const loc = jobDetails?.locations;
                if (!loc) {
                    setMapPreviewUrl(null);
                    return;
                }
                const lat = typeof loc.latitude === 'number' ? loc.latitude : (typeof loc.latitude === 'string' ? parseFloat(loc.latitude) : undefined);
                const lng = typeof loc.longitude === 'number' ? loc.longitude : (typeof loc.longitude === 'string' ? parseFloat(loc.longitude) : undefined);
                const address = loc.formatted_address || loc.name || '';

                setIsMapLoading(true);

                const { data, error } = await supabase.functions.invoke('get-google-maps-key');
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
                    : (address ? `&markers=color:red|label:A|${encodeURIComponent(address)}` : '');
                const url = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${width}x${height}&scale=${scale}${markers}&key=${encodeURIComponent(apiKey)}`;

                setMapPreviewUrl(url);
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : String(e);
                console.warn('Failed to load static map preview:', message);
                setMapPreviewUrl(null);
            } finally {
                setIsMapLoading(false);
            }
        };
        if (jobDetails?.locations) {
            loadStaticMap();
        }
    }, [jobDetails?.locations]);

    const handleViewDocument = async (doc: JobDocument) => {
        const docId = doc.id;
        setDocumentLoading(prev => new Set(prev).add(docId));
        try {
            const url = await createSignedUrl(supabase, doc.file_path, 60);
            window.open(url, '_blank');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            toast.error(`No se pudo abrir el documento: ${message}`);
        } finally {
            setDocumentLoading(prev => { const s = new Set(prev); s.delete(docId); return s; });
        }
    };

    const handleDownload = async (doc: JobDocument) => {
        const docId = doc.id;
        setDocumentLoading(prev => new Set(prev).add(docId));
        try {
            const url = await createSignedUrl(supabase, doc.file_path, 60);
            const link = document.createElement('a');
            link.href = url;
            link.download = doc.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            toast.error(`No se pudo descargar el documento: ${message}`);
        } finally {
            setDocumentLoading(prev => { const s = new Set(prev); s.delete(docId); return s; });
        }
    };

    const handleOpenMaps = () => {
        const address = jobDetails?.locations?.formatted_address || jobDetails?.locations?.name || job?.location?.name || '';
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        window.open(url, '_blank');
    };

    const locationData = jobDetails?.locations || job?.location;
    const jobStartDate = (jobDetails?.start_time || job?.start_time)
        ? format(new Date(jobDetails?.start_time || job?.start_time), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })
        : "Fecha no disponible";
    const jobEndDate = (jobDetails?.end_time || job?.end_time)
        ? format(new Date(jobDetails?.end_time || job?.end_time), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })
        : "Fecha no disponible";

    const jobType = jobDetails?.job_type || job?.job_type;
    const isDryhire = jobType === 'dryhire';
    const showTourRatesTab = !isDryhire && jobType === 'tourdate' && (isManager || jobRatesApproved) && !isHouseTech;
    const showExtrasTab = !isDryhire && (isManager || isHouseTech || (jobRatesApproved && jobExtras.length > 0));
    const canViewAllDocs = isManager || isHouseTech;

    const tabs: { id: TabId; label: string }[] = [
        { id: 'Info', label: 'Info' },
        { id: 'Ubicación', label: 'Ubicación' },
        { id: 'Personal', label: 'Personal' },
        { id: 'Docs', label: 'Docs' },
        { id: 'Restau.', label: 'Restau.' },
        { id: 'Clima', label: 'Clima' },
    ];

    if (showTourRatesTab) tabs.push({ id: 'Tarifas', label: 'Tarifas' });
    if (showExtrasTab) tabs.push({ id: 'Extras', label: 'Extras' });

    const getDepartmentFromAssignment = (assignment: StaffAssignment): string => {
        if (assignment.sound_role) return 'sound';
        if (assignment.lights_role) return 'lights';
        if (assignment.video_role) return 'video';
        return 'unknown';
    };

    const getRoleFromAssignment = (assignment: StaffAssignment): string => {
        const role = assignment.sound_role || assignment.lights_role || assignment.video_role;
        return role ? (labelForCode(role) || role) : 'Técnico';
    };

    const getWeatherIcon = (condition: string) => {
        if (condition.toLowerCase().includes('sun')) return '☀️';
        if (condition.toLowerCase().includes('cloud')) return '☁️';
        if (condition.toLowerCase().includes('rain')) return '🌧️';
        if (condition.toLowerCase().includes('snow')) return '❄️';
        if (condition.toLowerCase().includes('storm')) return '⛈️';
        return '🌤️';
    };

    const formatWeatherDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('es-ES', { month: 'long', day: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${theme.modalOverlay} p-4 animate-in fade-in duration-200`}>
            <div className={`w-full max-w-md md:max-w-lg lg:max-w-xl h-[85vh] ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${theme.divider} shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200`}>

                {/* Header */}
                <div className={`p-4 border-b ${theme.divider} flex justify-between items-center shrink-0`}>
                    <div className="flex items-center gap-2">
                        <CalendarIcon size={18} className={theme.textMuted} />
                        <h2 className={`text-lg font-bold ${theme.textMain}`}>{job?.title || 'Sin título'}</h2>
                    </div>
                    <button onClick={onClose} className={`p-2 ${theme.textMuted} hover:${theme.textMain} rounded-full transition-colors`}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tab Bar */}
                <div className={`flex border-b ${theme.divider} ${isDark ? 'bg-[#0a0c10]' : 'bg-slate-50'} overflow-x-auto shrink-0`}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors
                ${activeTab === tab.id
                                    ? `${isDark ? 'bg-[#151820]' : 'bg-white'} ${theme.textMain} border-b-2 border-blue-500`
                                    : `${theme.textMuted} hover:${theme.textMain}`}
              `}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <ScrollArea className="flex-1 p-5 overflow-x-hidden">

                    {/* TAB: INFO */}
                    {activeTab === 'Info' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h1 className={`text-2xl font-bold ${theme.textMain} mb-4`}>{job?.title}</h1>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                    <div>
                                        <label className={`text-xs ${theme.textMuted} font-bold uppercase`}>Hora de inicio</label>
                                        <div className={`text-sm ${theme.textMain} mt-1 leading-relaxed`}>{jobStartDate}</div>
                                    </div>
                                    <div>
                                        <label className={`text-xs ${theme.textMuted} font-bold uppercase`}>Hora de finalización</label>
                                        <div className={`text-sm ${theme.textMain} mt-1 leading-relaxed`}>{jobEndDate}</div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className={`text-xs ${theme.textMuted} font-bold uppercase`}>Tipo de trabajo</label>
                                    <div className="mt-2">
                                        <span className={`px-3 py-1 rounded-full ${isDark ? 'bg-[#1a1d26] border-[#2a2e3b]' : 'bg-slate-100 border-slate-200'} border text-xs ${theme.textMain} font-medium`}>
                                            {jobType === 'multi_day' ? 'Varios días' : jobType === 'single' ? 'Un solo día' : jobType || 'Un solo día'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {job?.description && (
                                <div>
                                    <label className={`text-xs ${theme.textMuted} font-bold uppercase`}>Descripción</label>
                                    <p className={`text-sm ${theme.textMain} mt-2 leading-relaxed`}>{job.description}</p>
                                </div>
                            )}

                            {locationData && (
                                <div>
                                    <label className={`text-xs ${theme.textMuted} font-bold uppercase`}>Recinto</label>
                                    <div className={`text-sm ${theme.textMain} mt-1 leading-relaxed`}>
                                        {locationData?.name || 'Sin ubicación'}
                                    </div>
                                    {locationData?.formatted_address && (
                                        <div className={`text-xs ${theme.textMuted}`}>{locationData.formatted_address}</div>
                                    )}
                                </div>
                            )}

                            {!isDryhire && isManager && (
                                <div className={`flex items-start justify-between gap-3 p-4 rounded-xl border ${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={jobRatesApproved ? 'default' : 'secondary'}>
                                                {jobRatesApproved ? 'Tarifas aprobadas' : 'Aprobación necesaria'}
                                            </Badge>
                                            <span className={`text-xs ${theme.textMuted}`}>Controla la visibilidad de los pagos por trabajo para los técnicos</span>
                                        </div>
                                        {approvalStatus && approvalStatus.blockingReasons.length > 0 && (
                                            <div className={`text-xs ${theme.textMuted}`}>
                                                Pendiente: {approvalStatus.blockingReasons.join(', ')}
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        size="sm"
                                        disabled={isApproving || approvalStatusLoading}
                                        onClick={jobRatesApproved ? handleRevokeRates : handleApproveRates}
                                    >
                                        {isApproving ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : jobRatesApproved ? 'Revocar' : 'Aprobar'}
                                    </Button>
                                </div>
                            )}

                            {isManager && resolvedJobId && (
                                <div className={`${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border rounded-xl p-3`}>
                                    <h3 className={`text-sm font-semibold mb-3 ${theme.textMain}`}>Job Payout Totals</h3>
                                    <JobPayoutTotalsPanel jobId={resolvedJobId} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: UBICACIÓN */}
                    {activeTab === 'Ubicación' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            {jobDetailsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                </div>
                            ) : locationData ? (
                                <>
                                    <div className="flex justify-between items-start gap-3">
                                        <div>
                                            <h2 className={`text-lg font-bold ${theme.textMain}`}>{locationData?.name || 'Sin ubicación'}</h2>
                                            <p className={`text-sm ${theme.textMuted} mt-1 max-w-xs leading-relaxed`}>
                                                {locationData?.formatted_address || locationData?.address || 'Dirección no disponible'}
                                            </p>
                                        </div>
                                        <Button onClick={handleOpenMaps} size="sm" className="whitespace-nowrap">
                                            <MapIcon size={14} className="mr-2" /> Abrir mapas
                                        </Button>
                                    </div>

                                    {isMapLoading && (
                                        <div className={`rounded-xl overflow-hidden border ${theme.divider} h-48 ${isDark ? 'bg-[#0a0c10]' : 'bg-slate-100'} flex items-center justify-center`}>
                                            <div className="text-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                                                <p className={`text-sm ${theme.textMuted}`}>Cargando vista previa del mapa...</p>
                                            </div>
                                        </div>
                                    )}
                                    {!isMapLoading && mapPreviewUrl && (
                                        <div className={`rounded-xl overflow-hidden border ${theme.divider}`}>
                                            <img src={mapPreviewUrl} alt="Mapa del recinto" className="w-full h-auto" />
                                            <div className="p-3 flex justify-end">
                                                <Button size="sm" onClick={handleOpenMaps}>
                                                    Ver indicaciones
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    {!isMapLoading && !mapPreviewUrl && (
                                        <div className={`rounded-xl overflow-hidden border ${theme.divider} relative h-48 ${isDark ? 'bg-[#0a0c10]' : 'bg-slate-100'}`}>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="text-center">
                                                    <MapPin size={32} className={theme.textMuted} />
                                                    <p className={`text-xs ${theme.textMuted} mt-2`}>Vista previa del mapa no disponible</p>
                                                    <Button size="sm" onClick={handleOpenMaps} className="mt-3">
                                                        Abrir Google Maps
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className={`h-48 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
                                    <MapPin size={32} className="mb-2 opacity-50" />
                                    <span className="text-sm">No hay información de ubicación disponible</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: PERSONAL */}
                    {activeTab === 'Personal' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-2 mb-2">
                                <User size={18} className={theme.textMuted} />
                                <h3 className={`text-lg font-bold ${theme.textMain}`}>Personal asignado</h3>
                            </div>

                            {staffLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                </div>
                            ) : staffAssignments.length === 0 ? (
                                <div className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
                                    <User size={24} className="mb-2 opacity-50" />
                                    <span className="text-xs">No hay personal asignado</span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {(staffAssignments as StaffAssignment[]).map((assignment, idx) => {
                                        const tech = assignment.technician;
                                        const dept = getDepartmentFromAssignment(assignment);
                                        const role = getRoleFromAssignment(assignment);
                                        const deptColors: Record<string, string> = {
                                            sound: 'text-blue-400 bg-blue-900/30 border-blue-900/50',
                                            lights: 'text-amber-400 bg-amber-900/30 border-amber-900/50',
                                            video: 'text-purple-400 bg-purple-900/30 border-purple-900/50',
                                        };
                                        return (
                                            <div key={idx} className={`${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border rounded-lg p-4`}>
                                                <div className={`font-bold text-sm ${theme.textMain} mb-1`}>
                                                    {tech?.first_name} {tech?.last_name}
                                                </div>
                                                <div className={`text-xs ${theme.textMuted}`}>{role}</div>
                                                <div className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${deptColors[dept] || theme.textMuted}`}>
                                                    {dept}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: DOCS */}
                    {activeTab === 'Docs' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <FileText size={18} className={theme.textMuted} />
                                    <h3 className={`text-lg font-bold ${theme.textMain}`}>Documentos del trabajo</h3>
                                </div>

                                {(() => {
                                    const visibleDocs = (job?.job_documents || []).filter((d: JobDocument) =>
                                        canViewAllDocs ? true : d.visible_to_tech
                                    );
                                    return visibleDocs.length > 0 ? (
                                        <div className="space-y-2">
                                            {visibleDocs.map((doc) => (
                                                <div key={doc.id} className={`${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border rounded-lg p-4 flex items-center justify-between`}>
                                                    <div className="min-w-0 pr-4">
                                                        <div className={`text-sm font-bold ${theme.textMain} truncate mb-1`}>{doc.file_name}</div>
                                                        <div className={`text-xs ${theme.textMuted}`}>
                                                            {doc.uploaded_at && `Subido el ${format(new Date(doc.uploaded_at), "d 'de' MMMM 'de' yyyy", { locale: es })}`}
                                                        </div>
                                                        <div className="flex gap-1 mt-1 flex-wrap">
                                                            {doc.template_type === 'soundvision' && (
                                                                <Badge variant="outline" className="text-[10px]">SoundVision</Badge>
                                                            )}
                                                            {doc.read_only && (
                                                                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/50">Solo lectura</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleViewDocument(doc)}
                                                            disabled={documentLoading.has(doc.id)}
                                                        >
                                                            {documentLoading.has(doc.id) ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <Eye size={14} className="mr-1" /> Ver
                                                                </>
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDownload(doc)}
                                                            disabled={documentLoading.has(doc.id)}
                                                        >
                                                            {documentLoading.has(doc.id) ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <Download size={14} className="mr-1" /> Descargar
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
                                            <FileText size={24} className="mb-2 opacity-50" />
                                            <span className="text-xs">No hay documentos disponibles</span>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* TAB: RESTAU. */}
                    {activeTab === 'Restau.' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-2 mb-2">
                                <Utensils size={18} className={theme.textMuted} />
                                <h3 className={`text-lg font-bold ${theme.textMain}`}>Restaurantes cercanos</h3>
                            </div>

                            {(jobDetailsLoading || isRestaurantsLoading) ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                                    <p className={`text-sm ${theme.textMuted}`}>Buscando restaurantes cercanos...</p>
                                </div>
                            ) : restaurants && restaurants.length > 0 ? (
                                <div className="space-y-3">
                                    {restaurants.map((restaurant: Restaurant) => (
                                        <div key={restaurant.id} className={`p-4 rounded-xl border ${theme.card}`}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0 pr-3">
                                                    <p className={`font-bold text-sm ${theme.textMain} truncate`}>{restaurant.name}</p>
                                                    <p className={`text-xs ${theme.textMuted} mt-1 line-clamp-2`}>{restaurant.address}</p>

                                                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                        {restaurant.rating && (
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                                                                ⭐ {restaurant.rating}
                                                            </span>
                                                        )}
                                                        {restaurant.priceLevel !== undefined && (
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                {'€'.repeat(restaurant.priceLevel + 1)}
                                                            </span>
                                                        )}
                                                        {restaurant.distance && (
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                                                                A {Math.round(restaurant.distance)} m
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex gap-1 shrink-0">
                                                    {restaurant.phone && (
                                                        <a href={`tel:${restaurant.phone}`} className={`p-2 rounded-lg border ${theme.divider} hover:bg-white/5`}>
                                                            <Phone size={14} className={theme.textMuted} />
                                                        </a>
                                                    )}
                                                    {restaurant.website && (
                                                        <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className={`p-2 rounded-lg border ${theme.divider} hover:bg-white/5`}>
                                                            <Globe size={14} className={theme.textMuted} />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={`h-48 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
                                    <Utensils size={32} className="mb-2 opacity-50" />
                                    <span className="text-sm">
                                        {jobDetails?.locations?.formatted_address || jobDetails?.locations?.name
                                            ? "No se encontraron restaurantes cercanos"
                                            : "No hay dirección del recinto para buscar restaurantes"
                                        }
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={() => {
                                            const location = jobDetails?.locations?.formatted_address || jobDetails?.locations?.name || job?.location?.name || '';
                                            window.open(`https://www.google.com/maps/search/restaurants+near+${encodeURIComponent(location)}`, '_blank');
                                        }}
                                    >
                                        <Globe size={14} className="mr-2" /> Buscar en Google Maps
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: CLIMA */}
                    {activeTab === 'Clima' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <CloudRain size={18} className={theme.textMuted} />
                                    <h3 className={`text-lg font-bold ${theme.textMain}`}>Pronóstico del Tiempo</h3>
                                </div>
                                {!jobDetailsLoading && weatherVenue.address && eventDatesString && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={fetchWeather}
                                        disabled={isWeatherLoading}
                                    >
                                        {isWeatherLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                        ) : (
                                            <RefreshCw size={14} className="mr-1" />
                                        )}
                                        {isWeatherLoading ? 'Cargando...' : 'Actualizar'}
                                    </Button>
                                )}
                            </div>

                            {jobDetailsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                </div>
                            ) : !weatherVenue.address && !weatherVenue.coordinates ? (
                                <div className={`flex items-center gap-2 text-sm ${theme.textMuted} py-4`}>
                                    <AlertTriangle size={16} />
                                    El pronóstico del tiempo requiere ubicación del lugar
                                </div>
                            ) : !eventDatesString ? (
                                <div className={`flex items-center gap-2 text-sm ${theme.textMuted} py-4`}>
                                    <AlertTriangle size={16} />
                                    El pronóstico del tiempo requiere fechas del evento
                                </div>
                            ) : weatherError ? (
                                <div className={`flex items-center gap-2 text-sm py-4 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                                    <AlertTriangle size={16} />
                                    {weatherError}
                                </div>
                            ) : isWeatherLoading ? (
                                <div className={`flex items-center gap-2 text-sm ${theme.textMuted} py-4`}>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Obteniendo pronóstico del tiempo...
                                </div>
                            ) : weatherData && weatherData.length > 0 ? (
                                <div className="space-y-2">
                                    {weatherData.map((weather, index) => (
                                        <div key={index} className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{getWeatherIcon(weather.condition)}</span>
                                                <div>
                                                    <div className={`font-bold text-sm ${theme.textMain}`}>
                                                        {formatWeatherDate(weather.date)} – {weather.condition}
                                                    </div>
                                                    <div className={`text-xs ${theme.textMuted}`}>
                                                        {Math.round(weather.maxTemp)}°C / {Math.round(weather.minTemp)}°C
                                                        {weather.precipitationProbability > 0 && (
                                                            <span>, {weather.precipitationProbability}% lluvia</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <div className={`text-xs ${theme.textMuted} mt-4`}>
                                        <strong>Fuente:</strong> Los datos del tiempo se obtienen de Open-Meteo y se actualizan automáticamente.
                                    </div>
                                </div>
                            ) : (
                                <div className={`h-48 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
                                    <CloudRain size={32} className="mb-2 opacity-50" />
                                    <span className="text-sm text-center">
                                        Datos del tiempo no disponibles para las fechas y ubicación seleccionadas.
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={fetchWeather}
                                        disabled={isWeatherLoading}
                                    >
                                        <RefreshCw size={14} className="mr-2" /> Obtener pronóstico
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: TARIFAS */}
                    {activeTab === 'Tarifas' && showTourRatesTab && resolvedJobId && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-2 mb-2">
                                <Euro size={18} className={theme.textMuted} />
                                <h3 className={`text-lg font-bold ${theme.textMain}`}>Tarifas del Tour</h3>
                            </div>

                            <div className={`${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border rounded-lg p-4`}>
                                <TourRatesPanel
                                    jobId={resolvedJobId}
                                />
                            </div>
                        </div>
                    )}

                    {/* TAB: EXTRAS */}
                    {activeTab === 'Extras' && showExtrasTab && resolvedJobId && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-2 mb-2">
                                <Euro size={18} className={theme.textMuted} />
                                <h3 className={`text-lg font-bold ${theme.textMain}`}>Extras y Pagos</h3>
                            </div>

                            <div className={`${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border rounded-lg p-4`}>
                                <JobExtrasManagement jobId={resolvedJobId} />
                            </div>
                        </div>
                    )}

                </ScrollArea>
            </div>
        </div>
    );
};
