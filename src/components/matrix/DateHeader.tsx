
import React from 'react';
import { format, isToday, isWeekend } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  calculateOpenSlotTotals,
  EMPTY_DATE_COVERAGE_SUMMARY,
  summarizeDateCoverage,
  type DateCoverageSummary,
  type TimesheetCoverageRow,
  type AssignmentMetaRow,
  type RequiredRoleRow,
} from '@/components/matrix/utils/dateCoverage';

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

      // Confirmed assignments for this job among current technicians
      const { count: confirmations = 0 } = await supabase
        .from('job_assignments')
        .select('job_id', { count: 'exact' })
        .eq('job_id', jobId)
        .eq('status', 'confirmed')
        .in('technician_id', technicianIds)
        .limit(1);

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
  const jobIds = React.useMemo(() => (jobs || []).map(j => j.id).filter(Boolean), [jobs]);
  const coverageQuery = useDateCoverageMetrics(date, jobIds, technicianIds);
  const coverage = coverageQuery.data || EMPTY_DATE_COVERAGE_SUMMARY;
  const confirmedForDate = coverage.confirmedCount;

  // Aggregate open slots across jobs on this date (all departments)
  const { data: requiredRoles } = useQuery({
    queryKey: ['matrix-required-roles', jobIds.join(',')],
    queryFn: async () => {
      if (!jobIds.length) return [] as RequiredRoleRow[];
      const { data, error } = await supabase
        .from('job_required_roles_summary')
        .select('job_id, department, roles')
        .in('job_id', jobIds);
      if (error) {
        console.warn('Matrix required roles query error', error);
        return [] as RequiredRoleRow[];
      }
      return (data || []) as RequiredRoleRow[];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: hasJobs,
  });

  const openSlots = React.useMemo(() => {
    if (!hasJobs) return null;
    const rows = requiredRoles || [];
    return calculateOpenSlotTotals(rows, coverage.roleCounts);
  }, [coverage.roleCounts, hasJobs, requiredRoles]);

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

interface DateCoverageArgs {
  dateStr: string;
  jobIds: string[];
  technicianIds?: string[];
}

async function fetchDateCoverageMetrics({
  dateStr,
  jobIds,
  technicianIds,
}: DateCoverageArgs): Promise<DateCoverageSummary> {
  if (!jobIds.length) return EMPTY_DATE_COVERAGE_SUMMARY;
  if (technicianIds && technicianIds.length === 0) return EMPTY_DATE_COVERAGE_SUMMARY;

  let timesheetQuery = supabase
    .from('timesheets')
    .select('job_id, technician_id')
    .eq('date', dateStr)
    .eq('is_schedule_only', false)
    .in('job_id', jobIds)
    .order('job_id', { ascending: true })
    .limit(5000);

  if (technicianIds?.length) {
    timesheetQuery = timesheetQuery.in('technician_id', technicianIds);
  }

  const { data: timesheetRows, error: timesheetError } = await timesheetQuery;
  if (timesheetError) {
    console.warn('Matrix date coverage timesheet error', timesheetError);
    return EMPTY_DATE_COVERAGE_SUMMARY;
  }

  const normalizedRows = (timesheetRows || []).filter(
    (row): row is TimesheetCoverageRow => Boolean(row?.job_id && row?.technician_id)
  );

  if (!normalizedRows.length) return EMPTY_DATE_COVERAGE_SUMMARY;

  const technicianSet = Array.from(new Set(normalizedRows.map((row) => row.technician_id).filter(Boolean)));
  if (!technicianSet.length) return EMPTY_DATE_COVERAGE_SUMMARY;

  let assignmentsQuery = supabase
    .from('job_assignments')
    .select('job_id, technician_id, status, sound_role, lights_role, video_role')
    .in('job_id', jobIds);

  if (technicianSet.length) {
    assignmentsQuery = assignmentsQuery.in('technician_id', technicianSet);
  }

  const { data: assignmentRows, error: assignmentError } = await assignmentsQuery;
  if (assignmentError) {
    console.warn('Matrix date coverage assignment error', assignmentError);
    return summarizeDateCoverage(normalizedRows, []);
  }

  return summarizeDateCoverage(
    normalizedRows,
    (assignmentRows || []) as AssignmentMetaRow[]
  );
}

function useDateCoverageMetrics(date: Date, jobIds: string[], technicianIds?: string[]) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const technicianKey = (technicianIds || []).join(',');
  return useQuery({
    queryKey: ['matrix-date-coverage', dateStr, jobIds.join(','), technicianKey],
    queryFn: () => fetchDateCoverageMetrics({ dateStr, jobIds, technicianIds }),
    staleTime: 5_000,
    gcTime: 60_000,
    enabled: jobIds.length > 0 && (!technicianIds || technicianIds.length > 0),
  });
}

export const DateHeader = React.memo(DateHeaderComp);
