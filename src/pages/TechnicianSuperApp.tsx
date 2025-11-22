import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useMyTours } from '@/hooks/useMyTours';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { useTechnicianDashboardSubscriptions } from '@/hooks/useMobileRealtimeSubscriptions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format, addWeeks, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { getCategoryFromAssignment } from '@/utils/roleCategory';
import { labelForCode } from '@/utils/roles';
import { createSignedUrl } from '@/utils/jobDocuments';
import { PlacesRestaurantService } from '@/utils/hoja-de-ruta/services/places-restaurant-service';
import { useWeatherData } from '@/hooks/useWeatherData';
import type { Restaurant, WeatherData } from '@/types/hoja-de-ruta';
import { OBLIQUE_STRATEGIES, type ObliqueStrategy } from '@/components/technician/obliqueStrategies';

import {
  LayoutDashboard, Calendar as CalendarIcon, User, Menu,
  MapPin, Clock, ChevronRight, FileText, CheckCircle2,
  AlertTriangle, PenTool, X, ArrowRight, Sun, Moon,
  Gamepad2, MessageSquare, Ban, Wallet, ChevronLeft,
  MoreVertical, Plus, Trash2, Palmtree, Coffee, LogOut,
  Shield, Bell, Lock, Smartphone, Mail, Phone, CreditCard,
  Check, Camera, Palette, Navigation, Utensils, CloudRain,
  Download, Send, RefreshCw, UploadCloud, Play, Sliders,
  Radio, Mic2, Speaker, ListMusic, Save, ArrowLeft, Activity,
  Search, Filter, Map, Layers, Globe, LayoutList, LayoutGrid,
  Loader2, Eye, Briefcase, Shuffle, Lightbulb, Sparkles, Users
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TechnicianIncidentReportDialog } from '@/components/incident-reports/TechnicianIncidentReportDialog';
import { JobDetailsDialog } from '@/components/jobs/JobDetailsDialog';
import { MessageManagementDialog } from '@/components/technician/MessageManagementDialog';

// --- THEME STYLES (using next-themes compatible approach) ---
const getThemeStyles = (isDark: boolean) => ({
  bg: isDark ? "bg-[#05070a]" : "bg-slate-50",
  nav: isDark ? "bg-[#0f1219] border-t border-[#1f232e]" : "bg-white border-t border-slate-200",
  card: isDark ? "bg-[#0f1219] border-[#1f232e]" : "bg-white border-slate-200 shadow-sm",
  textMain: isDark ? "text-white" : "text-slate-900",
  textMuted: isDark ? "text-[#94a3b8]" : "text-slate-500",
  accent: "bg-blue-600 hover:bg-blue-500 text-white",
  input: isDark ? "bg-[#0a0c10] border-[#2a2e3b] text-white focus:border-blue-500" : "bg-white border-slate-300 text-slate-900 focus:border-blue-500",
  modalOverlay: isDark ? "bg-black/90 backdrop-blur-md" : "bg-slate-900/40 backdrop-blur-md",
  divider: isDark ? "border-[#1f232e]" : "border-slate-100",
  danger: isDark ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-red-700 bg-red-50 border-red-200",
  success: isDark ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-emerald-700 bg-emerald-50 border-emerald-200",
  warning: isDark ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-amber-700 bg-amber-50 border-amber-200",
  cluster: isDark ? "bg-white text-black" : "bg-slate-900 text-white"
});

// --- SIGNATURE PAD COMPONENT ---
const SignaturePad = ({ isDark, onSign, signed }: { isDark: boolean; onSign: () => void; signed: boolean }) => (
  <div
    onClick={onSign}
    className={`h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${signed
        ? 'border-blue-500 bg-blue-500/5'
        : isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-slate-300 hover:bg-slate-100'
      }`}
  >
    {signed ? (
      <div className="text-blue-500 flex flex-col items-center animate-in zoom-in">
        <span className="font-script text-2xl italic">Firmado</span>
        <span className="text-[10px] uppercase font-bold mt-1">Digitalmente firmado</span>
      </div>
    ) : (
      <>
        <PenTool size={20} className={`mb-1 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
        <span className={`text-xs font-bold uppercase ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>Toca para firmar</span>
      </>
    )}
  </div>
);

// --- OBLIQUE STRATEGY MODAL ---
interface ObliqueStrategyModalProps {
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
  onClose: () => void;
}

const ObliqueStrategyModal = ({ theme, isDark, onClose }: ObliqueStrategyModalProps) => {
  const [currentStrategy, setCurrentStrategy] = useState<ObliqueStrategy>(
    () => OBLIQUE_STRATEGIES[Math.floor(Math.random() * OBLIQUE_STRATEGIES.length)]
  );
  const [isAnimating, setIsAnimating] = useState(false);

  const drawNewCard = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStrategy(OBLIQUE_STRATEGIES[Math.floor(Math.random() * OBLIQUE_STRATEGIES.length)]);
      setIsAnimating(false);
    }, 300);
  };

  return (
    <div className={`fixed inset-0 z-[70] flex items-center justify-center ${theme.modalOverlay} p-4 animate-in fade-in duration-200`}>
      <div className={`w-full max-w-sm ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${theme.divider} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
        {/* Header */}
        <div className={`p-4 border-b ${theme.divider} flex justify-between items-center bg-gradient-to-r ${isDark ? 'from-purple-900/30 to-blue-900/30' : 'from-purple-100 to-blue-100'}`}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-white">
              <Lightbulb size={18} />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${theme.textMain}`}>Estrategias Oblicuas</h2>
              <p className={`text-xs ${theme.textMuted}`}>Brian Eno & Peter Schmidt</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 ${theme.textMuted} hover:${theme.textMain} rounded-full transition-colors`}>
            <X size={20} />
          </button>
        </div>

        {/* Card Content */}
        <div className="p-6">
          <div className={`relative min-h-[200px] rounded-xl border-2 border-dashed ${isDark ? 'border-purple-500/30 bg-purple-500/5' : 'border-purple-200 bg-purple-50'} p-6 flex flex-col items-center justify-center text-center transition-all duration-300 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            <Sparkles size={24} className={`mb-4 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
            <p className={`text-lg font-bold ${theme.textMain} mb-3 leading-relaxed`}>
              {currentStrategy.spanish}
            </p>
            <p className={`text-sm ${theme.textMuted} italic`}>
              "{currentStrategy.english}"
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className={`p-4 border-t ${theme.divider} flex gap-3`}>
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cerrar
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white"
            onClick={drawNewCard}
            disabled={isAnimating}
          >
            <Shuffle size={16} className={`mr-2 ${isAnimating ? 'animate-spin' : ''}`} />
            Nueva carta
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- JOB CARD COMPONENT ---
interface JobCardProps {
  job: any;
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
  onAction: (action: string, job?: any) => void;
  isCrewChief: boolean;
  techName?: string;
  onOpenObliqueStrategy?: () => void;
}

const TechJobCard = ({ job, theme, isDark, onAction, isCrewChief, techName, onOpenObliqueStrategy }: JobCardProps) => {
  const jobData = job.jobs || job;
  const jobTimezone = jobData?.timezone || 'Europe/Madrid';

  // Format time
  let timeDisplay = "";
  if (jobData?.start_time && jobData?.end_time) {
    try {
      const startTime = formatInTimeZone(new Date(jobData.start_time), jobTimezone, "HH:mm");
      const endTime = formatInTimeZone(new Date(jobData.end_time), jobTimezone, "HH:mm");
      timeDisplay = `${startTime} - ${endTime}`;
    } catch {
      timeDisplay = "Hora no disponible";
    }
  }

  // Get role label
  let roleLabel = "Técnico";
  if (job.sound_role) roleLabel = labelForCode(job.sound_role) || job.sound_role;
  else if (job.lights_role) roleLabel = labelForCode(job.lights_role) || job.lights_role;
  else if (job.video_role) roleLabel = labelForCode(job.video_role) || job.video_role;
  else if (job.role) roleLabel = job.role;

  const location = jobData?.location?.name || 'Sin ubicación';

  // Status color
  const statusColors: Record<string, string> = {
    'production': 'border-l-emerald-500',
    'planning': 'border-l-blue-500',
    'confirmed': 'border-l-emerald-500',
    'pending': 'border-l-amber-500',
  };
  const statusColor = statusColors[jobData?.status] || 'border-l-blue-500';

  return (
    <div className={`rounded-xl border border-l-4 ${statusColor} ${theme.card} p-5 relative overflow-hidden group mb-4`}>

      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`font-bold text-lg ${theme.textMain}`}>{jobData?.title || 'Sin título'}</h3>
            {isCrewChief && onOpenObliqueStrategy && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenObliqueStrategy(); }}
                className="text-purple-500/40 hover:text-purple-400 transition-colors p-1"
                title="Estrategias Oblicuas"
              >
                <Lightbulb size={16} />
              </button>
            )}
          </div>
          <div className={`text-xs ${theme.textMuted} flex items-center gap-2 mt-1`}>
            <MapPin size={12} /> {location}
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${theme.success}`}>
          Activo
        </span>
      </div>

      {/* Time & Role */}
      <div className="flex items-center gap-4 text-xs text-gray-400 mb-5 flex-wrap">
        {timeDisplay && (
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${isDark ? 'bg-white/5 border border-white/5' : 'bg-slate-100 border border-slate-200'}`}>
            <Clock size={12} /> {timeDisplay}
          </div>
        )}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${isDark ? 'bg-white/5 border border-white/5' : 'bg-slate-100 border border-slate-200'}`}>
          <User size={12} /> {roleLabel}
        </div>
      </div>

      {/* Action Grid */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onAction('details', jobData)}
          className={`py-2.5 rounded-lg border border-dashed ${theme.divider} ${theme.textMuted} text-xs font-bold hover:bg-white/5 transition-colors flex items-center justify-center gap-2`}
        >
          <FileText size={14} /> Ver detalles
        </button>
        <button
          onClick={() => onAction('timesheet', jobData)}
          className={`py-2.5 rounded-lg ${theme.accent} text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20`}
        >
          <Clock size={14} /> Horas
        </button>
        <TechnicianIncidentReportDialog
          job={jobData}
          techName={techName || ''}
          labeled
          className="col-span-2"
        />
      </div>
    </div>
  );
};

// --- TIMESHEET MODAL ---
interface TimesheetModalProps {
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
  job: any;
  onClose: () => void;
}

const TimesheetModal = ({ theme, isDark, job, onClose }: TimesheetModalProps) => {
  const [signed, setSigned] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (job?.id) {
      navigate(`/timesheets?jobId=${job.id}`);
    }
    onClose();
  };

  const jobDate = job?.start_time
    ? format(new Date(job.start_time), "PPP", { locale: es })
    : "Fecha no disponible";

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="bottom" className={`h-[70vh] rounded-t-2xl ${isDark ? 'bg-[#0f1219]' : 'bg-white'}`}>
        <SheetHeader className="mb-6">
          <SheetTitle className={theme.textMain}>Registrar horas</SheetTitle>
        </SheetHeader>

        <div className={`p-4 rounded-xl border ${theme.card} mb-4`}>
          <div className="flex justify-between mb-2">
            <span className={theme.textMuted}>Trabajo</span>
            <span className={theme.textMain}>{job?.title || 'Sin título'}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className={theme.textMuted}>Fecha</span>
            <span className={theme.textMain}>{jobDate}</span>
          </div>
        </div>

        <p className={`text-sm ${theme.textMuted} mb-6`}>
          Para registrar tus horas completas, serás redirigido a la página de partes de horas.
        </p>

        <div className="mt-auto">
          <label className={`text-xs font-bold uppercase mb-2 block ${theme.textMuted}`}>Firma para confirmar</label>
          <SignaturePad isDark={isDark} signed={signed} onSign={() => setSigned(!signed)} />
          <Button
            disabled={!signed}
            onClick={handleSubmit}
            className={`w-full mt-4 py-3 rounded-xl font-bold text-sm`}
          >
            Ir a partes de horas
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// --- ENHANCED JOB DETAILS MODAL WITH TABS ---
interface DetailsModalProps {
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
  job: any;
  onClose: () => void;
}

type TabId = 'Info' | 'Ubicación' | 'Personal' | 'Docs' | 'Restau.' | 'Clima';

const DetailsModal = ({ theme, isDark, job, onClose }: DetailsModalProps) => {
  const [activeTab, setActiveTab] = useState<TabId>('Info');
  const [documentLoading, setDocumentLoading] = useState<Set<string>>(new Set());
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
          technician:profiles(id, first_name, last_name, email)
        `)
        .eq('job_id', job.id)
        .eq('status', 'confirmed');
      if (error) throw error;
      return data || [];
    },
    enabled: !!job?.id,
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
      } catch (e: any) {
        console.warn('Failed to load static map preview:', e?.message || e);
        setMapPreviewUrl(null);
      } finally {
        setIsMapLoading(false);
      }
    };
    if (jobDetails?.locations) {
      loadStaticMap();
    }
  }, [jobDetails?.locations]);

  const handleViewDocument = async (doc: any) => {
    const docId = doc.id;
    setDocumentLoading(prev => new Set(prev).add(docId));
    try {
      const url = await createSignedUrl(supabase, doc.file_path, 60);
      window.open(url, '_blank');
    } catch (err: any) {
      toast.error(`No se pudo abrir el documento: ${err.message}`);
    } finally {
      setDocumentLoading(prev => { const s = new Set(prev); s.delete(docId); return s; });
    }
  };

  const handleDownload = async (doc: any) => {
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
    } catch (err: any) {
      toast.error(`No se pudo descargar el documento: ${err.message}`);
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

  const tabs: { id: TabId; label: string }[] = [
    { id: 'Info', label: 'Info' },
    { id: 'Ubicación', label: 'Ubicación' },
    { id: 'Personal', label: 'Personal' },
    { id: 'Docs', label: 'Docs' },
    { id: 'Restau.', label: 'Restau.' },
    { id: 'Clima', label: 'Clima' },
  ];

  // Get department badge for staff
  const getDepartmentFromAssignment = (assignment: any): string => {
    if (assignment.sound_role) return 'sound';
    if (assignment.lights_role) return 'lights';
    if (assignment.video_role) return 'video';
    return 'unknown';
  };

  const getRoleFromAssignment = (assignment: any): string => {
    const role = assignment.sound_role || assignment.lights_role || assignment.video_role;
    return role ? (labelForCode(role) || role) : 'Técnico';
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
                      {job?.job_type || 'single'}
                    </span>
                  </div>
                </div>
              </div>

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
                      <Map size={14} className="mr-2" /> Abrir mapas
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
                  {staffAssignments.map((assignment: any, idx: number) => {
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

                {job?.job_documents && job.job_documents.length > 0 ? (
                  <div className="space-y-2">
                    {job.job_documents.map((doc: any) => (
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
                )}
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

// --- SOUNDVISION DATABASE MODAL ---
interface SoundVisionModalProps {
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
  onClose: () => void;
}

const SoundVisionModal = ({ theme, isDark, onClose }: SoundVisionModalProps) => {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch SoundVision files from job_documents
  const { data: svFiles = [], isLoading } = useQuery({
    queryKey: ['soundvision-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_documents')
        .select(`
          id,
          file_name,
          file_path,
          uploaded_at,
          jobs (
            title,
            location:locations(name)
          )
        `)
        .eq('template_type', 'soundvision')
        .order('uploaded_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    }
  });

  const handleDownload = async (doc: any) => {
    try {
      const url = await createSignedUrl(supabase, doc.file_path, 60);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Descarga iniciada');
    } catch (err: any) {
      toast.error(`No se pudo descargar: ${err.message}`);
    }
  };

  const filteredFiles = svFiles.filter((f: any) =>
    f.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.jobs?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.jobs?.location?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      {/* Map Layer */}
      <div className="absolute inset-0 bg-[#111]">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        {/* Decorative clusters */}
        <div className={`absolute top-1/3 left-1/2 w-12 h-12 rounded-full flex items-center justify-center font-bold shadow-xl -ml-6 ${theme.cluster}`}>
          {svFiles.length}
        </div>
        <button onClick={onClose} className="absolute top-6 left-6 z-10 p-3 bg-black/50 text-white rounded-full backdrop-blur-md border border-white/10">
          <ArrowLeft size={20} />
        </button>
      </div>

      {/* Drawer */}
      <div
        className={`absolute bottom-0 w-full ${isDark ? 'bg-[#0f1219]' : 'bg-white'} border-t ${theme.divider} rounded-t-3xl shadow-2xl flex flex-col transition-all duration-500`}
        style={{ height: drawerOpen ? '60%' : '100px' }}
      >
        <div onClick={() => setDrawerOpen(!drawerOpen)} className="w-full h-8 flex items-center justify-center cursor-pointer">
          <div className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-gray-600' : 'bg-slate-300'}`} />
        </div>
        <div className={`px-6 pb-4 border-b ${theme.divider}`}>
          <h2 className={`text-xl font-bold ${theme.textMain}`}>SoundVision DB</h2>
          <div className="relative mt-4">
            <Search className={`absolute left-3 top-3 ${theme.textMuted}`} size={16} />
            <Input
              type="text"
              placeholder="Buscar venues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full rounded-xl py-3 pl-10 pr-4 text-sm ${theme.input}`}
            />
          </div>
        </div>
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className={`text-center py-8 ${theme.textMuted}`}>
              No se encontraron archivos SoundVision
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFiles.map((f: any) => (
                <div key={f.id} className={`p-3 rounded-xl border ${theme.divider} ${isDark ? 'bg-white/5' : 'bg-slate-50'} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                      <FileText size={18} />
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${theme.textMain}`}>{f.file_name}</div>
                      <div className={`text-xs ${theme.textMuted}`}>
                        {f.jobs?.title || 'Sin trabajo'} • {f.jobs?.location?.name || 'Sin ubicación'}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(f)}>
                    <Download size={18} className={theme.textMuted} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

// --- TOUR CARD COMPONENT ---
interface TourCardProps {
  tour: {
    id: string;
    name: string;
    description?: string;
    color: string;
    start_date?: string;
    end_date?: string;
    assignment_role: string;
    assignment_department: string;
    assignment_notes?: string;
    total_dates: number;
    upcoming_dates: number;
  };
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
  onNavigate: (tourId: string) => void;
}

const TourCard = ({ tour, theme, isDark, onNavigate }: TourCardProps) => {
  const progress = tour.total_dates > 0
    ? ((tour.total_dates - tour.upcoming_dates) / tour.total_dates) * 100
    : 0;

  const getDepartmentIcon = (department: string) => {
    switch (department?.toLowerCase()) {
      case 'sound': return <Speaker size={14} className="text-blue-400" />;
      case 'lights': return <Sliders size={14} className="text-amber-400" />;
      case 'video': return <Camera size={14} className="text-purple-400" />;
      default: return <User size={14} className="text-gray-400" />;
    }
  };

  const getDepartmentLabel = (department: string) => {
    switch (department?.toLowerCase()) {
      case 'sound': return 'Sonido';
      case 'lights': return 'Luces';
      case 'video': return 'Vídeo';
      default: return department || 'Técnico';
    }
  };

  const formatDateRange = () => {
    if (!tour.start_date && !tour.end_date) return 'Sin fechas';
    const start = tour.start_date ? format(new Date(tour.start_date), "d 'de' MMM", { locale: es }) : '';
    const end = tour.end_date ? format(new Date(tour.end_date), "d 'de' MMM, yyyy", { locale: es }) : '';
    if (start && end) return `${start} - ${end}`;
    return start || end;
  };

  return (
    <div
      onClick={() => onNavigate(tour.id)}
      className={`
        group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer
        ${theme.card} hover:border-blue-500/50
      `}
    >
      {/* Header with gradient using tour color */}
      <div className="h-28 w-full relative overflow-hidden">
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${tour.color || '#3b82f6'}33, ${isDark ? '#0f1219' : '#ffffff'})`
          }}
        >
          <Radio size={48} className="opacity-10" />
        </div>

        {/* Context Menu */}
        <button
          onClick={(e) => { e.stopPropagation(); }}
          className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm transition-colors"
        >
          <MoreVertical size={16} />
        </button>

        {/* Tour Name Overlay */}
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className={`text-lg font-bold truncate ${theme.textMain}`}>{tour.name}</h3>
          {tour.description && (
            <p className={`text-xs ${theme.textMuted} truncate`}>{tour.description}</p>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className={`px-4 py-3 flex items-center justify-between border-b border-dashed ${theme.divider}`}>
        <div className="flex items-center gap-2 text-xs font-medium">
          <CalendarIcon size={14} className="text-blue-500" />
          <span className={theme.textMain}>{formatDateRange()}</span>
        </div>
        <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isDark ? 'bg-gray-500/10 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>
          {tour.total_dates} Fechas
        </div>
      </div>

      {/* Body Content */}
      <div className="p-4">
        {/* Role Assignment */}
        <div className="mb-4">
          <div className={`text-[10px] font-bold uppercase mb-2 ${theme.textMuted}`}>Tu asignación</div>
          <div className={`p-3 rounded-xl border flex items-center justify-between ${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2">
              {getDepartmentIcon(tour.assignment_department)}
              <div className="flex flex-col">
                <span className={`font-bold text-sm ${theme.textMain}`}>{tour.assignment_role || 'Técnico'}</span>
                <span className={`text-[10px] ${theme.textMuted}`}>{getDepartmentLabel(tour.assignment_department)}</span>
              </div>
            </div>
            <div className="text-right">
              <span className={`block font-mono text-xs font-bold ${theme.textMain}`}>{tour.upcoming_dates}</span>
              <span className="text-[10px] text-blue-500 font-bold">próximas</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] mb-1">
            <span className={theme.textMuted}>Progreso</span>
            <span className={theme.textMain}>{Math.round(progress)}%</span>
          </div>
          <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: tour.color || '#3b82f6' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tour.assignment_notes && (
              <span className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border ${isDark ? 'bg-[#1a1d26] text-gray-300 border-[#2a2e3b]' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                <FileText size={10} /> Notas
              </span>
            )}
          </div>
          <ChevronRight size={16} className={`${theme.textMuted} group-hover:translate-x-1 transition-transform`} />
        </div>
      </div>
    </div>
  );
};

// --- TOUR DETAIL VIEW (Technician Mode) ---
interface TourDetailViewProps {
  tourId: string;
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
  onClose: () => void;
  onOpenJob: (jobId: string) => void;
}

const TourDetailView = ({ tourId, theme, isDark, onClose, onOpenJob }: TourDetailViewProps) => {
  // Fetch tour details with correct schema
  const { data: tourData, isLoading: tourLoading } = useQuery({
    queryKey: ['tour-detail-tech', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tours')
        .select(`
          id, name, description, color, status, start_date, end_date,
          tour_dates (
            id,
            date,
            start_date,
            end_date,
            location_id,
            tour_date_type,
            location:locations (id, name, formatted_address)
          ),
          tour_assignments (
            id, role, department, notes,
            profiles:technician_id (id, first_name, last_name)
          )
        `)
        .eq('id', tourId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tourId,
  });

  // Fetch recent tour documents (correct schema - no document_type column)
  const { data: tourDocs = [] } = useQuery({
    queryKey: ['tour-docs-tech', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_documents')
        .select('id, file_name, file_path, uploaded_at, file_type')
        .eq('tour_id', tourId)
        .order('uploaded_at', { ascending: false })
        .limit(5);
      if (error) return [];
      return data || [];
    },
    enabled: !!tourId,
  });

  if (tourLoading) {
    return (
      <div className={`fixed inset-0 z-[60] ${theme.bg} flex items-center justify-center`}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!tourData) {
    return (
      <div className={`fixed inset-0 z-[60] ${theme.bg} flex items-center justify-center`}>
        <div className="text-center">
          <AlertTriangle size={48} className={theme.textMuted} />
          <p className={`mt-4 ${theme.textMuted}`}>No se pudo cargar la gira</p>
          <Button onClick={onClose} className="mt-4">Volver</Button>
        </div>
      </div>
    );
  }

  const tourDates = tourData.tour_dates || [];
  const now = new Date();
  const completedDates = tourDates.filter((d: any) => new Date(d.date) < now);
  const upcomingDates = tourDates.filter((d: any) => new Date(d.date) >= now).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextShow = upcomingDates[0];
  const progress = tourDates.length > 0 ? (completedDates.length / tourDates.length) * 100 : 0;
  const crewCount = tourData.tour_assignments?.length || 0;

  const formatDateRange = () => {
    if (!tourData.start_date && !tourData.end_date) return 'Sin fechas';
    const start = tourData.start_date ? format(new Date(tourData.start_date), "d 'de' MMM", { locale: es }) : '';
    const end = tourData.end_date ? format(new Date(tourData.end_date), "d 'de' MMM, yyyy", { locale: es }) : '';
    if (start && end) return `${start} - ${end}`;
    return start || end;
  };

  const getDateStatus = (dateEntry: any) => {
    const dateObj = new Date(dateEntry.date);
    if (dateObj < now) return 'done';
    if (nextShow && dateEntry.id === nextShow.id) return 'next';
    return 'upcoming';
  };

  const handleDownloadDoc = async (doc: any) => {
    try {
      const url = await createSignedUrl(supabase, doc.file_path, 60);
      window.open(url, '_blank');
    } catch {
      toast.error('No se pudo abrir el documento');
    }
  };

  return (
    <div className={`fixed inset-0 z-[60] ${theme.bg} overflow-y-auto`}>
      {/* Hero Header */}
      <div className={`relative pt-6 pb-5 px-5 border-b ${theme.divider} overflow-hidden`}>
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: `linear-gradient(to bottom, ${tourData.color || '#3b82f6'}40, transparent)` }}
        />

        <div className="relative z-10">
          {/* Back Button */}
          <button
            onClick={onClose}
            className={`flex items-center gap-1 text-xs font-bold ${theme.textMuted} mb-4`}
          >
            <ArrowLeft size={14} /> Volver
          </button>

          {/* Title */}
          <h1 className={`text-2xl font-bold ${theme.textMain} mb-1`}>{tourData.name}</h1>
          <div className={`flex items-center gap-3 text-sm ${theme.textMuted}`}>
            {tourData.description && <span>{tourData.description}</span>}
            <span className="flex items-center gap-1">
              <CalendarIcon size={14} /> {formatDateRange()}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-4 rounded-xl border ${theme.card}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>Fechas</span>
              <CalendarIcon size={14} className="text-blue-500" />
            </div>
            <div className={`text-xl font-bold ${theme.textMain}`}>{completedDates.length} / {tourDates.length}</div>
            <div className={`text-xs ${theme.textMuted}`}>{Math.round(progress)}% completado</div>
          </div>
          <div className={`p-4 rounded-xl border ${theme.card}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>Equipo</span>
              <Users size={14} className="text-emerald-500" />
            </div>
            <div className={`text-xl font-bold ${theme.textMain}`}>{crewCount}</div>
            <div className={`text-xs ${theme.textMuted}`}>técnicos asignados</div>
          </div>
        </div>

        {/* Next Show Highlight */}
        {nextShow && (
          <div className={`p-5 rounded-xl border relative overflow-hidden ${theme.card}`}>
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Globe size={80} />
            </div>
            <div className="relative z-10">
              <div className={`text-[10px] font-bold uppercase tracking-wider ${theme.textMuted} mb-1`}>Próximo</div>
              <div className="flex justify-between items-end">
                <div>
                  <h2 className={`text-xl font-bold ${theme.textMain}`}>{nextShow.location?.name || 'Recinto'}</h2>
                  <div className={`text-sm ${theme.textMuted}`}>{nextShow.location?.formatted_address || nextShow.tour_date_type || 'Show'}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-mono font-bold text-blue-500">
                    {format(new Date(nextShow.date), "d 'de' MMM", { locale: es })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Docs */}
        {tourDocs.length > 0 && (
          <div className={`p-4 rounded-xl border ${theme.card}`}>
            <div className="flex justify-between items-center mb-3">
              <h3 className={`font-bold text-sm ${theme.textMain}`}>Documentos recientes</h3>
            </div>
            <div className="space-y-2">
              {tourDocs.map((doc: any) => (
                <button
                  key={doc.id}
                  onClick={() => handleDownloadDoc(doc)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'} text-left`}
                >
                  <FileText size={16} className="text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold truncate ${theme.textMain}`}>{doc.file_name}</div>
                    <div className={`text-[10px] ${theme.textMuted}`}>
                      {format(new Date(doc.uploaded_at), "d MMM, HH:mm", { locale: es })}
                    </div>
                  </div>
                  <Download size={14} className={theme.textMuted} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Itinerary */}
        <div>
          <h3 className={`font-bold ${theme.textMain} mb-3`}>Itinerario</h3>
          <div className="space-y-2">
            {tourDates.length === 0 ? (
              <div className={`p-8 rounded-xl border ${theme.card} text-center`}>
                <CalendarIcon size={32} className={`mx-auto mb-2 ${theme.textMuted}`} />
                <p className={`text-sm ${theme.textMuted}`}>No hay fechas programadas</p>
              </div>
            ) : (
              [...tourDates]
                .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((dateEntry: any) => {
                  const status = getDateStatus(dateEntry);
                  const statusStyles: Record<string, string> = {
                    done: 'bg-emerald-500/10 text-emerald-500',
                    next: 'bg-blue-500/10 text-blue-500',
                    upcoming: isDark ? 'bg-gray-500/10 text-gray-400' : 'bg-slate-100 text-slate-500',
                  };
                  const statusLabels: Record<string, string> = { done: 'Hecho', next: 'Próximo', upcoming: 'Pendiente' };

                  return (
                    <div
                      key={dateEntry.id}
                      className={`flex items-center justify-between p-3 rounded-xl border ${theme.card}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center w-10">
                          <div className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>
                            {format(new Date(dateEntry.date), 'MMM', { locale: es })}
                          </div>
                          <div className={`text-lg font-bold ${theme.textMain}`}>
                            {format(new Date(dateEntry.date), 'd')}
                          </div>
                        </div>
                        <div>
                          <div className={`font-bold text-sm ${theme.textMain}`}>{dateEntry.location?.name || 'Recinto'}</div>
                          <div className={`text-xs ${theme.textMuted}`}>
                            {dateEntry.location?.formatted_address || dateEntry.tour_date_type || 'Show'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${statusStyles[status]}`}>
                          {statusLabels[status]}
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- DASHBOARD SCREEN ---
interface DashboardScreenProps {
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
  user: any;
  userProfile: any;
  assignments: any[];
  isLoading: boolean;
  onOpenAction: (action: string, job?: any) => void;
  onOpenSV: () => void;
  onOpenObliqueStrategy: () => void;
  onOpenTour: (tourId: string) => void;
}

const DashboardScreen = ({ theme, isDark, user, userProfile, assignments, isLoading, onOpenAction, onOpenSV, onOpenObliqueStrategy, onOpenTour }: DashboardScreenProps) => {
  const navigate = useNavigate();
  const { activeTours } = useMyTours();

  const userInitials = userProfile?.first_name && userProfile?.last_name
    ? `${userProfile.first_name[0]}${userProfile.last_name[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  const userName = userProfile?.first_name && userProfile?.last_name
    ? `${userProfile.first_name} ${userProfile.last_name}`
    : user?.email || 'Técnico';

  const isCrewChief = userProfile?.role === 'house_tech' ||
    assignments.some(a => {
      const category = getCategoryFromAssignment(a);
      return category === 'responsable';
    });

  // Get today's assignment
  const todayAssignment = assignments.find(a => {
    const jobData = a.jobs || a;
    if (!jobData?.start_time) return false;
    const jobDate = new Date(jobData.start_time);
    const today = new Date();
    return jobDate.toDateString() === today.toDateString();
  });

  // Calculate weekly hours (simplified)
  const weeklyHours = assignments.length * 8; // Placeholder

  // Get next shift time
  const nextShift = assignments[0]?.jobs?.start_time
    ? formatInTimeZone(new Date(assignments[0].jobs.start_time), 'Europe/Madrid', 'HH:mm')
    : '--:--';

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${theme.textMain}`}>Panel</h1>
          <p className={`text-xs ${theme.textMuted}`}>Bienvenido, {userName}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
          {userInitials}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`p-3 rounded-xl border ${theme.card}`}>
          <div className={`text-[10px] font-bold uppercase ${theme.textMuted} mb-1`}>Próximo turno</div>
          <div className={`text-lg font-bold ${theme.textMain}`}>{nextShift}</div>
        </div>
        <div className={`p-3 rounded-xl border ${theme.card}`}>
          <div className={`text-[10px] font-bold uppercase ${theme.textMuted} mb-1`}>Esta semana</div>
          <div className={`text-lg font-bold ${theme.textMain}`}>{assignments.length} trabajos</div>
        </div>
        <div className={`p-3 rounded-xl border ${theme.card} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-blue-600/10" />
          <div className="text-[10px] font-bold uppercase text-blue-400 mb-1">Tours</div>
          <div className="text-lg font-bold text-blue-400">{activeTours.length}</div>
        </div>
      </div>

      {/* Quick Tools */}
      <div>
        <h2 className={`text-xs font-bold uppercase ${theme.textMuted} mb-3`}>Herramientas</h2>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={onOpenSV}
            className={`flex-shrink-0 w-28 h-24 p-3 rounded-xl border ${theme.card} flex flex-col justify-between hover:border-blue-500 transition-colors text-left group`}
          >
            <Map size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
            <span className={`text-xs font-bold ${theme.textMain}`}>SoundVision<br />Database</span>
          </button>
          <button
            onClick={() => navigate('/timesheets')}
            className={`flex-shrink-0 w-28 h-24 p-3 rounded-xl border ${theme.card} flex flex-col justify-between text-left`}
          >
            <Clock size={20} className="text-emerald-500" />
            <span className={`text-xs font-bold ${theme.textMain}`}>Partes de<br />horas</span>
          </button>
          <button
            onClick={() => navigate('/dashboard/unavailability')}
            className={`flex-shrink-0 w-28 h-24 p-3 rounded-xl border ${theme.card} flex flex-col justify-between text-left`}
          >
            <CalendarIcon size={20} className="text-amber-500" />
            <span className={`text-xs font-bold ${theme.textMain}`}>Mi<br />disponibilidad</span>
          </button>
          <Dialog>
            <DialogTrigger asChild>
              <button
                className={`flex-shrink-0 w-28 h-24 p-3 rounded-xl border ${theme.card} flex flex-col justify-between hover:border-purple-500 transition-colors text-left group`}
              >
                <MessageSquare size={20} className="text-purple-500 group-hover:scale-110 transition-transform" />
                <span className={`text-xs font-bold ${theme.textMain}`}>Mensajes</span>
              </button>
            </DialogTrigger>
            <MessageManagementDialog department={userProfile?.department || null} trigger={false} />
          </Dialog>
        </div>
      </div>

      {/* My Tours Section */}
      {activeTours.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${theme.textMuted}`}>Mis giras</h2>
            <Badge variant="outline">{activeTours.length}</Badge>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2">
            {activeTours.map((tour) => (
              <div key={tour.id} className="flex-shrink-0 w-72">
                <TourCard
                  tour={tour}
                  theme={theme}
                  isDark={isDark}
                  onNavigate={onOpenTour}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Assignment */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className={`text-sm font-bold uppercase tracking-wider ${theme.textMuted}`}>Asignación de hoy</h2>
          <span className="text-[10px] text-blue-500 font-bold">{format(new Date(), 'dd MMM', { locale: es })}</span>
        </div>
        {isLoading ? (
          <div className={`p-8 rounded-xl border ${theme.card} flex items-center justify-center`}>
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : todayAssignment ? (
          <TechJobCard
            job={todayAssignment}
            theme={theme}
            isDark={isDark}
            onAction={onOpenAction}
            isCrewChief={isCrewChief}
            techName={userName}
            onOpenObliqueStrategy={onOpenObliqueStrategy}
          />
        ) : (
          <div className={`p-8 rounded-xl border ${theme.card} text-center`}>
            <Briefcase size={32} className={`mx-auto mb-2 ${theme.textMuted}`} />
            <p className={`text-sm ${theme.textMuted}`}>Sin asignaciones para hoy</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- JOBS VIEW ---
interface JobsViewProps {
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
  assignments: any[];
  isLoading: boolean;
  onOpenAction: (action: string, job?: any) => void;
  techName: string;
  onOpenObliqueStrategy: () => void;
}

const JobsView = ({ theme, isDark, assignments, isLoading, onOpenAction, techName, onOpenObliqueStrategy }: JobsViewProps) => {
  const [viewMode, setViewMode] = useState<'upcoming' | 'past'>('upcoming');
  const [timeSpan, setTimeSpan] = useState('2weeks');

  const isCrewChief = assignments.some(a => {
    const category = getCategoryFromAssignment(a);
    return category === 'responsable';
  });

  // Calculate date ranges based on timeSpan
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (viewMode === 'upcoming') {
      startDate = now;
      switch (timeSpan) {
        case '1week':
          endDate = addWeeks(now, 1);
          break;
        case '2weeks':
          endDate = addWeeks(now, 2);
          break;
        case '1month':
          endDate = addMonths(now, 1);
          break;
        case '3months':
          endDate = addMonths(now, 3);
          break;
        default:
          endDate = addWeeks(now, 2);
      }
    } else {
      endDate = now;
      switch (timeSpan) {
        case '1week':
          startDate = addWeeks(now, -1);
          break;
        case '2weeks':
          startDate = addWeeks(now, -2);
          break;
        case '1month':
          startDate = addMonths(now, -1);
          break;
        case '3months':
          startDate = addMonths(now, -3);
          break;
        default:
          startDate = addWeeks(now, -2);
      }
    }
    return { startDate, endDate };
  };

  // Filter assignments based on view mode and time span
  const filteredAssignments = assignments.filter(assignment => {
    const jobData = assignment.jobs || assignment;
    if (!jobData?.start_time) return false;

    const jobStart = new Date(jobData.start_time);
    const { startDate, endDate } = getDateRange();

    if (viewMode === 'upcoming') {
      return jobStart >= startDate && jobStart <= endDate;
    } else {
      return jobStart >= startDate && jobStart < endDate;
    }
  });

  // Time span options based on view mode
  const timeSpanOptions = viewMode === 'upcoming'
    ? [
        { value: '1week', label: 'Próxima semana' },
        { value: '2weeks', label: 'Próximas 2 semanas' },
        { value: '1month', label: 'Próximo mes' },
        { value: '3months', label: 'Próximos 3 meses' },
      ]
    : [
        { value: '1week', label: 'Semana pasada' },
        { value: '2weeks', label: 'Últimas 2 semanas' },
        { value: '1month', label: 'Mes pasado' },
        { value: '3months', label: 'Últimos 3 meses' },
      ];

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${theme.textMain}`}>Mis trabajos</h1>
        <Badge variant="outline">{filteredAssignments.length} asignaciones</Badge>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Upcoming/Past Toggle */}
        <div className={`flex rounded-xl p-1 ${isDark ? 'bg-[#0a0c10]' : 'bg-slate-100'}`}>
          <button
            onClick={() => setViewMode('upcoming')}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'upcoming'
                ? `${theme.accent} shadow-md`
                : theme.textMuted
            }`}
          >
            Próximos
          </button>
          <button
            onClick={() => setViewMode('past')}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'past'
                ? `${theme.accent} shadow-md`
                : theme.textMuted
            }`}
          >
            Pasados
          </button>
        </div>

        {/* Time Span Selector */}
        <div className={`flex-1 sm:flex-none`}>
          <select
            value={timeSpan}
            onChange={(e) => setTimeSpan(e.target.value)}
            className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold border ${theme.input} ${theme.card} appearance-none cursor-pointer`}
          >
            {timeSpanOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className={`p-12 rounded-xl border ${theme.card} text-center`}>
          <Briefcase size={48} className={`mx-auto mb-4 ${theme.textMuted}`} />
          <p className={theme.textMuted}>
            {viewMode === 'upcoming'
              ? 'No tienes asignaciones próximas en este periodo'
              : 'No tienes asignaciones pasadas en este periodo'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAssignments.map((assignment, index) => (
            <TechJobCard
              key={assignment.id || index}
              job={assignment}
              theme={theme}
              isDark={isDark}
              onAction={onOpenAction}
              isCrewChief={isCrewChief}
              techName={techName}
              onOpenObliqueStrategy={onOpenObliqueStrategy}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- AVAILABILITY VIEW ---
interface AvailabilityViewProps {
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
}

const AvailabilityView = ({ theme, isDark }: AvailabilityViewProps) => {
  const navigate = useNavigate();
  const { user } = useOptimizedAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch unavailability blocks
  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['my-unavailability', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('technician_availability')
        .select('id, technician_id, date, status, created_at')
        .eq('technician_id', user.id)
        .order('date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: { startDate: string; endDate: string }) => {
      if (!user?.id) return;
      const rows: Array<{ technician_id: string; date: string; status: string }> = [];
      const s = new Date(payload.startDate + 'T00:00');
      const e = new Date(payload.endDate + 'T00:00');
      if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) throw new Error('Invalid date range');
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        rows.push({ technician_id: user.id, date: d.toISOString().slice(0, 10), status: 'day_off' });
      }
      const { error } = await supabase
        .from('technician_availability')
        .upsert(rows, { onConflict: 'technician_id,date' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Bloqueo creado');
      queryClient.invalidateQueries({ queryKey: ['my-unavailability'] });
      setShowAddSheet(false);
      setStartDate('');
      setEndDate('');
    },
    onError: (e: any) => toast.error(e?.message || 'No se pudo crear'),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('technician_availability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Bloqueo eliminado');
      queryClient.invalidateQueries({ queryKey: ['my-unavailability'] });
    },
    onError: (e: any) => toast.error(e?.message || 'No se pudo eliminar'),
  });

  // Calendar generation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Check if a day has unavailability
  const getUnavailabilityForDay = (day: Date) => {
    return blocks.find((b: any) => isSameDay(new Date(b.date), day));
  };

  const statusStyles: Record<string, string> = {
    vacation: 'bg-amber-500/20 text-amber-500',
    travel: 'bg-sky-500/20 text-sky-500',
    sick: 'bg-rose-500/20 text-rose-500',
    day_off: 'bg-emerald-500/20 text-emerald-500',
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${theme.textMain}`}>Disponibilidad</h1>
        <Button size="sm" onClick={() => setShowAddSheet(true)}>
          <Plus size={14} className="mr-1" /> Añadir
        </Button>
      </div>

      {/* Calendar */}
      <div className={`p-4 rounded-2xl border ${theme.card}`}>
        <div className="flex justify-between mb-4">
          <span className={`font-bold ${theme.textMain}`}>
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
              <ChevronLeft size={16} className={theme.textMuted} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight size={16} className={theme.textMuted} />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-gray-500 mb-2">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <span key={d}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {/* Empty cells for days before month start */}
          {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
            <div key={`empty-${i}`} className="h-9" />
          ))}
          {days.map((day, i) => {
            const unavailability = getUnavailabilityForDay(day);
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={i}
                className={`h-9 rounded-lg flex items-center justify-center text-sm transition-colors ${isToday
                    ? 'bg-blue-600 text-white shadow-lg font-bold'
                    : unavailability
                      ? statusStyles[unavailability.status] || 'bg-emerald-500/20 text-emerald-500'
                      : theme.textMuted
                  }`}
              >
                {format(day, 'd')}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming unavailability blocks */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="space-y-2">
          {blocks.slice(0, 5).map((b: any) => (
            <div key={b.id} className={`p-3 rounded-xl border ${theme.card} flex items-center justify-between`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusStyles[b.status] || 'bg-emerald-500/10'}`}>
                  <Palmtree size={18} />
                </div>
                <div>
                  <div className={`text-sm font-bold ${theme.textMain}`}>
                    {b.status === 'vacation' ? 'Vacaciones' :
                      b.status === 'travel' ? 'Viaje' :
                        b.status === 'sick' ? 'Baja médica' : 'Día libre'}
                  </div>
                  <div className={`text-xs ${theme.textMuted}`}>
                    {format(new Date(b.date), 'PPP', { locale: es })}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate(b.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 size={16} className={theme.textMuted} />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className={`rounded-t-2xl ${isDark ? 'bg-[#0f1219]' : 'bg-white'}`}>
          <SheetHeader className="mb-6">
            <SheetTitle className={theme.textMain}>Añadir bloqueo</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div>
              <label className={`text-xs font-bold uppercase mb-2 block ${theme.textMuted}`}>Fecha inicio</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={theme.input}
              />
            </div>
            <div>
              <label className={`text-xs font-bold uppercase mb-2 block ${theme.textMuted}`}>Fecha fin</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={theme.input}
              />
            </div>
            <Button
              className="w-full"
              disabled={!startDate || !endDate || createMutation.isPending}
              onClick={() => createMutation.mutate({ startDate, endDate })}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                'Crear bloqueo'
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

// --- PROFILE VIEW ---
interface ProfileViewProps {
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
  user: any;
  userProfile: any;
  toggleTheme: () => void;
}

const ProfileView = ({ theme, isDark, user, userProfile, toggleTheme }: ProfileViewProps) => {
  const navigate = useNavigate();

  const userInitials = userProfile?.first_name && userProfile?.last_name
    ? `${userProfile.first_name[0]}${userProfile.last_name[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  const userName = userProfile?.first_name && userProfile?.last_name
    ? `${userProfile.first_name} ${userProfile.last_name}`
    : user?.email || 'Técnico';

  const roleLabels: Record<string, string> = {
    'technician': 'Técnico',
    'house_tech': 'Técnico de sala',
    'admin': 'Administrador',
    'management': 'Gestión',
  };
  const roleLabel = roleLabels[userProfile?.role] || userProfile?.role || 'Técnico';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${theme.textMain}`}>Perfil</h1>
        <Button variant="outline" size="sm" onClick={toggleTheme}>
          {isDark ? <Sun size={14} className="mr-1" /> : <Moon size={14} className="mr-1" />}
          {isDark ? "Modo claro" : "Modo oscuro"}
        </Button>
      </div>

      {/* Profile Card */}
      <div className={`p-6 rounded-2xl border flex flex-col items-center relative overflow-hidden ${theme.card}`}>
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-blue-500/20 to-purple-600/20" />
        <div className="w-24 h-24 rounded-full border-4 border-blue-500 relative mt-4 mb-3 flex items-center justify-center text-3xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
          {userInitials}
        </div>
        <h2 className={`text-xl font-bold ${theme.textMain}`}>{userName}</h2>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline">{roleLabel}</Badge>
          {userProfile?.department && (
            <Badge variant="secondary">{userProfile.department}</Badge>
          )}
        </div>
        {user?.email && (
          <p className={`text-xs ${theme.textMuted} mt-2`}>{user.email}</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className={`rounded-xl border divide-y ${theme.divider} ${theme.card}`}>
        <button
          onClick={() => navigate('/dashboard/unavailability')}
          className={`w-full p-4 flex justify-between items-center hover:bg-white/5 text-sm font-bold text-left ${theme.textMain}`}
        >
          <div className="flex items-center gap-3">
            <CalendarIcon size={18} className={theme.textMuted} />
            <span>Gestionar disponibilidad</span>
          </div>
          <ChevronRight size={16} className={theme.textMuted} />
        </button>
        <button
          onClick={() => navigate('/timesheets')}
          className={`w-full p-4 flex justify-between items-center hover:bg-white/5 text-sm font-bold text-left ${theme.textMain}`}
        >
          <div className="flex items-center gap-3">
            <Clock size={18} className={theme.textMuted} />
            <span>Partes de horas</span>
          </div>
          <ChevronRight size={16} className={theme.textMuted} />
        </button>
        <button
          className={`w-full p-4 flex justify-between items-center hover:bg-white/5 text-sm font-bold text-left ${theme.textMain}`}
        >
          <div className="flex items-center gap-3">
            <Bell size={18} className={theme.textMuted} />
            <span>Notificaciones</span>
          </div>
          <ChevronRight size={16} className={theme.textMuted} />
        </button>
      </div>

      {/* Sign Out */}
      <Button
        variant="destructive"
        className="w-full"
        onClick={handleSignOut}
      >
        <LogOut size={18} className="mr-2" />
        Cerrar sesión
      </Button>
    </div>
  );
};

// --- MAIN APP SHELL ---
export default function TechnicianSuperApp() {
  const [tab, setTab] = useState('dashboard');
  const { theme: nextTheme, setTheme } = useTheme();
  const { user } = useOptimizedAuth();
  const queryClient = useQueryClient();

  // Determine if dark mode
  const isDark = nextTheme === 'dark' || (nextTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  // Modal state
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [showObliqueStrategy, setShowObliqueStrategy] = useState(false);
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);

  // Set up real-time subscriptions
  useTechnicianDashboardSubscriptions();

  // Fetch user profile
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, role, department')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch assignments (past 3 months to future 3 months for filtering)
  const { data: assignments = [], isLoading } = useRealtimeQuery(
    ['assignments-superapp'],
    async () => {
      if (!user?.id) return [];

      // Fetch broader range for past/upcoming filtering
      const startDate = addMonths(new Date(), -3);
      const endDate = addMonths(new Date(), 3);

      const { data: jobAssignments, error } = await supabase
        .from('job_assignments')
        .select(`
          job_id,
          technician_id,
          sound_role,
          lights_role,
          video_role,
          assigned_at,
          jobs (
            id,
            title,
            description,
            start_time,
            end_time,
            timezone,
            location_id,
            job_type,
            color,
            status,
            location:locations(name),
            job_documents(
              id,
              file_name,
              file_path,
              visible_to_tech,
              uploaded_at,
              read_only,
              template_type
            )
          )
        `)
        .eq('technician_id', user.id)
        .eq('status', 'confirmed')
        .gte('jobs.start_time', startDate.toISOString())
        .lte('jobs.start_time', endDate.toISOString())
        .order('start_time', { referencedTable: 'jobs' });

      if (error) {
        console.error('Error fetching assignments:', error);
        return [];
      }

      return jobAssignments
        .filter(assignment => assignment.jobs)
        .map(assignment => {
          let department = "unknown";
          if (assignment.sound_role) department = "sound";
          else if (assignment.lights_role) department = "lights";
          else if (assignment.video_role) department = "video";

          const category = getCategoryFromAssignment(assignment);

          return {
            id: `job-${assignment.job_id}`,
            job_id: assignment.job_id,
            technician_id: assignment.technician_id,
            department,
            role: assignment.sound_role || assignment.lights_role || assignment.video_role || "Assigned",
            category,
            sound_role: assignment.sound_role,
            lights_role: assignment.lights_role,
            video_role: assignment.video_role,
            jobs: assignment.jobs
          };
        });
    },
    'job_assignments',
    {
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
    }
  );

  const t = getThemeStyles(isDark);

  const handleOpenAction = (action: string, job?: any) => {
    setSelectedJob(job);
    setActiveModal(action);
  };

  const userName = userProfile?.first_name && userProfile?.last_name
    ? `${userProfile.first_name} ${userProfile.last_name}`
    : user?.email || 'Técnico';

  return (
    <div className={`min-h-screen flex flex-col ${t.bg} transition-colors duration-300 font-sans`}>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        {tab === 'dashboard' && (
          <DashboardScreen
            theme={t}
            isDark={isDark}
            user={user}
            userProfile={userProfile}
            assignments={assignments}
            isLoading={isLoading}
            onOpenAction={handleOpenAction}
            onOpenSV={() => setActiveModal('soundvision')}
            onOpenObliqueStrategy={() => setShowObliqueStrategy(true)}
            onOpenTour={(tourId) => setSelectedTourId(tourId)}
          />
        )}
        {tab === 'jobs' && (
          <JobsView
            theme={t}
            isDark={isDark}
            assignments={assignments}
            isLoading={isLoading}
            onOpenAction={handleOpenAction}
            techName={userName}
            onOpenObliqueStrategy={() => setShowObliqueStrategy(true)}
          />
        )}
        {tab === 'availability' && (
          <AvailabilityView theme={t} isDark={isDark} />
        )}
        {tab === 'profile' && (
          <ProfileView
            theme={t}
            isDark={isDark}
            user={user}
            userProfile={userProfile}
            toggleTheme={toggleTheme}
          />
        )}
      </div>

      {/* Navigation */}
      <div className={`h-20 ${t.nav} fixed bottom-0 w-full grid grid-cols-4 px-2 z-40 pb-4`}>
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Panel' },
          { id: 'jobs', icon: Briefcase, label: 'Trabajos' },
          { id: 'availability', icon: CalendarIcon, label: 'Disponib.' },
          { id: 'profile', icon: User, label: 'Perfil' }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex flex-col items-center justify-center gap-1 ${tab === item.id ? 'text-blue-500' : isDark ? 'text-gray-500' : 'text-slate-400'
              }`}
          >
            <item.icon size={22} strokeWidth={tab === item.id ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Modals */}
      {activeModal === 'timesheet' && selectedJob && (
        <TimesheetModal theme={t} isDark={isDark} job={selectedJob} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'details' && selectedJob && (
        <DetailsModal theme={t} isDark={isDark} job={selectedJob} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'soundvision' && (
        <SoundVisionModal theme={t} isDark={isDark} onClose={() => setActiveModal(null)} />
      )}
      {showObliqueStrategy && (
        <ObliqueStrategyModal theme={t} isDark={isDark} onClose={() => setShowObliqueStrategy(false)} />
      )}
      {selectedTourId && (
        <TourDetailView
          tourId={selectedTourId}
          theme={t}
          isDark={isDark}
          onClose={() => setSelectedTourId(null)}
          onOpenJob={(jobId) => {
            // Find the job in assignments or fetch it
            const assignment = assignments.find(a => a.job_id === jobId || a.jobs?.id === jobId);
            if (assignment) {
              setSelectedJob(assignment);
              setActiveModal('details');
            }
          }}
        />
      )}
    </div>
  );
}
