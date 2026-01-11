import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addWeeks, addMonths } from 'date-fns';
import {
  LayoutDashboard, Calendar as CalendarIcon, User, Briefcase,
  Euro, X
} from 'lucide-react';

import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { useTechnicianDashboardSubscriptions } from '@/hooks/useMobileRealtimeSubscriptions';
import { useTourRateSubscriptions } from '@/hooks/useTourRateSubscriptions';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { getCategoryFromAssignment } from '@/utils/roleCategory';

import { DashboardScreen } from '@/components/technician/DashboardScreen';
import { JobsView } from '@/components/technician/JobsView';
import { AvailabilityView } from '@/components/technician/AvailabilityView';
import { ProfileView } from '@/components/technician/ProfileView';
import { TimesheetView } from '@/components/technician/TimesheetView';
import { DetailsModal } from '@/components/technician/DetailsModal';
import { ObliqueStrategyModal } from '@/components/technician/ObliqueStrategyModal';
import { MessagesModal } from '@/components/technician/MessagesModal';
import { TourDetailView } from '@/components/technician/TourDetailView';
import { SoundVisionModal } from '@/components/technician/SoundVisionModal';
import { TechnicianTourRates } from '@/components/dashboard/TechnicianTourRates';

// Type definitions
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
  created_at?: string;
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
  jobs: TechnicianJobData;
}

// Theme styles helper
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

const TechnicianDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'dashboard';

  const setTab = (newTab: string) => {
    setSearchParams({ tab: newTab });
  };

  const { theme: nextTheme, setTheme } = useTheme();
  const { user, hasSoundVisionAccess } = useOptimizedAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Determine if dark mode
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

  const assignmentsQueryKey = useMemo(
    () => ['assignments-technician-dashboard'],
    []
  );

  // Set up real-time subscriptions
  useTechnicianDashboardSubscriptions();
  useTourRateSubscriptions();

  // Fetch user profile
  const { data: userProfile } = useRealtimeQuery(
    ['user-profile', user?.id],
    async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, nickname, phone, residencia, dni, bg_color, profile_picture_url, role, department')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    'profiles',
    {
      enabled: !!user?.id,
    }
  );

  // Fetch assignments (past 3 months to future 3 months)
  const { data: assignments = [], isLoading } = useRealtimeQuery(
    assignmentsQueryKey,
    async () => {
      if (!user?.id) return [];

      const startDate = addMonths(new Date(), -3);
      const endDate = addMonths(new Date(), 3);

      // Step 1: Fetch confirmed job assignments to get role/status info
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('job_assignments')
        .select('job_id, sound_role, lights_role, video_role, status, assigned_at')
        .eq('technician_id', user.id)
        .eq('status', 'confirmed');

      if (assignmentsError) {
        console.error('Error fetching job assignments:', assignmentsError);
        toast.error('Error loading assignment roles');
        return [];
      }

      if (!assignmentsData || assignmentsData.length === 0) {
        return [];
      }

      // Create a map for quick role lookup and a list of job IDs to fetch
      const assignmentsByJobId = new Map(
        assignmentsData.map((assignment) => [assignment.job_id, assignment])
      );
      const jobIds = Array.from(new Set(assignmentsData.map((assignment) => assignment.job_id)));

      // Step 2: Fetch timesheets (with jobs) for those assignments
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

      // Deduplicate by job_id
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
    setSelectedJob(jobData || null);
    setActiveModal(action);
  };

  const userName = userProfile?.first_name && userProfile?.last_name
    ? `${userProfile.first_name} ${userProfile.last_name}`
    : user?.email || 'Técnico';

  return (
    <div className={`min-h-screen flex flex-col ${t.bg} transition-colors duration-300 font-sans`}>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-1 pb-24">
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
            onOpenSysCalc={() => navigate('/syscalc')}
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
        <DetailsModal theme={t} isDark={isDark} job={selectedJob as any} onClose={() => setActiveModal(null)} />
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
};

export default TechnicianDashboard;
