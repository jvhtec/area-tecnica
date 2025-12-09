import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Calendar as CalendarIcon, User, Briefcase,
  Euro, X
} from 'lucide-react';

import { useTechnicianDashboardSubscriptions } from '@/hooks/useMobileRealtimeSubscriptions';
import { useTourRateSubscriptions } from '@/hooks/useTourRateSubscriptions';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useAssignments, type TechnicianJobData, type TechnicianAssignment } from '@/hooks/useAssignments';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { supabase } from '@/integrations/supabase/client';

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
        .select('first_name, last_name, nickname, role, department')
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

  // Fetch assignments using shared hook
  const { assignments, isLoading } = useAssignments({
    userId: user?.id,
    queryKey: ['assignments-technician-dashboard', user?.id],
  });

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
