import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { Loader2, X, Calendar as CalendarIcon, MapPin, User, FileText, Eye, Download, Utensils, Phone, Globe, CloudRain, RefreshCw, AlertTriangle, Map as MapIcon, Users, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TourDocumentUploader } from '@/components/tours/TourDocumentUploader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Theme } from './types';
import { useWeatherData } from '@/hooks/useWeatherData';
import { PlacesRestaurantService } from '@/utils/hoja-de-ruta/services/places-restaurant-service';
import { createSignedUrl } from '@/utils/jobDocuments';
import { labelForCode } from '@/utils/roles';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import type { TourDocument } from '@/hooks/useTourDocuments';
import type { Restaurant, WeatherData } from '@/types/hoja-de-ruta';
import type { JobDocument, JobWithLocationAndDocs, StaffAssignment } from '@/types/job';

interface DetailsModalProps {
    theme: Theme;
    isDark: boolean;
    job: JobWithLocationAndDocs;
    onClose: () => void;
}

// (TourDocument type imported from useTourDocuments)

type TabId = 'Info' | 'Ubicación' | 'Transp.' | 'Personal' | 'Docs' | 'Restau.' | 'Clima';
type RiderFile = {
    id: string;
    file_name: string;
    file_path: string;
    uploaded_at: string;
    artist_id: string;
};
type FestivalStageName = {
    number: number;
    name: string;
};
type JobArtist = {
    id: string;
    name: string;
    stage: number | null;
};
type FestivalShiftAssignment = {
    id: string;
    role: string;
    shift_id: string | null;
};
type FestivalShiftInfo = {
    id: string;
    job_id: string | null;
    date: string;
    name: string;
    start_time: string;
    end_time: string;
    stage: number | null;
    department: string | null;
};
type TechShiftAssignmentDetail = {
    assignment_id: string;
    role: string;
    shift: FestivalShiftInfo;
};
type HojaDeRutaMeta = {
    id: string;
};
type HojaDeRutaRoomAssignment = {
    id: string;
    room_type: string;
    room_number: string | null;
    staff_member1_id: string | null;
    staff_member2_id: string | null;
};
type HojaDeRutaAccommodation = {
    id: string;
    hotel_name: string;
    address: string | null;
    check_in: string | null;
    check_out: string | null;
    hoja_de_ruta_room_assignments?: HojaDeRutaRoomAssignment[] | null;
};
type HojaDeRutaTravelArrangement = {
    id: string;
    transportation_type: string;
    pickup_address: string | null;
    pickup_time: string | null;
    departure_time: string | null;
    arrival_time: string | null;
    flight_train_number: string | null;
    driver_name: string | null;
    driver_phone: string | null;
    plate_number: string | null;
    notes: string | null;
};
type HojaDeRutaTransport = {
    id: string;
    transport_type: string;
    driver_name: string | null;
    driver_phone: string | null;
    license_plate: string | null;
    company: string | null;
    date_time: string | null;
    has_return: boolean | null;
    return_date_time: string | null;
    logistics_categories: string[] | null;
};
type RoomOccupantProfile = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    nickname: string | null;
};

export const DetailsModal = ({ theme, isDark, job, onClose }: DetailsModalProps) => {
    const { user, userRole } = useOptimizedAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabId>('Info');
    const [documentLoading, setDocumentLoading] = useState<Set<string>>(new Set());
    const [isUploadingTourDocument, setIsUploadingTourDocument] = useState(false);
    const [weatherData, setWeatherData] = useState<WeatherData[] | undefined>(undefined);
    const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
    const [isMapLoading, setIsMapLoading] = useState(false);

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

    const tourId: string | undefined =
        (jobDetails as { tour_id?: string } | null)?.tour_id ??
        (job as { tour_id?: string })?.tour_id;

    // Fetch staff assignments for this job
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
          technician:profiles(id, first_name, last_name, email, profile_picture_url)
        `)
                .eq('job_id', job.id)
                .eq('status', 'confirmed');
            if (error) throw error;
            return data || [];
        },
        enabled: !!job?.id,
    });

    // Fetch technician's assigned dates from timesheets
    const { data: assignedDates = [], isLoading: assignedDatesLoading } = useQuery({
        queryKey: ['tech-assigned-dates', job?.id, user?.id],
        queryFn: async () => {
            if (!job?.id || !user?.id) return [];
            const { data, error } = await supabase
                .from('timesheets')
                .select('date')
                .eq('job_id', job.id)
                .eq('technician_id', user.id)
                .eq('is_active', true)
                .order('date', { ascending: true });
            if (error) throw error;
            return data?.map(t => t.date) || [];
        },
        enabled: !!job?.id && !!user?.id,
    });

    // Fetch stage names (if this job has festival stages configured)
    const { data: festivalStages = [] } = useQuery({
        queryKey: ['technician-job-festival-stages', job?.id],
        queryFn: async () => {
            if (!job?.id) return [];
            const { data, error } = await supabase
                .from('festival_stages')
                .select('number, name')
                .eq('job_id', job.id);
            if (error) throw error;
            return (data || []) as FestivalStageName[];
        },
        enabled: !!job?.id,
    });

    // Fetch this technician's shift assignments for the job (used to enrich Info tab)
    const { data: techShiftAssignments = [], isLoading: techShiftAssignmentsLoading } = useQuery({
        queryKey: ['technician-job-shift-assignments', job?.id, user?.id],
        queryFn: async () => {
            if (!job?.id || !user?.id) return [];

            const { data: shifts, error: shiftsError } = await supabase
                .from('festival_shifts')
                .select('id, job_id, date, name, start_time, end_time, stage, department')
                .eq('job_id', job.id);

            if (shiftsError) throw shiftsError;

            const shiftIds = (shifts || []).map((shift) => shift.id);
            if (shiftIds.length === 0) return [];

            const { data: assignments, error: assignmentsError } = await supabase
                .from('festival_shift_assignments')
                .select('id, role, shift_id')
                .eq('technician_id', user.id)
                .in('shift_id', shiftIds);

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

    // Fetch job date types for this job
    const { data: jobDateTypes = [], isLoading: jobDateTypesLoading } = useQuery({
        queryKey: ['job-date-types', job?.id],
        queryFn: async () => {
            if (!job?.id) return [];
            const { data, error } = await supabase
                .from('job_date_types')
                .select('date, type')
                .eq('job_id', job.id);
            if (error) throw error;
            return data || [];
        },
        enabled: !!job?.id,
    });

    // Fetch tour documents (visible to technicians) when the job belongs to a tour
    const { data: tourDocuments = [], isLoading: tourDocumentsLoading } = useQuery({
        queryKey: ['tour-documents-for-job', tourId],
        queryFn: async () => {
            if (!tourId) return [];
            const { data, error } = await supabase
                .from('tour_documents')
                .select('id, file_name, file_path, uploaded_at, file_type')
                .eq('tour_id', tourId)
                .eq('visible_to_tech', true)
                .order('uploaded_at', { ascending: false });
            if (error) throw error;
            return (data || []) as TourDocument[];
        },
        enabled: !!tourId,
    });

    // Fetch artists linked to this job, then their rider files
    const { data: jobArtists = [], isLoading: isArtistsLoading, error: jobArtistsError } = useQuery({
        queryKey: ['technician-job-artists', job?.id],
        queryFn: async () => {
            if (!job?.id) return [];
            const { data, error } = await supabase
                .from('festival_artists')
                .select('id, name, stage')
                .eq('job_id', job.id);
            if (error) throw error;
            return (data || []) as JobArtist[];
        },
        enabled: !!job?.id,
    });

    const artistIdList = useMemo(() => jobArtists.map((artist) => artist.id), [jobArtists]);
    const artistNameMap = useMemo(() => new Map(jobArtists.map((artist) => [artist.id, artist.name])), [jobArtists]);
    const artistStageMap = useMemo(() => new Map(jobArtists.map((artist) => [artist.id, artist.stage])), [jobArtists]);

    const { data: riderFiles = [], isLoading: isRidersLoading, error: riderFilesError } = useQuery({
        queryKey: ['technician-job-rider-files', job?.id, artistIdList],
        queryFn: async () => {
            if (artistIdList.length === 0) return [];
            const { data, error } = await supabase
                .from('festival_artist_files')
                .select('id, file_name, file_path, uploaded_at, artist_id')
                .in('artist_id', artistIdList)
                .order('uploaded_at', { ascending: false });
            if (error) throw error;
            return (data || []) as RiderFile[];
        },
        enabled: artistIdList.length > 0,
    });

    // Fetch hoja de ruta metadata (if linked to this job)
    const { data: hojaDeRutaMeta, isLoading: hojaDeRutaLoading } = useQuery({
        queryKey: ['technician-hoja-de-ruta-meta', job?.id],
        queryFn: async () => {
            if (!job?.id) return null;
            const { data, error } = await supabase
                .from('hoja_de_ruta')
                .select('id')
                .eq('job_id', job.id)
                .maybeSingle();

            if (error) {
                console.warn('No se pudo cargar hoja de ruta para el técnico:', error.message);
                return null;
            }

            return data as HojaDeRutaMeta | null;
        },
        enabled: !!job?.id,
    });

    const hojaDeRutaId = hojaDeRutaMeta?.id || null;

    // Fetch accommodations + rooming from hoja de ruta
    const { data: hojaAccommodations = [], isLoading: hojaAccommodationsLoading } = useQuery({
        queryKey: ['technician-hoja-accommodations', hojaDeRutaId],
        queryFn: async () => {
            if (!hojaDeRutaId) return [];
            const { data, error } = await supabase
                .from('hoja_de_ruta_accommodations')
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
                .eq('hoja_de_ruta_id', hojaDeRutaId)
                .order('check_in', { ascending: true });

            if (error) {
                console.warn('No se pudo cargar alojamientos de hoja de ruta:', error.message);
                return [];
            }

            return (data || []) as HojaDeRutaAccommodation[];
        },
        enabled: !!hojaDeRutaId,
    });

    // Fetch travel arrangements from hoja de ruta
    const { data: hojaTravelArrangements = [], isLoading: hojaTravelLoading } = useQuery({
        queryKey: ['technician-hoja-travel-arrangements', hojaDeRutaId],
        queryFn: async () => {
            if (!hojaDeRutaId) return [];
            const { data, error } = await supabase
                .from('hoja_de_ruta_travel_arrangements')
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
                .eq('hoja_de_ruta_id', hojaDeRutaId)
                .order('pickup_time', { ascending: true });

            if (error) {
                console.warn('No se pudo cargar traslados de hoja de ruta:', error.message);
                return [];
            }

            return (data || []) as HojaDeRutaTravelArrangement[];
        },
        enabled: !!hojaDeRutaId,
    });

    // Fetch logistics transport from hoja de ruta
    const { data: hojaTransportEntries = [], isLoading: hojaTransportLoading } = useQuery({
        queryKey: ['technician-hoja-logistics-transport', hojaDeRutaId],
        queryFn: async () => {
            if (!hojaDeRutaId) return [];
            const { data, error } = await supabase
                .from('hoja_de_ruta_transport')
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
                .eq('hoja_de_ruta_id', hojaDeRutaId)
                .or('is_hoja_relevant.eq.true,is_hoja_relevant.is.null')
                .order('date_time', { ascending: true });

            if (error) {
                console.warn('No se pudo cargar transporte logístico de hoja de ruta:', error.message);
                return [];
            }

            return (data || []) as HojaDeRutaTransport[];
        },
        enabled: !!hojaDeRutaId,
    });

    // Fetch nearby restaurants using Google Places API
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

    // Weather data setup
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

    // Load static map preview
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

    const handleViewTourDocument = async (doc: TourDocument) => {
        const key = `tour:${doc.id}`;
        setDocumentLoading(prev => new Set(prev).add(key));
        try {
            const { data, error } = await supabase.storage
                .from('tour-documents')
                .createSignedUrl(doc.file_path, 60);
            if (error || !data?.signedUrl) {
                throw error || new Error('No se pudo generar la URL');
            }
            window.open(data.signedUrl, '_blank');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            toast.error(`No se pudo abrir el documento de gira: ${message}`);
        } finally {
            setDocumentLoading(prev => { const s = new Set(prev); s.delete(key); return s; });
        }
    };

    const handleDownloadTourDocument = async (doc: TourDocument) => {
        const key = `tour:${doc.id}`;
        setDocumentLoading(prev => new Set(prev).add(key));
        try {
            const { data, error } = await supabase.storage
                .from('tour-documents')
                .createSignedUrl(doc.file_path, 60);
            if (error || !data?.signedUrl) {
                throw error || new Error('No se pudo generar la URL');
            }
            const link = document.createElement('a');
            link.href = data.signedUrl;
            link.download = doc.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            toast.error(`No se pudo descargar el documento de gira: ${message}`);
        } finally {
            setDocumentLoading(prev => { const s = new Set(prev); s.delete(key); return s; });
        }
    };

    const handleViewRider = async (file: RiderFile) => {
        const key = `rider:${file.id}`;
        setDocumentLoading(prev => new Set(prev).add(key));
        try {
            const { data, error } = await supabase.storage
                .from('festival_artist_files')
                .createSignedUrl(file.file_path, 60);
            if (error || !data?.signedUrl) {
                throw error || new Error('No se pudo generar la URL');
            }
            window.open(data.signedUrl, '_blank');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            toast.error(`No se pudo abrir el rider: ${message}`);
        } finally {
            setDocumentLoading(prev => { const s = new Set(prev); s.delete(key); return s; });
        }
    };

    const handleDownloadRider = async (file: RiderFile) => {
        const key = `rider:${file.id}`;
        setDocumentLoading(prev => new Set(prev).add(key));
        try {
            const { data, error } = await supabase.storage
                .from('festival_artist_files')
                .download(file.file_path);
            if (error || !data) {
                throw error || new Error('No se pudo descargar el archivo');
            }

            const url = window.URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            toast.error(`No se pudo descargar el rider: ${message}`);
        } finally {
            setDocumentLoading(prev => { const s = new Set(prev); s.delete(key); return s; });
        }
    };

    const handleOpenMaps = () => {
        const address = jobDetails?.locations?.formatted_address || jobDetails?.locations?.name || job?.location?.name || '';
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        window.open(url, '_blank');
    };

    const handleOpenAddressInMaps = (address: string) => {
        if (!address) return;
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

    const tabs: { id: TabId; label: string }[] = [
        { id: 'Info', label: 'Info' },
        { id: 'Ubicación', label: 'Ubicación' },
        { id: 'Transp.', label: 'Transp.' },
        { id: 'Personal', label: 'Personal' },
        { id: 'Docs', label: 'Docs' },
        { id: 'Restau.', label: 'Restau.' },
        { id: 'Clima', label: 'Clima' },
    ];

    // Get department badge for staff
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

    // Get date type label in Spanish
    const getDateTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
            'travel': 'Viaje',
            'setup': 'Montaje',
            'rigging': 'Rigging',
            'show': 'Show',
            'off': 'Descanso',
            'rehearsal': 'Ensayo'
        };
        return labels[type] || type;
    };

    // Get date type badge color
    const getDateTypeBadgeClass = (type: string): string => {
        const colors: Record<string, string> = {
            'travel': isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-200',
            'setup': isDark ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200',
            'rigging': isDark ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-200',
            'show': isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
            'off': isDark ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' : 'bg-slate-100 text-slate-700 border-slate-200',
            'rehearsal': isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-700 border-amber-200'
        };
        return colors[type] || (isDark ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' : 'bg-slate-100 text-slate-700 border-slate-200');
    };

    // Memoized map for O(1) date type lookup
    const dateTypeMap = useMemo(() => {
        const map = new Map<string, string>();
        jobDateTypes.forEach(dt => map.set(dt.date, dt.type));
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
        (staffAssignments as StaffAssignment[]).forEach((assignment, index) => {
            const tech = assignment.technician;
            if (!tech?.id) return;
            const fullName = [tech.first_name, tech.last_name]
                .filter((value): value is string => Boolean(value && value.trim()))
                .join(' ');
            map.set(tech.id, fullName || tech.email || `Técnico ${index + 1}`);
        });
        return map;
    }, [staffAssignments]);

    const assignedTechIdByIndex = useMemo(() => {
        const map = new Map<string, string>();
        (staffAssignments as StaffAssignment[]).forEach((assignment, index) => {
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

    const isUuidLike = (value: string): boolean =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    const roomStaffProfileIds = useMemo(
        () => roomStaffIds.filter((id) => isUuidLike(id)),
        [roomStaffIds]
    );

    const { data: roomOccupantProfiles = [], isLoading: roomOccupantsLoading } = useQuery({
        queryKey: ['technician-hoja-room-occupants', roomStaffProfileIds],
        queryFn: async () => {
            if (roomStaffProfileIds.length === 0) return [];
            const { data, error } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, nickname')
                .in('id', roomStaffProfileIds);

            if (error) {
                console.warn('No se pudieron cargar perfiles de rooming:', error.message);
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
                .join(' ');
            map.set(profile.id, fullName || profile.nickname || 'Técnico');
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
        if (!normalizedId) return 'Sin asignar';

        const mappedName = roomOccupantNameMap.get(normalizedId);
        if (mappedName) return mappedName;

        if (rawId && /^\d+$/.test(rawId)) {
            const byIndex = (staffAssignments as StaffAssignment[])[Number(rawId)]?.technician;
            if (byIndex) {
                const fullName = [byIndex.first_name, byIndex.last_name]
                    .filter((value): value is string => Boolean(value && value.trim()))
                    .join(' ');
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
            ])
        );
    }, [hojaAccommodations, normalizeRoomOccupantId, resolveRoomOccupantName]);

    const formatShiftTime = (value?: string | null): string => {
        if (!value) return '';
        const trimmed = value.trim();
        if (trimmed.length >= 5 && trimmed.includes(':')) return trimmed.slice(0, 5);
        return trimmed;
    };

    const formatDateTimeLabel = (value?: string | null): string => {
        if (!value) return 'Pendiente';

        const trimmed = value.trim();
        if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
            return trimmed.slice(0, 5);
        }

        try {
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return value;
            return format(parsed, "d 'de' MMM yyyy, HH:mm", { locale: es });
        } catch {
            return value;
        }
    };

    const formatTransportCategory = (category: string): string => {
        return category.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const getTravelTransportTypeLabel = (type?: string | null): string => {
        const labels: Record<string, string> = {
            van: 'Furgoneta',
            sleeper_bus: 'Autobús cama',
            train: 'Tren',
            plane: 'Avión',
            rv: 'Autocaravana',
        };
        if (!type) return 'Transporte';
        return labels[type] || formatTransportCategory(type);
    };

    const getLogisticsTransportTypeLabel = (type?: string | null): string => {
        const labels: Record<string, string> = {
            trailer: 'Tráiler',
            '9m': 'Camión 9m',
            '8m': 'Camión 8m',
            '6m': 'Camión 6m',
            '4m': 'Camión 4m',
            furgoneta: 'Furgoneta',
            rv: 'Autocaravana',
        };
        if (!type) return 'Transporte';
        return labels[type] || formatTransportCategory(type);
    };

    const formatCompanyLabel = (company?: string | null): string => {
        if (!company) return 'Pendiente';
        const labels: Record<string, string> = {
            pantoja: 'Pantoja',
            transluminaria: 'Transluminaria',
            transcamarena: 'Transcamarena',
            camionaje: 'Camionaje',
            sector_pro: 'Sector Pro',
            other: 'Otra',
            'wild tour': 'Wild Tour',
        };
        return labels[company] || formatTransportCategory(company);
    };

    const getRoomOccupantsLabel = (room: HojaDeRutaRoomAssignment): string => {
        const occupants = [room.staff_member1_id, room.staff_member2_id]
            .filter((id): id is string => Boolean(id))
            .map((id) => resolveRoomOccupantName(id));
        return occupants.length > 0 ? occupants.join(' · ') : 'Sin ocupantes asignados';
    };

    const formatRoomTypeLabel = (roomType?: string | null): string => {
        const labels: Record<string, string> = {
            single: 'Individual',
            double: 'Doble',
            twin: 'Twin',
            triple: 'Triple',
        };
        if (!roomType) return 'Habitación';
        return labels[roomType] || roomType;
    };

    const hasHojaAccommodationData = hojaAccommodations.length > 0;
    const hasHojaTransportData = hojaTravelArrangements.length > 0 || hojaTransportEntries.length > 0;
    const isTransportDataLoading = hojaDeRutaLoading || hojaTravelLoading || hojaTransportLoading;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${theme.modalOverlay} px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200`}>
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

                {/* Content Area */}
                <ScrollArea className="flex-1 p-5">

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
                                            {job?.job_type === 'multi_day' ? 'Varios días' : job?.job_type === 'single' ? 'Un solo día' : job?.job_type || 'Un solo día'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Assigned Dates */}
                            {user?.id && (
                                <div>
                                    <label className={`text-xs ${theme.textMuted} font-bold uppercase mb-2 block`}>Mis fechas asignadas</label>
                                    {assignedDatesLoading || jobDateTypesLoading || techShiftAssignmentsLoading ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                            <span className={theme.textMuted}>Cargando fechas...</span>
                                        </div>
                                    ) : allAssignedDates.length > 0 ? (
                                        <div className="space-y-2">
                                            {allAssignedDates.map((date) => {
                                                const dateTypeValue = dateTypeMap.get(date);
                                                const dateShiftAssignments = techShiftAssignmentsByDate.get(date) || [];
                                                return (
                                                    <div
                                                        key={date}
                                                        className={`p-3 rounded-lg ${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <CalendarIcon size={14} className={theme.textMuted} />
                                                                <span className={`text-sm font-medium ${theme.textMain}`}>
                                                                    {formatInTimeZone(parseISO(date), 'Europe/Madrid', "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                                                                </span>
                                                            </div>
                                                            {dateTypeValue && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`text-xs font-bold border ${getDateTypeBadgeClass(dateTypeValue)}`}
                                                                >
                                                                    {getDateTypeLabel(dateTypeValue)}
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        {dateShiftAssignments.length > 0 && (
                                                            <div className="mt-2 pl-6 space-y-1">
                                                                {dateShiftAssignments.map((assignment) => {
                                                                    const stageLabel = assignment.shift.stage != null
                                                                        ? (festivalStageNameMap.get(assignment.shift.stage) || `Escenario ${assignment.shift.stage}`)
                                                                        : 'Escenario sin definir';
                                                                    const roleLabel = labelForCode(assignment.role) || assignment.role;
                                                                    const timeRange = `${formatShiftTime(assignment.shift.start_time)} - ${formatShiftTime(assignment.shift.end_time)}`;

                                                                    return (
                                                                        <div
                                                                            key={assignment.assignment_id}
                                                                            className="flex flex-wrap items-center gap-1.5"
                                                                        >
                                                                            <span className={`text-xs font-semibold ${theme.textMain}`}>
                                                                                {assignment.shift.name}
                                                                            </span>
                                                                            <span className={`text-[11px] ${theme.textMuted}`}>{timeRange}</span>
                                                                            <Badge variant="outline" className="text-[10px]">
                                                                                {stageLabel}
                                                                            </Badge>
                                                                            <Badge variant="outline" className="text-[10px]">
                                                                                {roleLabel}
                                                                            </Badge>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className={`text-sm ${theme.textMuted} italic`}>
                                            No hay fechas asignadas para este trabajo
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Accommodation + Rooming (Hoja de Ruta) */}
                            {(hojaDeRutaLoading || hojaAccommodationsLoading || hasHojaAccommodationData) && (
                                <div>
                                    <label className={`text-xs ${theme.textMuted} font-bold uppercase mb-2 block`}>Alojamiento y rooming</label>

                                    {hojaDeRutaLoading || hojaAccommodationsLoading ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                            <span className={theme.textMuted}>Cargando alojamiento...</span>
                                        </div>
                                    ) : hasHojaAccommodationData ? (
                                        <div className="space-y-3">
                                            {hojaAccommodations.map((accommodation) => {
                                                const rooms = accommodation.hoja_de_ruta_room_assignments || [];
                                                return (
                                                    <div
                                                        key={accommodation.id}
                                                        className={`p-3 rounded-lg ${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className={`text-sm font-semibold ${theme.textMain}`}>
                                                                    {accommodation.hotel_name}
                                                                </div>
                                                                {accommodation.address && (
                                                                    <div className={`text-xs ${theme.textMuted} mt-1`}>
                                                                        {accommodation.address}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {accommodation.address && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleOpenAddressInMaps(accommodation.address || '')}
                                                                >
                                                                    <MapPin size={12} className="mr-1" /> Mapa
                                                                </Button>
                                                            )}
                                                        </div>

                                                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            <div>
                                                                <div className={`text-[11px] uppercase font-semibold ${theme.textMuted}`}>Check-in</div>
                                                                <div className={`text-xs ${theme.textMain}`}>{formatDateTimeLabel(accommodation.check_in)}</div>
                                                            </div>
                                                            <div>
                                                                <div className={`text-[11px] uppercase font-semibold ${theme.textMuted}`}>Check-out</div>
                                                                <div className={`text-xs ${theme.textMain}`}>{formatDateTimeLabel(accommodation.check_out)}</div>
                                                            </div>
                                                        </div>

                                                        {rooms.length > 0 ? (
                                                            <div className={`mt-3 pt-3 border-t ${theme.divider} space-y-1.5`}>
                                                                {rooms.map((room) => (
                                                                        <div key={room.id} className="text-xs">
                                                                            <div className={`font-medium ${theme.textMain}`}>
                                                                            {formatRoomTypeLabel(room.room_type)}{room.room_number ? ` · ${room.room_number}` : ''}
                                                                            </div>
                                                                            <div className={theme.textMuted}>{getRoomOccupantsLabel(room)}</div>
                                                                        </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className={`mt-3 text-xs ${theme.textMuted} italic`}>
                                                                Sin habitaciones asignadas todavía
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {roomStaffIds.length > 0 && roomOccupantsLoading && (
                                                <div className="flex items-center gap-2 text-xs">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                                                    <span className={theme.textMuted}>Resolviendo nombres de rooming...</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            {/* Description */}
                            {job?.description && (
                                <div>
                                    <label className={`text-xs ${theme.textMuted} font-bold uppercase`}>Descripción</label>
                                    <p className={`text-sm ${theme.textMain} mt-2 leading-relaxed`}>{job.description}</p>
                                </div>
                            )}

                            {/* Location Snippet */}
                            <div>
                                <label className={`text-xs ${theme.textMuted} font-bold uppercase`}>Recinto</label>
                                <div className={`text-sm ${theme.textMain} mt-1 leading-relaxed`}>
                                    {job?.location?.name || 'Sin ubicación'}
                                </div>
                            </div>
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
                                    <div className="flex justify-between items-start">
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

                                    {/* Map Preview */}
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
                                            <img
                                                src={mapPreviewUrl}
                                                alt="Mapa del recinto"
                                                width={600}
                                                height={300}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full h-auto"
                                            />
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

                    {/* TAB: TRANSP. */}
                    {activeTab === 'Transp.' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-2 mb-2">
                                <Car size={18} className={theme.textMuted} />
                                <h3 className={`text-lg font-bold ${theme.textMain}`}>Transporte</h3>
                            </div>

                            {isTransportDataLoading ? (
                                <div className="flex items-center gap-2 text-sm py-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                    <span className={theme.textMuted}>Cargando detalles de transporte...</span>
                                </div>
                            ) : !hojaDeRutaId ? (
                                <div className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
                                    <span className="text-xs text-center px-4">
                                        Este trabajo no tiene hoja de ruta vinculada.
                                    </span>
                                </div>
                            ) : !hasHojaTransportData ? (
                                <div className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
                                    <span className="text-xs text-center px-4">
                                        No hay detalles de transporte disponibles en la hoja de ruta.
                                    </span>
                                </div>
                            ) : (
                                <>
                                    {hojaTravelArrangements.length > 0 && (
                                        <div>
                                            <label className={`text-xs ${theme.textMuted} font-bold uppercase mb-2 block`}>
                                                Traslados de viaje ({hojaTravelArrangements.length})
                                            </label>
                                            <div className="space-y-2">
                                                {hojaTravelArrangements.map((travel) => {
                                                    const missingCoreDetails = [
                                                        travel.pickup_time,
                                                        travel.departure_time,
                                                        travel.arrival_time,
                                                        travel.pickup_address,
                                                    ].filter((value) => !value).length;

                                                    return (
                                                        <div
                                                            key={travel.id}
                                                            className={`${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border rounded-lg p-3`}
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className={`text-sm font-semibold ${theme.textMain}`}>
                                                                    {getTravelTransportTypeLabel(travel.transportation_type)}
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    {travel.pickup_time && (
                                                                        <Badge variant="outline" className="text-[10px]">
                                                                            {formatDateTimeLabel(travel.pickup_time)}
                                                                        </Badge>
                                                                    )}
                                                                    {missingCoreDetails >= 3 && (
                                                                        <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">
                                                                            Pendiente de confirmar
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                                <div>
                                                                    <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>Punto de recogida</div>
                                                                    <div className={theme.textMain}>{travel.pickup_address || 'Pendiente'}</div>
                                                                </div>
                                                                <div>
                                                                    <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>Referencia</div>
                                                                    <div className={theme.textMain}>{travel.flight_train_number || 'Pendiente'}</div>
                                                                </div>
                                                                <div>
                                                                    <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>Hora salida</div>
                                                                    <div className={theme.textMain}>{formatDateTimeLabel(travel.departure_time)}</div>
                                                                </div>
                                                                <div>
                                                                    <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>Hora llegada</div>
                                                                    <div className={theme.textMain}>{formatDateTimeLabel(travel.arrival_time)}</div>
                                                                </div>
                                                                <div>
                                                                    <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>Conductor</div>
                                                                    <div className={theme.textMain}>{travel.driver_name || 'Pendiente'}</div>
                                                                </div>
                                                                <div>
                                                                    <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>Contacto</div>
                                                                    <div className={theme.textMain}>{travel.driver_phone || 'Pendiente'}</div>
                                                                </div>
                                                                <div>
                                                                    <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>Matrícula</div>
                                                                    <div className={theme.textMain}>{travel.plate_number || 'Pendiente'}</div>
                                                                </div>
                                                            </div>

                                                            {(travel.pickup_address || travel.notes) && (
                                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                    {travel.pickup_address && (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => handleOpenAddressInMaps(travel.pickup_address || '')}
                                                                        >
                                                                            <MapPin size={12} className="mr-1" /> Ver recogida
                                                                        </Button>
                                                                    )}
                                                                    {travel.notes && (
                                                                        <span className={`text-xs ${theme.textMuted}`}>
                                                                            Nota: <span className={theme.textMain}>{travel.notes}</span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {hojaTransportEntries.length > 0 && (
                                        <div>
                                            <label className={`text-xs ${theme.textMuted} font-bold uppercase mb-2 block`}>
                                                Transporte logístico ({hojaTransportEntries.length})
                                            </label>
                                            <div className="space-y-2">
                                                {hojaTransportEntries.map((transport) => (
                                                    <div
                                                        key={transport.id}
                                                        className={`${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border rounded-lg p-3`}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className={`text-sm font-semibold ${theme.textMain}`}>
                                                                {getLogisticsTransportTypeLabel(transport.transport_type)}
                                                            </div>
                                                            <Badge variant="outline" className="text-[10px]">
                                                                {formatDateTimeLabel(transport.date_time)}
                                                            </Badge>
                                                        </div>

                                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>Empresa</div>
                                                                <div className={theme.textMain}>{formatCompanyLabel(transport.company)}</div>
                                                            </div>
                                                            <div>
                                                                <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>Conductor</div>
                                                                <div className={theme.textMain}>{transport.driver_name || 'Pendiente'}</div>
                                                            </div>
                                                            <div>
                                                                <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>Contacto</div>
                                                                <div className={theme.textMain}>{transport.driver_phone || 'Pendiente'}</div>
                                                            </div>
                                                            <div>
                                                                <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>Matrícula</div>
                                                                <div className={theme.textMain}>{transport.license_plate || 'Pendiente'}</div>
                                                            </div>
                                                            <div>
                                                                <div className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>Vuelta</div>
                                                                <div className={theme.textMain}>
                                                                    {transport.has_return ? formatDateTimeLabel(transport.return_date_time) : 'No'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {transport.logistics_categories && transport.logistics_categories.length > 0 && (
                                                            <div className="mt-2 flex flex-wrap gap-1">
                                                                {transport.logistics_categories.map((category) => (
                                                                    <Badge key={`${transport.id}-${category}`} variant="outline" className="text-[10px]">
                                                                        {formatTransportCategory(category)}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
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
                                        const roomieNames = tech?.id ? (roomieNamesByTechId.get(tech.id) || []) : [];
                                        const deptColors: Record<string, string> = {
                                            sound: 'text-blue-400 bg-blue-900/30 border-blue-900/50',
                                            lights: 'text-amber-400 bg-amber-900/30 border-amber-900/50',
                                            video: 'text-purple-400 bg-purple-900/30 border-purple-900/50',
                                        };
                                        return (
                                            <div key={idx} className={`${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border rounded-lg p-4 flex items-start gap-3`}>
                                                <Avatar className="h-12 w-12 shrink-0">
                                                    {tech?.profile_picture_url && (
                                                        <AvatarImage
                                                            src={tech.profile_picture_url}
                                                            alt={`${tech.first_name} ${tech.last_name}`}
                                                        />
                                                    )}
                                                    <AvatarFallback className="text-sm">
                                                        {`${tech?.first_name?.[0] || ''}${tech?.last_name?.[0] || ''}`.toUpperCase() || 'T'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1">
                                                    <div className={`font-bold text-sm ${theme.textMain} mb-1`}>
                                                        {tech?.first_name} {tech?.last_name}
                                                    </div>
                                                    <div className={`text-xs ${theme.textMuted}`}>{role}</div>
                                                    <div className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${deptColors[dept] || theme.textMuted}`}>
                                                        {dept}
                                                    </div>
                                                    {roomieNames.length > 0 && (
                                                        <div className="mt-2">
                                                            <Badge variant="outline" className="text-[10px]">
                                                                Roomie: {roomieNames.join(' · ')}
                                                            </Badge>
                                                        </div>
                                                    )}
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

                                {job?.job_documents && job.job_documents.filter((d: JobDocument) => d.visible_to_tech).length > 0 ? (
                                    <div className="space-y-2">
                                        {job.job_documents.filter((d: JobDocument) => d.visible_to_tech).map((doc) => (
                                            <div
                                                key={doc.id}
                                                className={`${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border rounded-lg p-3`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div
                                                            className={`text-sm font-bold ${theme.textMain} leading-snug break-words line-clamp-2 mb-1`}
                                                            title={doc.file_name}
                                                        >
                                                            {doc.file_name}
                                                        </div>
                                                        <div className={`text-xs ${theme.textMuted}`}>
                                                            {doc.uploaded_at && `Subido el ${format(new Date(doc.uploaded_at), "d 'de' MMMM 'de' yyyy", { locale: es })}`}
                                                        </div>
                                                        {(doc.template_type === 'soundvision' || doc.read_only) && (
                                                            <div className="flex gap-1 mt-1 flex-wrap">
                                                                {doc.template_type === 'soundvision' && (
                                                                    <Badge variant="outline" className="text-[10px]">SoundVision</Badge>
                                                                )}
                                                                {doc.read_only && (
                                                                    <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/50">Solo lectura</Badge>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-3 shrink-0">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleViewDocument(doc)}
                                                            disabled={documentLoading.has(doc.id)}
                                                            className="h-10 w-10 p-0"
                                                            title={`Ver ${doc.file_name}`}
                                                            aria-label={`Ver ${doc.file_name}`}
                                                        >
                                                            {documentLoading.has(doc.id) ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Eye size={18} />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleDownload(doc)}
                                                            disabled={documentLoading.has(doc.id)}
                                                            className="h-10 w-10 p-0"
                                                            title={`Descargar ${doc.file_name}`}
                                                            aria-label={`Descargar ${doc.file_name}`}
                                                        >
                                                            {documentLoading.has(doc.id) ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Download size={18} />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
                                        <FileText size={24} className="mb-2 opacity-50" />
                                        <span className="text-xs">No hay documentos disponibles</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Users size={18} className={theme.textMuted} />
                                    <h3 className={`text-lg font-bold ${theme.textMain}`}>Riders de artistas</h3>
                                </div>

                                {(jobArtistsError || riderFilesError) && (
                                    <div className={`mb-3 rounded-lg border p-3 ${theme.danger}`}>
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <AlertTriangle size={14} />
                                            No se pudieron cargar todos los riders
                                        </div>
                                    </div>
                                )}

                                {isArtistsLoading || isRidersLoading ? (
                                    <div className="flex items-center justify-center py-6">
                                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                    </div>
                                ) : jobArtists.length === 0 ? (
                                    <div className={`h-24 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
                                        <span className="text-xs">No hay artistas asociados a este trabajo</span>
                                    </div>
                                ) : riderFiles.length > 0 ? (
                                    <div className="space-y-2">
                                        {riderFiles.map((file) => {
                                            const key = `rider:${file.id}`;
                                            const artistStageNumber = artistStageMap.get(file.artist_id);
                                            const artistStageLabel = artistStageNumber != null
                                                ? (festivalStageNameMap.get(artistStageNumber) || `Escenario ${artistStageNumber}`)
                                                : 'Escenario sin definir';
                                            return (
                                                <div
                                                    key={file.id}
                                                    className={`${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border rounded-lg p-3`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div
                                                                className={`text-sm font-bold ${theme.textMain} leading-snug break-words line-clamp-2 mb-1`}
                                                                title={file.file_name}
                                                            >
                                                                {file.file_name}
                                                            </div>
                                                            <div className={`text-xs ${theme.textMuted}`}>
                                                                Artista: {artistNameMap.get(file.artist_id) || 'Desconocido'}
                                                            </div>
                                                            <div className="mt-1">
                                                                <Badge variant="outline" className="text-[10px]">
                                                                    {artistStageLabel}
                                                                </Badge>
                                                            </div>
                                                            <div className={`text-xs ${theme.textMuted}`}>
                                                                {file.uploaded_at && `Subido el ${format(new Date(file.uploaded_at), "d 'de' MMMM 'de' yyyy", { locale: es })}`}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-3 shrink-0">
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() => handleViewRider(file)}
                                                                disabled={documentLoading.has(key)}
                                                                className="h-10 w-10 p-0"
                                                                title={`Ver ${file.file_name}`}
                                                                aria-label={`Ver ${file.file_name}`}
                                                            >
                                                                {documentLoading.has(key) ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Eye size={18} />
                                                                )}
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() => handleDownloadRider(file)}
                                                                disabled={documentLoading.has(key)}
                                                                className="h-10 w-10 p-0"
                                                                title={`Descargar ${file.file_name}`}
                                                                aria-label={`Descargar ${file.file_name}`}
                                                            >
                                                                {documentLoading.has(key) ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Download size={18} />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className={`h-24 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
                                        <span className="text-xs">
                                            No hay riders subidos para los {jobArtists.length} {jobArtists.length === 1 ? 'artista' : 'artistas'} asociados
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Tour docs entrypoint (A+B): allows eventual techs to access tour docs from the job */}
                            {tourId ? (
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2">
                                            <FileText size={18} className={theme.textMuted} />
                                            <h3 className={`text-lg font-bold ${theme.textMain}`}>Documentos de la gira</h3>
                                        </div>

                                        {['technician', 'house_tech'].includes(userRole || '') ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsUploadingTourDocument((v) => !v)}
                                            >
                                                {isUploadingTourDocument ? 'Cancelar' : 'Añadir'}
                                            </Button>
                                        ) : null}
                                    </div>

                                    {isUploadingTourDocument && ['technician', 'house_tech'].includes(userRole || '') ? (
                                        <div className={`${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border rounded-lg p-3 mb-3`}>
                                            <TourDocumentUploader
                                                tourId={tourId}
                                                onSuccess={() => {
                                                    setIsUploadingTourDocument(false);
                                                    queryClient.invalidateQueries({ queryKey: ['tour-documents-for-job', tourId] });
                                                }}
                                                onCancel={() => setIsUploadingTourDocument(false)}
                                            />
                                        </div>
                                    ) : null}

                                    {tourDocumentsLoading ? (
                                        <div className="flex items-center justify-center py-6">
                                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                        </div>
                                    ) : tourDocuments.length > 0 ? (
                                        <div className="space-y-2">
                                            {tourDocuments.map((doc) => {
                                                const key = `tour:${doc.id}`;
                                                return (
                                                    <div
                                                        key={doc.id}
                                                        className={`${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'} border rounded-lg p-3`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="min-w-0 flex-1">
                                                                <div
                                                                    className={`text-sm font-bold ${theme.textMain} leading-snug break-words line-clamp-2 mb-1`}
                                                                    title={doc.file_name}
                                                                >
                                                                    {doc.file_name}
                                                                </div>
                                                                <div className={`text-xs ${theme.textMuted}`}>
                                                                    {doc.uploaded_at && `Subido el ${format(new Date(doc.uploaded_at), "d 'de' MMMM 'de' yyyy", { locale: es })}`}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-3 shrink-0">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleViewTourDocument(doc)}
                                                                    disabled={documentLoading.has(key)}
                                                                    className="h-10 w-10 p-0"
                                                                    title={`Ver ${doc.file_name}`}
                                                                    aria-label={`Ver ${doc.file_name}`}
                                                                >
                                                                    {documentLoading.has(key) ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Eye size={18} />
                                                                    )}
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleDownloadTourDocument(doc)}
                                                                    disabled={documentLoading.has(key)}
                                                                    className="h-10 w-10 p-0"
                                                                    title={`Descargar ${doc.file_name}`}
                                                                    aria-label={`Descargar ${doc.file_name}`}
                                                                >
                                                                    {documentLoading.has(key) ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Download size={18} />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
                                            <FileText size={24} className="mb-2 opacity-50" />
                                            <span className="text-xs">No hay documentos de gira visibles</span>
                                        </div>
                                    )}
                                </div>
                            ) : null}
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
                                    {weatherData.map((weather, index) => {
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
                                        );
                                    })}

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

                </ScrollArea>
            </div>
        </div>
    );
};
