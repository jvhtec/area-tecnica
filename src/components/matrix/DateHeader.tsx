
import React from 'react';
import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { MADRID_TIMEZONE, formatMadridDateKey, formatMadridDayKey, isMadridToday, isMadridWeekend } from '@/utils/timezoneUtils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { dataLayerClient } from '@/services/dataLayerClient';
import { queryKeys } from "@/lib/react-query";
import type { MatrixOpenSlots } from "@/components/matrix/optimized-assignment-matrix/useMatrixHeaderCounts";
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
  /** Technicians with an active timesheet on this day (see useMatrixHeaderCounts). */
  confirmedCount?: number;
  /** Role slots across the day's jobs; null until loaded, and never on mobile. */
  openSlots?: MatrixOpenSlots | null;
  /** Mobile layout: drops the month/year lines and puts the badges on one row. */
  compact?: boolean;
  onJobClick?: (jobId: string) => void;
}

// Lightweight per-job engagement counts scoped to current filtered technicians
// Timesheets are the source of truth for actual scheduled assignments
function useJobEngagementCounts(jobId: string, technicianIds: string[] | undefined) {
  return useQuery({
    queryKey: queryKeys.scope('matrix-job-engagement-counts', jobId, (technicianIds || []).join(',')),
    queryFn: async () => {
      if (!jobId || !technicianIds?.length) return { invitations: 0, offers: 0, confirmations: 0 } as const;

      // Use the new staffing RPC which already normalizes latest statuses per technician/job
      const normalizeAvailability = (s: string | null) => {
        if (!s) return null;
        if (s === 'pending') return 'requested';
        if (s === 'expired') return null;
        return s;
      };
      const normalizeOffer = (s: string | null) => {
        if (!s) return null;
        if (s === 'pending') return 'sent';
        if (s === 'expired') return null;
        return s;
      };

      let invitations = 0; // availability requested
      let offers = 0;      // offer sent

      const { data: staffingData, error: staffingErr } = await dataLayerClient.rpc('get_assignment_matrix_staffing_filtered', {
          p_job_ids: [jobId],
          p_profile_ids: technicianIds,
        });

      if (staffingErr) {
        console.warn('Counts staffing RPC error', staffingErr);
      } else {
        (staffingData || []).forEach((r: any) => {
          const av = normalizeAvailability(r.availability_status);
          const of = normalizeOffer(r.offer_status);
          if (av === 'requested') invitations++;
          if (of === 'sent') offers++;
        });
      }

      // Fallback to raw staffing_requests if RPC returned nothing (e.g., old rows without view coverage)
      if ((staffingErr || !(staffingData || []).length)) {
        const { data: reqRows, error: reqErr } = await dataLayerClient.from('staffing_requests')
          .select('job_id, profile_id, phase, status, updated_at')
          .eq('job_id', jobId)
          .in('profile_id', technicianIds);
        if (reqErr) {
          console.warn('Counts staffing_requests error', reqErr);
        }

        const latestByTechPhase = new Map<string, { phase: 'availability' | 'offer'; status: string | null; t: number }>();
        (reqRows || []).forEach((r: any) => {
          const key = `${r.profile_id}-${r.phase}`;
          const t = r.updated_at ? new Date(r.updated_at).getTime() : 0;
          const cur = latestByTechPhase.get(key);
          if (!cur || t > cur.t) latestByTechPhase.set(key, { phase: r.phase, status: r.status, t });
        });

        invitations = 0;
        offers = 0;
        latestByTechPhase.forEach((v) => {
          if (v.phase === 'availability' && (v.status === 'pending' || v.status === 'requested')) invitations++;
          if (v.phase === 'offer' && (v.status === 'pending' || v.status === 'sent')) offers++;
        });
      }

      // Confirmed/scheduled technicians from timesheets (source of truth)
      // Count unique technicians with timesheets for this job
      const { data: tsData, error: tsErr } = await dataLayerClient.from('timesheets')
        .select('technician_id')
        .eq('job_id', jobId)
        .eq('is_active', true)
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
    // Kept fresh by invalidateAssignmentQueries (which now covers these count
    // scopes) rather than by a 2s staleTime that refetched on every scroll.
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!jobId,
  });
}

const DateHeaderComp = ({
  date,
  width,
  jobs = [],
  technicianIds,
  confirmedCount: confirmedForDate = 0,
  openSlots = null,
  compact = false,
  onJobClick,
}: DateHeaderProps) => {
  // One Madrid day key, and memoised labels off it, instead of five timezone
  // conversions per header render.
  const dateKey = formatMadridDateKey(date);
  const isTodayHeader = isMadridToday(dateKey);
  const isWeekendHeader = isMadridWeekend(dateKey);
  const weekdayLabel = formatMadridDayKey(dateKey, 'EEE', { locale: es });
  const dayLabel = formatMadridDayKey(dateKey, 'd');
  const monthLabel = formatMadridDayKey(dateKey, 'MMM', { locale: es });
  const yearLabel = dayLabel === '1' ? ` ${dateKey.slice(0, 4)}` : '';
  const hasJobs = jobs.length > 0;

  const getJobIndicatorColors = () => {
    if (jobs.length === 0) return [];

    // Get unique colors from jobs, fallback to default colors
    const colors = jobs.map(job => job.color || '#7E69AB');
    return [...new Set(colors)]; // Remove duplicates
  };

  const jobColors = getJobIndicatorColors();
  // Coverage for the date: how many of the required role slots across the day's
  // jobs are actually filled. Desktop only — openSlots is not fetched in compact
  // mode, where there is no room to draw the bar anyway.
  const coverage = React.useMemo(() => {
    if (!openSlots || !openSlots.required) return null;
    const filled = Math.min(openSlots.assigned, openSlots.required);
    return {
      filled,
      required: openSlots.required,
      percent: Math.round((filled / openSlots.required) * 100),
      isComplete: filled >= openSlots.required,
    };
  }, [openSlots]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            'relative flex flex-shrink-0 cursor-pointer flex-col items-center justify-center',
            'border-r border-border/60 bg-card text-center text-xs font-medium transition-colors',
            'hover:bg-accent/50',
            {
              'bg-primary/[0.07] dark:bg-primary/10': isTodayHeader,
              'bg-muted/40 text-muted-foreground': isWeekendHeader && !isTodayHeader,
            }
          )}
          style={{
            width: `${width}px`,
            minWidth: `${width}px`,
            maxWidth: `${width}px`,
            height: '100%'
          }}
        >
          {/* Today rail: the same accent the cells in this column carry. */}
          {isTodayHeader && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" aria-hidden="true" />}

          {compact ? (
            // 50px of header height cannot fit weekday + day + month + a badge
            // column, so mobile shows "Sáb 14" on one line.
            <div className="flex items-baseline gap-1 leading-none">
              <span className="text-xs font-semibold capitalize">
                {weekdayLabel}
              </span>
              <span className={cn('text-sm font-bold', {
                'text-primary': isTodayHeader
              })}>
                {dayLabel}
              </span>
            </div>
          ) : (
            <>
              <div className="text-xs font-semibold uppercase leading-none tracking-wider text-muted-foreground">
                {weekdayLabel}
              </div>
              <div className="flex items-baseline gap-1 leading-none">
                <span className={cn('text-lg font-bold leading-none', {
                  'text-primary': isTodayHeader
                })}>
                  {dayLabel}
                </span>
                <span className="text-xs lowercase text-muted-foreground">
                  {monthLabel}
                  {yearLabel}
                </span>
              </div>

              {/* Staffing coverage for the day, the header's headline number. */}
              {hasJobs && coverage && (
                <div
                  className="mt-1 w-[78%]"
                  title={`${coverage.filled} de ${coverage.required} puestos cubiertos · ${openSlots?.open ?? 0} libres`}
                >
                  <div className="mb-0.5 flex items-center justify-between text-xs font-medium leading-none tabular-nums text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5">
                      <Users className="h-2.5 w-2.5" aria-hidden="true" />
                      {confirmedForDate ?? 0}
                    </span>
                    <span>{coverage.filled}/{coverage.required}</span>
                    <span>{coverage.percent}%</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all', coverage.isComplete ? 'bg-emerald-500' : 'bg-primary')}
                      style={{ width: `${coverage.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Job colour indicators */}
          {hasJobs && (
            <div className="absolute top-1 left-1 flex gap-0.5">
              {jobColors.slice(0, 3).map((color, index) => (
                <div
                  key={index}
                  className="h-1.5 w-1.5 rounded-full ring-1 ring-background"
                  style={{ backgroundColor: color }}
                />
              ))}
              {jobColors.length > 3 && (
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 ring-1 ring-background" />
              )}
            </div>
          )}

          {/* Counts. On desktop the coverage bar already carries the confirmed
              technicians and the open slots, so only the job count is chipped
              here; a phone has no bar and keeps both numbers. */}
          {hasJobs && (
            <div
              className={cn(
                'absolute top-0.5 right-0.5 flex gap-0.5',
                compact ? 'flex-row items-center' : 'flex-col items-end',
              )}
            >
              <Badge variant="secondary" className="h-4 px-1 py-0 text-[10px] leading-none" title="Trabajos en esta fecha">
                {jobs.length}
              </Badge>
              {(compact || !coverage) && (
                <Badge variant="default" className="h-4 px-1 py-0 text-[10px] leading-none" title="Técnicos confirmados en esta fecha">
                  {confirmedForDate}
                </Badge>
              )}
              {!compact && !coverage && openSlots && openSlots.required > 0 && (
                <Badge variant="outline" className="h-4 px-1 py-0 text-[10px] leading-none" title="Vacantes en todos los trabajos">
                  {openSlots.open} libres
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
                {formatInTimeZone(date, MADRID_TIMEZONE, 'EEEE, d MMMM, yyyy', { locale: es })}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{jobs.length} trabajo{jobs.length !== 1 ? 's' : ''} programado{jobs.length !== 1 ? 's' : ''}</span>
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
      title="Haz clic para ordenar técnicos por compromiso para este trabajo"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-medium text-sm">{job.title}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            {formatInTimeZone(job.start_time, MADRID_TIMEZONE, 'HH:mm')} - {formatInTimeZone(job.end_time, MADRID_TIMEZONE, 'HH:mm')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {job.status === 'Cancelado' && (
            <Badge variant="destructive" className="text-[10px]">Llamar para cancelar</Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {job.status}
          </Badge>
        </div>
      </div>
      <div className="mt-2 flex gap-1 flex-wrap">
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5" title="Invitaciones de disponibilidad pendientes">
          Inv: {counts?.invitations ?? 0}
        </Badge>
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5" title="Ofertas pendientes">
          Ofertas: {counts?.offers ?? 0}
        </Badge>
        <Badge variant="default" className="text-[10px] h-5 px-1.5" title="Asignaciones confirmadas">
          Conf: {counts?.confirmations ?? 0}
        </Badge>
      </div>
    </div>
  );
}

export const DateHeader = React.memo(DateHeaderComp);
