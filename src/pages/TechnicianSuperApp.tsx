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
import { format, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCategoryFromAssignment } from '@/utils/roleCategory';
import { labelForCode } from '@/utils/roles';

import {
  LayoutDashboard, Calendar as CalendarIcon, User, Menu,
  MapPin, Clock, ChevronRight, FileText, CheckCircle2,
  AlertTriangle, X, ArrowRight, Sun, Moon,
  Gamepad2, MessageSquare, Ban, Wallet, ChevronLeft,
  MoreVertical, Plus, Trash2, Palmtree, Coffee, LogOut,
  Shield, Bell, Lock, Smartphone, Mail, Phone, CreditCard,
  Check, Camera, Palette, Navigation, Utensils, CloudRain,
  Download, Send, RefreshCw, UploadCloud, Play, Sliders,
  Radio, Mic2, Speaker, ListMusic, Save, ArrowLeft, Activity,
  Search, Filter, Map as MapIcon, Layers, Globe, LayoutList, LayoutGrid,
  Loader2, Eye, Briefcase, Shuffle, Lightbulb, Sparkles, Users, Euro
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
import { TechnicianTourRates } from '@/components/dashboard/TechnicianTourRates';
import { SendMessage } from '@/components/messages/SendMessage';
import { MessagesList } from '@/components/messages/MessagesList';
import { DirectMessagesList } from '@/components/messages/DirectMessagesList';
import { TechJobCard } from '@/components/technician/TechJobCard';
import { JobsView } from '@/components/technician/JobsView';
import { TourCard } from '@/components/technician/TourCard';
import { DashboardScreen } from '@/components/technician/DashboardScreen';
import { ProfileView } from '@/components/technician/ProfileView';
import { AvailabilityView } from '@/components/technician/AvailabilityView';
import { TourDetailView } from '@/components/technician/TourDetailView';
import { MessagesModal } from '@/components/technician/MessagesModal';
import { SoundVisionModal } from '@/components/technician/SoundVisionModal';
import { ObliqueStrategyModal } from '@/components/technician/ObliqueStrategyModal';
import { TimesheetView } from '@/components/technician/TimesheetView';
import { DetailsModal } from '@/components/technician/DetailsModal';

// --- TYPE DEFINITIONS ---
interface TechnicianJobData {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  timezone?: string;
  location_id?: string;
  job_type?: string;
  color?: string;
  status?: string;
  location?: { name: string } | null;
  job_documents?: Array<{
    id: string;
    file_name: string;
    file_path: string;
    visible_to_tech?: boolean;
    uploaded_at?: string;
    read_only?: boolean;
    template_type?: string | null;
  }>;
}

interface TechnicianAssignment {
  id: string;
  job_id: string;
  technician_id: string;
  department: string;
  role: string;
  category: string;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  single_day?: boolean | null;
  assignment_date?: string | null;
  jobs: TechnicianJobData;
}

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

// --- MAIN APP SHELL ---
export default function TechnicianSuperApp() {
  const [tab, setTab] = useState('dashboard');
  const { theme: nextTheme, setTheme } = useTheme();
  const { user, hasSoundVisionAccess } = useOptimizedAuth();
  const queryClient = useQueryClient();

  // Determine if dark mode (guard for SSR/test environments)
  const isDark = nextTheme === 'dark' || (
    nextTheme === 'system' &&
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  // Modal state
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<TechnicianJobData | null>(null);
  const [showObliqueStrategy, setShowObliqueStrategy] = useState(false);
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);

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

      // First, fetch job_assignments for this technician to get roles and status
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('job_assignments')
        .select('job_id, sound_role, lights_role, video_role, status, assigned_at, single_day, assignment_date')
        .eq('technician_id', user.id)
        .eq('status', 'confirmed');

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError);
        return [];
      }

      if (!assignmentsData || assignmentsData.length === 0) {
        return [];
      }

      // Get unique job IDs from assignments
      const jobIds = assignmentsData.map(a => a.job_id);

      // Then fetch timesheets and jobs for those job IDs
      const { data: timesheetData, error } = await supabase
        .from('timesheets')
        .select(`
          job_id,
          technician_id,
          date,
          jobs!inner (
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
        .eq('is_active', true)
        .in('job_id', jobIds)
        .gte('jobs.start_time', startDate.toISOString())
        .lte('jobs.start_time', endDate.toISOString())
        .order('start_time', { referencedTable: 'jobs' });

      if (error) {
        console.error('Error fetching assignments:', error);
        return [];
      }

      // Create a map of job_id to assignment for quick lookup
      const assignmentsByJobId = new Map(
        assignmentsData.map(a => [a.job_id, a])
      );

      // Deduplicate by job_id (timesheets have one row per date, we want one per job)
      const seenJobIds = new Set<string>();
      const jobAssignments = (timesheetData || []).filter(row => {
        if (seenJobIds.has(row.job_id)) return false;
        seenJobIds.add(row.job_id);
        return true;
      });

      return jobAssignments
        .filter(row => row.jobs)
        .map(row => {
          let department = "unknown";
          const assignment = assignmentsByJobId.get(row.job_id);
          if (assignment?.sound_role) department = "sound";
          else if (assignment?.lights_role) department = "lights";
          else if (assignment?.video_role) department = "video";

          const category = getCategoryFromAssignment({
            sound_role: assignment?.sound_role,
            lights_role: assignment?.lights_role,
            video_role: assignment?.video_role
          });

          return {
            id: `job-${row.job_id}`,
            job_id: row.job_id,
            technician_id: row.technician_id,
            department,
            role: assignment?.sound_role || assignment?.lights_role || assignment?.video_role || "Assigned",
            category,
            sound_role: assignment?.sound_role,
            lights_role: assignment?.lights_role,
            video_role: assignment?.video_role,
            single_day: assignment?.single_day,
            assignment_date: assignment?.assignment_date,
            jobs: row.jobs
          };
        });
    },
    'timesheets',
    {
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
    }
  );

  const t = getThemeStyles(isDark);

  const handleOpenAction = (action: string, jobData?: TechnicianJobData) => {
    // TechJobCard already extracts job data before calling onAction
    setSelectedJob(jobData || null);
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
            onOpenRates={() => setShowRatesModal(true)}
            onOpenMessages={() => setShowMessagesModal(true)}
            hasSoundVisionAccess={hasSoundVisionAccess}
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
        <TimesheetView
          theme={t}
          isDark={isDark}
          job={selectedJob}
          onClose={() => setActiveModal(null)}
          userRole={userProfile?.role || null}
          userId={user?.id || null}
        />
      )}
      {activeModal === 'details' && selectedJob && (
        <DetailsModal theme={t} isDark={isDark} job={selectedJob} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'soundvision' && hasSoundVisionAccess && (
        <SoundVisionModal theme={t} isDark={isDark} onClose={() => setActiveModal(null)} />
      )}
      {showObliqueStrategy && (
        <ObliqueStrategyModal theme={t} isDark={isDark} onClose={() => setShowObliqueStrategy(false)} />
      )}
      {showRatesModal && (
        <div className={`fixed inset-0 z-[70] flex items-center justify-center ${t.modalOverlay} p-4 animate-in fade-in duration-200`}>
          <div className={`w-full max-w-2xl max-h-[90vh] ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${t.divider} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col`}>
            {/* Header */}
            <div className={`p-4 border-b ${t.divider} flex justify-between items-center shrink-0`}>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500 text-white">
                  <Euro size={18} />
                </div>
                <h2 className={`text-lg font-bold ${t.textMain}`}>Mis tarifas</h2>
              </div>
              <button onClick={() => setShowRatesModal(false)} className={`p-2 ${t.textMuted} hover:${t.textMain} rounded-full transition-colors`}>
                <X size={20} />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <TechnicianTourRates theme={t} isDark={isDark} />
            </div>
          </div>
        </div>
      )}
      {showMessagesModal && (
        <MessagesModal
          theme={t}
          isDark={isDark}
          userProfile={userProfile}
          onClose={() => setShowMessagesModal(false)}
        />
      )}
      {selectedTourId && (
        <TourDetailView
          tourId={selectedTourId}
          theme={t}
          isDark={isDark}
          onClose={() => setSelectedTourId(null)}
          onOpenJob={(jobId) => {
            // Find the job in assignments and pass the job data, not the assignment
            const assignment = (assignments as TechnicianAssignment[]).find(
              a => a.job_id === jobId || a.jobs?.id === jobId
            );
            if (assignment?.jobs) {
              setSelectedJob(assignment.jobs);
              setActiveModal('details');
            }
          }}
        />
      )}
    </div>
  );
}
