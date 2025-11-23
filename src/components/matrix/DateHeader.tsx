
import React from 'react';
import { format, isToday, isWeekend } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface DateHeaderProps {
  date: Date;
  width: number;
  jobs?: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    color?: string;
    status: string;
    _assigned_count?: number;
  }>;
  technicianIds?: string[];
  onJobClick?: (jobId: string) => void;
}

// Lightweight per-job engagement counts scoped to current filtered technicians
// Timesheets are the source of truth for actual scheduled assignments
function useJobEngagementCounts(jobId: string, technicianIds: string[] | undefined) {
  return useQuery({
    queryKey: ['matrix-job-engagement-counts', jobId, (technicianIds || []).join(',')],
    queryFn: async () => {
      if (!jobId || !technicianIds?.length) return { invitations: 0, offers: 0, confirmations: 0 } as const;

      // Fetch latest staffing_requests per (profile_id, phase) for this job
      const { data: reqRows, error: reqErr } = await supabase
        .from('staffing_requests')
        .select('job_id, profile_id, phase, status, updated_at')
        .eq('job_id', jobId)
        .in('profile_id', technicianIds);
      if (reqErr) {
        console.warn('Counts staffing_requests error', reqErr);
      }

      const latestByTechPhase = new Map<string, { phase: 'availability'|'offer'; status: string | null; t: number }>();
      (reqRows || []).forEach((r: any) => {
        const key = `${r.profile_id}-${r.phase}`;
        const t = r.updated_at ? new Date(r.updated_at).getTime() : 0;
        const cur = latestByTechPhase.get(key);
        if (!cur || t > cur.t) latestByTechPhase.set(key, { phase: r.phase, status: r.status, t });
      });

      let invitations = 0; // availability pending
      let offers = 0;      // offer pending
      latestByTechPhase.forEach((v) => {
        if (v.phase === 'availability' && v.status === 'pending') invitations++;
        if (v.phase === 'offer' && v.status === 'pending') offers++;
      });

      // Confirmed/scheduled technicians from timesheets (source of truth)
      // Count unique technicians with timesheets for this job
      const { data: tsData, error: tsErr } = await supabase
        .from('timesheets')
        .select('technician_id')
        .eq('job_id', jobId)
        .in('technician_id', technicianIds);

      if (tsErr) {
        console.warn('Counts timesheets error', tsErr);
      }

      // Count unique technicians
      const uniqueTechs = new Set<string>();
      (tsData || []).forEach((r: any) => { if (r.technician_id) uniqueTechs.add(r.technician_id); });
      const confirmations = uniqueTechs.size;

      return { invitations, offers, confirmations } as const;
    },
    staleTime: 2_000,
    gcTime: 60_000,
    enabled: !!jobId,
  });
}

const DateHeaderComp = ({ date, width, jobs = [], technicianIds, onJobClick }: DateHeaderProps) => {
  const isTodayHeader = isToday(date);
  const isWeekendHeader = isWeekend(date);
  const hasJobs = jobs.length > 0;

  const getJobIndicatorColors = () => {
    if (jobs.length === 0) return [];
    
    // Get unique colors from jobs, fallback to default colors
    const colors = jobs.map(job => job.color || '#7E69AB');
    return [...new Set(colors)]; // Remove duplicates
  };

  const jobColors = getJobIndicatorColors();
  const { data: confirmedForDate } = useDateConfirmedCount(date, jobs, technicianIds);

  // Aggregate open slots across jobs on this date (all departments)
  // Timesheets are source of truth - only count technicians who are actually scheduled
  const jobIds = React.useMemo(() => (jobs || []).map(j => j.id), [jobs]);
  const { data: openSlots } = useQuery({
    queryKey: ['matrix-open-slots', jobIds.join(',')],
    queryFn: async () => {
      if (!jobIds.length) return { required: 0, assigned: 0, open: 0 };

      // First get technicians with timesheets (actually scheduled)
      const { data: timesheetData } = await supabase
        .from('timesheets')
        .select('technician_id, job_id')
        .in('job_id', jobIds);

      // Get unique scheduled technician IDs per job
      const scheduledTechsByJob = new Map<string, Set<string>>();
      (timesheetData || []).forEach((t: any) => {
        if (!scheduledTechsByJob.has(t.job_id)) {
          scheduledTechsByJob.set(t.job_id, new Set());
        }
        scheduledTechsByJob.get(t.job_id)!.add(t.technician_id);
      });

      const allScheduledTechs = new Set<string>();
      (timesheetData || []).forEach((t: any) => allScheduledTechs.add(t.technician_id));

      if (allScheduledTechs.size === 0) {
        // No scheduled technicians, just get required count
        const { data: req } = await supabase
          .from('job_required_roles_summary')
          .select('total_required, job_id')
          .in('job_id', jobIds);
        const required = (req || []).reduce((acc: number, r: any) => acc + (Number(r.total_required || 0)), 0);
        return { required, assigned: 0, open: required };
      }

      // Get requirements and assignments for scheduled technicians
      const [{ data: req }, { data: assignments }] = await Promise.all([
        supabase.from('job_required_roles_summary').select('total_required, job_id').in('job_id', jobIds),
        supabase.from('job_assignments')
          .select('job_id, technician_id, sound_role, lights_role, video_role')
          .in('job_id', jobIds)
          .in('technician_id', Array.from(allScheduledTechs)),
      ]);

      const required = (req || []).reduce((acc: number, r: any) => acc + (Number(r.total_required || 0)), 0);

      // Count assigned roles only for technicians who are actually scheduled (have timesheets)
      let assigned = 0;
      (assignments || []).forEach((a: any) => {
        const scheduledForJob = scheduledTechsByJob.get(a.job_id);
        if (scheduledForJob && scheduledForJob.has(a.technician_id)) {
          if (a.sound_role != null) assigned++;
          if (a.lights_role != null) assigned++;
          if (a.video_role != null) assigned++;
        }
      });

      const open = Math.max(required - assigned, 0);
      return { required, assigned, open };
    },
    staleTime: 10_000,
    enabled: hasJobs,
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div 
          className={cn(
            'border-r text-center text-xs font-medium bg-card cursor-pointer',
            'flex flex-col justify-center items-center relative transition-colors',
            'hover:bg-accent/50 flex-shrink-0',
            {
              'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300': isTodayHeader,
              'bg-muted/50 text-muted-foreground': isWeekendHeader && !isTodayHeader,
              'ring-2 ring-blue-500/30 ring-inset': hasJobs,
            }
          )}
          style={{ 
            width: `${width}px`,
            minWidth: `${width}px`,
            maxWidth: `${width}px`,
            height: '100%'
          }}
        >
          <div className="font-semibold text-xs">
            {format(date, 'EEE')}
          </div>
          <div className={cn('text-base font-bold leading-tight', {
            'text-orange-700 dark:text-orange-300': isTodayHeader
          })}>
            {format(date, 'd')}
          </div>
          <div className="text-xs text-muted-foreground leading-tight">
            {format(date, 'MMM')}
          </div>
          {format(date, 'd') === '1' && (
            <div className="text-xs text-muted-foreground mt-0.5 leading-tight">
              {format(date, 'yyyy')}
            </div>
          )}
          
          {/* Job indicators */}
          {hasJobs && (
            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-1">
              {jobColors.slice(0, 3).map((color, index) => (
                <div
                  key={index}
                  className="w-1.5 h-1.5 rounded-full border border-white dark:border-gray-800"
                  style={{ backgroundColor: color }}
                />
              ))}
              {jobColors.length > 3 && (
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600 border border-white dark:border-gray-800" />
              )}
            </div>
          )}
          
          {/* Job count badge */}
          {hasJobs && (
            <div className="absolute top-0.5 right-0.5 flex flex-col items-end gap-0.5">
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 leading-none" title="Jobs on this date">
                {jobs.length}
              </Badge>
              <Badge variant="default" className="text-[10px] px-1 py-0 h-4 leading-none" title="Confirmed technicians on this date">
                {confirmedForDate ?? 0}
              </Badge>
              {openSlots && openSlots.required > 0 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 leading-none" title="Open slots across jobs">
                  {openSlots.open} open
                </Badge>
              )}
            </div>
          )}
        </div>
      </PopoverTrigger>
      
      {hasJobs && (
        <PopoverContent className="w-80" side="bottom" align="center">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">
                {format(date, 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{jobs.length} job{jobs.length > 1 ? 's' : ''} scheduled</span>
              </div>
              
              {jobs.map((job) => (
                <JobRowWithCounts
                  key={job.id}
                  job={job}
                  technicianIds={technicianIds}
                  onJobClick={onJobClick}
                />
              ))}
            </div>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
};

function JobRowWithCounts({ job, technicianIds, onJobClick }: { job: { id: string; title: string; start_time: string; end_time: string; color?: string; status: string }, technicianIds?: string[], onJobClick?: (jobId: string) => void }) {
  const { data: counts } = useJobEngagementCounts(job.id, technicianIds);
  return (
    <div
      className="p-2 border rounded-lg bg-card hover:bg-accent/30 cursor-pointer"
      style={{ borderLeftColor: job.color || '#7E69AB', borderLeftWidth: '3px' }}
      onClick={(e) => { e.stopPropagation(); onJobClick?.(job.id); }}
      title="Click to sort technicians by engagement for this job"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-medium text-sm">{job.title}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            {format(new Date(job.start_time), 'HH:mm')} - {format(new Date(job.end_time), 'HH:mm')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {job.status === 'Cancelado' && (
            <Badge variant="destructive" className="text-[10px]">Call these people to cancel</Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {job.status}
          </Badge>
        </div>
      </div>
      <div className="mt-2 flex gap-1 flex-wrap">
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5" title="Availability invitations pending">
          Inv: {counts?.invitations ?? 0}
        </Badge>
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5" title="Offers pending">
          Offers: {counts?.offers ?? 0}
        </Badge>
        <Badge variant="default" className="text-[10px] h-5 px-1.5" title="Confirmed assignments">
          Confirmed: {counts?.confirmations ?? 0}
        </Badge>
      </div>
    </div>
  );
}

// Total confirmed/scheduled technicians for a specific date across the provided jobs
// Timesheets are the source of truth for actual scheduled assignments
function useDateConfirmedCount(date: Date, jobs: Array<{ id: string }>, technicianIds?: string[]) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const jobIds = (jobs || []).map(j => j.id);
  return useQuery({
    queryKey: ['matrix-date-confirmed-count', dateStr, jobIds.join(','), (technicianIds || []).join(',')],
    queryFn: async () => {
      if (!jobIds.length) return 0;

      // Query timesheets for the specific date and jobs (source of truth)
      let query = supabase
        .from('timesheets')
        .select('technician_id')
        .in('job_id', jobIds)
        .eq('date', dateStr);

      if (technicianIds && technicianIds.length > 0) {
        query = query.in('technician_id', technicianIds);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Confirmed count error', error);
        return 0;
      }

      // Count unique technicians
      const unique = new Set<string>();
      (data || []).forEach((r: any) => { if (r.technician_id) unique.add(r.technician_id); });
      return unique.size;
    },
    staleTime: 2_000,
    gcTime: 60_000,
    enabled: jobIds.length > 0,
  });
}

export const DateHeader = React.memo(DateHeaderComp);
