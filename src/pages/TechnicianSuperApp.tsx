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
  Loader2, Eye, Briefcase
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TechnicianIncidentReportDialog } from '@/components/incident-reports/TechnicianIncidentReportDialog';
import { JobDetailsDialog } from '@/components/jobs/JobDetailsDialog';

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

// --- JOB CARD COMPONENT ---
interface JobCardProps {
  job: any;
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
  onAction: (action: string, job?: any) => void;
  isCrewChief: boolean;
  techName?: string;
}

const TechJobCard = ({ job, theme, isDark, onAction, isCrewChief, techName }: JobCardProps) => {
  const [showEasterEgg, setShowEasterEgg] = useState(false);

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

      {/* Easter Egg Overlay */}
      {showEasterEgg && (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center animate-in fade-in">
          <div className="text-center">
            <div className="text-4xl mb-2 animate-bounce">👾</div>
            <h3 className="text-emerald-400 font-mono font-bold text-lg">LEVEL UP!</h3>
            <p className="text-white text-xs mb-4">Crew Chief Mode Active</p>
            <button
              onClick={(e) => { e.stopPropagation(); setShowEasterEgg(false); }}
              className="px-4 py-1 bg-emerald-600 rounded text-xs font-bold text-white hover:bg-emerald-500"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`font-bold text-lg ${theme.textMain}`}>{jobData?.title || 'Sin título'}</h3>
            {isCrewChief && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowEasterEgg(true); }}
                className="text-emerald-500/20 hover:text-emerald-400 transition-colors p-1"
              >
                <Gamepad2 size={16} />
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

// --- JOB DETAILS MODAL ---
interface DetailsModalProps {
  theme: ReturnType<typeof getThemeStyles>;
  isDark: boolean;
  job: any;
  onClose: () => void;
}

const DetailsModal = ({ theme, isDark, job, onClose }: DetailsModalProps) => {
  const [documentLoading, setDocumentLoading] = useState<Set<string>>(new Set());

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

  const jobDate = job?.start_time
    ? format(new Date(job.start_time), "PPP", { locale: es })
    : "Fecha no disponible";

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="bottom" className={`h-[80vh] rounded-t-2xl ${isDark ? 'bg-[#0f1219]' : 'bg-white'}`}>
        <SheetHeader className={`mb-4 border-b pb-4 ${theme.divider}`}>
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-500" />
            <SheetTitle className={theme.textMain}>{job?.title || 'Sin título'}</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100%-80px)]">
          <div className="space-y-6 pr-4">
            {/* Location */}
            <div>
              <h3 className={`text-xs font-bold uppercase ${theme.textMuted} mb-2`}>Ubicación</h3>
              <div className={`p-3 rounded-lg border ${theme.card} flex gap-3`}>
                <div className={`w-12 h-12 ${isDark ? 'bg-gray-800' : 'bg-slate-100'} rounded-lg flex items-center justify-center`}>
                  <MapPin size={20} className={theme.textMuted} />
                </div>
                <div>
                  <div className={`font-bold ${theme.textMain}`}>{job?.location?.name || 'Sin ubicación'}</div>
                  <div className={`text-xs ${theme.textMuted}`}>{jobDate}</div>
                </div>
              </div>
            </div>

            {/* Description */}
            {job?.description && (
              <div>
                <h3 className={`text-xs font-bold uppercase ${theme.textMuted} mb-2`}>Descripción</h3>
                <p className={`text-sm ${theme.textMain}`}>{job.description}</p>
              </div>
            )}

            {/* Documents */}
            {job?.job_documents && job.job_documents.length > 0 && (
              <div>
                <h3 className={`text-xs font-bold uppercase ${theme.textMuted} mb-2`}>Documentos</h3>
                <div className="space-y-2">
                  {job.job_documents.map((doc: any) => (
                    <div key={doc.id} className={`p-3 rounded-lg border ${theme.card} flex justify-between items-center`}>
                      <div className="flex items-center gap-3">
                        <FileText size={16} className={theme.textMuted} />
                        <div>
                          <span className={`text-sm font-medium ${theme.textMain}`}>{doc.file_name}</span>
                          {doc.template_type === 'soundvision' && (
                            <Badge variant="outline" className="ml-2 text-[10px]">SoundVision</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDocument(doc)}
                          disabled={documentLoading.has(doc.id)}
                        >
                          {documentLoading.has(doc.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(doc)}
                          disabled={documentLoading.has(doc.id)}
                        >
                          {documentLoading.has(doc.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
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
}

const DashboardScreen = ({ theme, isDark, user, userProfile, assignments, isLoading, onOpenAction, onOpenSV }: DashboardScreenProps) => {
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
        </div>
      </div>

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
}

const JobsView = ({ theme, isDark, assignments, isLoading, onOpenAction, techName }: JobsViewProps) => {
  const isCrewChief = assignments.some(a => {
    const category = getCategoryFromAssignment(a);
    return category === 'responsable';
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className={`text-2xl font-bold ${theme.textMain}`}>Mis trabajos</h1>
        <Badge variant="outline">{assignments.length} asignaciones</Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : assignments.length === 0 ? (
        <div className={`p-12 rounded-xl border ${theme.card} text-center`}>
          <Briefcase size={48} className={`mx-auto mb-4 ${theme.textMuted}`} />
          <p className={theme.textMuted}>No tienes asignaciones próximas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment, index) => (
            <TechJobCard
              key={assignment.id || index}
              job={assignment}
              theme={theme}
              isDark={isDark}
              onAction={onOpenAction}
              isCrewChief={isCrewChief}
              techName={techName}
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

  // Fetch assignments
  const { data: assignments = [], isLoading } = useRealtimeQuery(
    ['assignments-superapp'],
    async () => {
      if (!user?.id) return [];

      const endDate = addWeeks(new Date(), 2);

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
        .lte('jobs.start_time', endDate.toISOString())
        .gte('jobs.end_time', new Date().toISOString())
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
    </div>
  );
}
