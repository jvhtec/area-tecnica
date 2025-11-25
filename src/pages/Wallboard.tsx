import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { ANNOUNCEMENT_LEVEL_STYLES, type AnnouncementLevel } from '@/constants/announcementLevels';
import { Plane, Wrench, Star, Moon, Mic } from 'lucide-react';
import SplashScreen from '@/components/SplashScreen';
import { WallboardApi, WallboardApiError } from '@/lib/wallboard-api';
import { useLgScreensaverBlock } from '@/hooks/useLgScreensaverBlock';

type Dept = 'sound' | 'lights' | 'video';

interface JobsOverviewFeed { jobs: Array<{ id: string; title: string; start_time: string; end_time: string; location: { name: string | null } | null; departments: Dept[]; crewAssigned: Record<string, number>; crewNeeded: Record<string, number>; docs: Record<string, { have: number; need: number }>; status: 'green' | 'yellow' | 'red'; color?: string | null; job_type?: string | null; }> }
type JobsOverviewJob = JobsOverviewFeed['jobs'][number];
type CalendarFeed = {
  jobs: JobsOverviewJob[];
  jobsByDate: Record<string, JobsOverviewJob[]>;
  jobDateLookup: Record<string, string>;
  range: { start: string; end: string };
  focusMonth: number;
  focusYear: number;
};
type TimesheetStatus = 'submitted' | 'draft' | 'missing' | 'approved' | 'rejected';

interface CrewAssignmentsFeed {
  jobs: Array<{
    id: string;
    title: string;
    jobType?: string | null;
    start_time?: string;
    end_time?: string;
    color?: string | null;
    crew: Array<{
      name: string;
      role: string;
      dept: Dept | null;
      timesheetStatus: TimesheetStatus;
    }>;
  }>;
}
interface DocProgressFeed {
  jobs: Array<{
    id: string;
    title: string;
    color?: string | null;
    departments: Array<{ dept: Dept; have: number; need: number; missing: string[] }>;
  }>;
}
interface PendingActionsFeed { items: Array<{ severity: 'red' | 'yellow'; text: string }> }
interface LogisticsItem {
  id: string;
  date: string;
  time: string;
  title: string;
  transport_type: string | null;
  plate: string | null;
  job_title?: string | null;
  procedure: string | null;
  loadingBay: string | null;
  departments: string[];
  color?: string | null;
}

const PanelContainer: React.FC<{ children: React.ReactNode; theme?: 'light' | 'dark' }> = ({ children, theme = 'light' }) => (
  <div className={`w-full p-6 space-y-4 ${theme === 'light' ? 'bg-white text-zinc-900' : 'bg-black text-white'}`}>
    {children}
  </div>
);

const StatusDot: React.FC<{ color: 'green' | 'yellow' | 'red' }> = ({ color }) => (
  <span className={`inline-block w-3 h-3 rounded-full mr-2 ${color === 'green' ? 'bg-green-500' : color === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'}`} />
);

function translateTimesheetStatus(status: TimesheetStatus): string {
  switch (status) {
    case 'approved': return 'aprobado';
    case 'submitted': return 'enviado';
    case 'draft': return 'borrador';
    case 'missing': return 'faltante';
    case 'rejected': return 'rechazado';
    default: return status;
  }
}

function formatJobTypeLabel(jobType?: string | null): string | null {
  const jt = (jobType || '').toLowerCase();
  switch (jt) {
    case 'single': return 'Evento único';
    case 'tour': return 'Gira';
    case 'tourdate': return 'Fecha de gira';
    case 'festival': return 'Festival';
    case 'dryhire': return 'Dry hire';
    default: return null;
  }
}

function formatJobDateTypeLabel(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const sameDay = s.getFullYear() === e.getFullYear()
    && s.getMonth() === e.getMonth()
    && s.getDate() === e.getDate();
  if (sameDay) return '1 día';
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / MS_PER_DAY) + 1);
  return `${days} días`;
}

function getJobCardBackground(colorHex?: string | null, theme: 'light' | 'dark' = 'light'): string {
  if (colorHex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorHex)) {
    // Normalize to 6-digit hex
    let hex = colorHex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const alpha = theme === 'light' ? 0.35 : 0.55; // stronger but still soft
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return theme === 'light' ? '#f4f4f5' : '#020617';
}

type JobDateType = 'travel' | 'setup' | 'show' | 'off' | 'rehearsal';
type LogisticsTransportType = 'trailer' | '9m' | '8m' | '6m' | '4m' | 'furgoneta' | 'rv' | string;
type LogisticsEventType = 'load' | 'unload' | string;

function getDateTypeForJobOnDay(job: { id: string; job_type?: string | null; start_time: string; end_time: string }, day: Date): JobDateType | null {
  const isTourdate = String(job.job_type || '').toLowerCase() === 'tourdate';
  if (!isTourdate) return null;
  // For wallboard context we approximate: show icon if multi-day, otherwise setup/show based on duration
  const s = new Date(job.start_time);
  const e = new Date(job.end_time);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const sameDay = s.toDateString() === e.toDateString();
  if (!sameDay) return 'travel';
  const hours = (e.getTime() - s.getTime()) / 3600000;
  if (hours >= 6) return 'show';
  if (hours >= 3) return 'rehearsal';
  return 'setup';
}

function getDateTypeIcon(type: JobDateType | null): JSX.Element | null {
  if (!type) return null;
  switch (type) {
    case 'travel': return <Plane className="w-4 h-4" />;
    case 'setup': return <Wrench className="w-4 h-4" />;
    case 'show': return <Star className="w-4 h-4" />;
    case 'off': return <Moon className="w-4 h-4" />;
    case 'rehearsal': return <Mic className="w-4 h-4" />;
    default: return null;
  }
}

function getTransportIcon(transportType: LogisticsTransportType | null, eventType: LogisticsEventType | null, className?: string): JSX.Element {
  const base = (transportType || '').toLowerCase();
  const evt = (eventType || '').toLowerCase();
  const isLoad = evt === 'load';
  const isUnload = evt === 'unload';

  let vehicle = '🚚';
  if (base === 'rv') vehicle = '🏕️';
  else if (base === 'furgoneta' || base === 'van') vehicle = '🚐';
  else if (base === 'plane' || base === 'avion') vehicle = '✈️';
  else if (base === 'train') vehicle = '🚆';
  else if (base === 'trailer' || base === '9m' || base === '8m' || base === '6m' || base === '4m') vehicle = '🚛';

  const flip = isUnload;

  return (
    <span
      className={className}
      style={flip ? { display: 'inline-block', transform: 'scaleX(-1)' } : undefined}
    >
      {vehicle}
    </span>
  );
}

// Auto-scroll wrapper component for panels
const AutoScrollWrapper: React.FC<{ children: React.ReactNode; speed?: number; resetKey?: string | number }> = ({ children, speed = 150, resetKey }) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      console.log('AutoScrollWrapper: no container', { speed, resetKey });
      return;
    }

    // Always start from top when content or speed changes
    container.scrollTop = 0;
    console.log('AutoScrollWrapper: starting', {
      speed,
      resetKey,
      clientHeight: container.clientHeight,
      scrollHeight: container.scrollHeight,
      canScroll: container.scrollHeight > container.clientHeight,
    });

    let frameId: number | null = null;
    let lastTime = performance.now();
    let direction: 1 | -1 = 1; // 1 = down, -1 = up
    let isPaused = false;
    let pauseTimeoutId: number | null = null;
    let debugFrames = 0;
    let position = container.scrollTop; // track fractional scroll independently

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (dt <= 0 || dt > 1) {
        // Ignore bogus timestamps (tab switch, etc.)
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      const maxScroll = container.scrollHeight - container.clientHeight;

      if (debugFrames < 10) {
        console.log('AutoScrollWrapper: frame', {
          speed,
          resetKey,
          dt,
          clientHeight: container.clientHeight,
          scrollHeight: container.scrollHeight,
          maxScroll,
          scrollTop: container.scrollTop,
          direction,
          isPaused,
        });
        debugFrames += 1;
      }

      if (maxScroll > 0 && !isPaused) {
        const delta = (speed ?? 0) * dt;
        const before = position;
        let next = before + direction * delta;

        if (direction === 1 && next >= maxScroll) {
          next = maxScroll;
          isPaused = true;
          console.log('AutoScrollWrapper: hit bottom, pausing', { maxScroll });
          pauseTimeoutId = window.setTimeout(() => {
            isPaused = false;
            direction = -1;
            console.log('AutoScrollWrapper: resume, direction up');
          }, 1000);
        } else if (direction === -1 && next <= 0) {
          next = 0;
          isPaused = true;
          console.log('AutoScrollWrapper: hit top, pausing');
          pauseTimeoutId = window.setTimeout(() => {
            isPaused = false;
            direction = 1;
            console.log('AutoScrollWrapper: resume, direction down');
          }, 1000);
        }

        position = next;
        container.scrollTop = position;
        if (debugFrames < 10) {
          console.log('AutoScrollWrapper: moved', { before, next, maxScroll });
        }
      } else if (maxScroll <= 0 && debugFrames === 1) {
        console.log('AutoScrollWrapper: no scrollable overflow', {
          clientHeight: container.clientHeight,
          scrollHeight: container.scrollHeight,
          speed,
          resetKey,
        });
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (pauseTimeoutId !== null) {
        window.clearTimeout(pauseTimeoutId);
      }
    };
  }, [speed, resetKey]);

  return (
    <div ref={scrollContainerRef} className="h-full overflow-y-auto scrollbar-hide" style={{ scrollBehavior: 'auto' }}>
      {children}
    </div>
  );
};

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SPANISH_DAY_NAMES = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'] as const;

type CalendarCell = {
  date: Date;
  isoKey: string;
  inMonth: boolean;
  isToday: boolean;
  jobs: JobsOverviewJob[];
  hasHighlight: boolean;
  highlightJobIds: Set<string>;
};

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildCalendarFromJobsList(jobs: JobsOverviewJob[]): CalendarFeed {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const offset = (startOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(startOfMonth.getTime() - offset * MS_PER_DAY);
  const gridEnd = new Date(gridStart.getTime() + 42 * MS_PER_DAY - 1);

  const calendarStartISO = gridStart.toISOString();
  const calendarEndISO = gridEnd.toISOString();
  const calendarStartMs = gridStart.getTime();
  const calendarEndMs = gridEnd.getTime();

  const jobsByDate: Record<string, JobsOverviewJob[]> = {};
  const jobDateLookup: Record<string, string> = {};
  const sorted = [...jobs].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  sorted.forEach(job => {
    const startTs = new Date(job.start_time).getTime();
    const endTs = new Date(job.end_time).getTime();
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return;

    const spanStart = Math.max(startTs, calendarStartMs);
    const spanEnd = Math.min(endTs, calendarEndMs);
    if (spanEnd < spanStart) return;

    const primaryKey = formatDateKey(new Date(job.start_time));
    jobDateLookup[job.id] = primaryKey;

    let day = new Date(spanStart);
    day.setHours(0, 0, 0, 0);
    const lastDay = new Date(spanEnd);
    lastDay.setHours(0, 0, 0, 0);

    while (day.getTime() <= lastDay.getTime()) {
      const key = formatDateKey(day);
      const bucket = jobsByDate[key] ?? (jobsByDate[key] = []);
      bucket.push(job);
      day = new Date(day.getTime() + MS_PER_DAY);
    }
  });

  return {
    jobs: sorted,
    jobsByDate,
    jobDateLookup,
    range: { start: calendarStartISO, end: calendarEndISO },
    focusMonth: now.getMonth(),
    focusYear: now.getFullYear(),
  };
}

function buildCalendarModel(data: CalendarFeed | null, highlightIds?: Set<string>, currentMonthOnly: boolean = true): { dayNames: readonly string[]; monthLabel: string; cells: CalendarCell[] } {
  const today = new Date();
  const highlightSet = highlightIds ? new Set(highlightIds) : new Set<string>();

  // Always show current month grid
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const offset = (startOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(startOfMonth.getTime() - offset * MS_PER_DAY);
  const gridEnd = new Date(gridStart.getTime() + (42 - 1) * MS_PER_DAY);

  const dayCount = 42; // Always show 6 weeks
  const todayKey = formatDateKey(today);

  const jobsByKey = data?.jobsByDate ?? {};
  const highlightByKey = new Map<string, Set<string>>();
  if (data) {
    highlightSet.forEach(jobId => {
      const key = data.jobDateLookup[jobId];
      if (!key) return;
      const bucket = highlightByKey.get(key) ?? new Set<string>();
      bucket.add(jobId);
      highlightByKey.set(key, bucket);
    });
  }

  const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  const monthLabel = monthFormatter.format(startOfMonth);

  const focusMonth = today.getMonth();
  const focusYear = today.getFullYear();

  const cells: CalendarCell[] = Array.from({ length: dayCount }, (_, idx) => {
    const date = new Date(gridStart.getTime() + idx * MS_PER_DAY);
    const isoKey = formatDateKey(date);
    const jobs = jobsByKey[isoKey] ?? [];
    const highlightBucket = highlightByKey.get(isoKey) ?? new Set<string>();
    return {
      date,
      isoKey,
      inMonth: date.getMonth() === focusMonth && date.getFullYear() === focusYear,
      isToday: isoKey === todayKey,
      jobs,
      hasHighlight: highlightBucket.size > 0,
      highlightJobIds: new Set<string>(highlightBucket),
    };
  });

  return { dayNames: DAY_LABELS, monthLabel, cells };
}

const MAX_JOBS_PER_DAY_CELL = 3;
const DAY_CELL_ROTATE_MS = 5000;

const CalendarCellJobsList: React.FC<{ jobs: JobsOverviewJob[]; highlightSet: Set<string>; theme: 'light' | 'dark'; cellKey: string; cellDate: Date }> = ({ jobs, highlightSet, theme, cellKey, cellDate }) => {
  const [start, setStart] = useState(0);

  useEffect(() => {
    setStart(0);
    if (jobs.length <= MAX_JOBS_PER_DAY_CELL) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      if (cancelled) return;
      setStart(prev => {
        if (jobs.length <= MAX_JOBS_PER_DAY_CELL) return 0;
        const next = prev + MAX_JOBS_PER_DAY_CELL;
        return next >= jobs.length ? 0 : next;
      });
    }, DAY_CELL_ROTATE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [cellKey, jobs]);

  const end = Math.min(jobs.length, start + MAX_JOBS_PER_DAY_CELL);
  const visible = jobs.slice(start, end);

  return (
    <div className="flex-1 space-y-1 overflow-hidden">
      {visible.map(job => {
        const highlight = highlightSet.has(job.id);
        const time = new Date(job.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateTypeIcon = getDateTypeIcon(
          getDateTypeForJobOnDay(
            { id: job.id, job_type: (job as any).job_type, start_time: job.start_time, end_time: job.end_time },
            cellDate
          )
        );
        return (
          <div
            key={job.id}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs border ${highlight
              ? 'border-amber-400'
              : (theme === 'light' ? 'border-zinc-200' : 'border-zinc-700')
              }`}
            style={{ backgroundColor: getJobCardBackground((job as any).color, theme) }}
          >
            <StatusDot color={job.status} />
            <div className="flex-1 truncate">
              <div className="font-semibold truncate text-sm">{job.title}</div>
              <div className={`text-xs flex gap-2 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                <span className="tabular-nums">{time}</span>
                {job.departments.length > 0 && (
                  <span className="uppercase">{job.departments.join('/')}</span>
                )}
              </div>
            </div>
            {dateTypeIcon && (
              <div className={`w-5 h-5 rounded-md flex items-center justify-center ${theme === 'light' ? 'bg-white/70 text-zinc-700' : 'bg-black/40 text-zinc-100'
                }`}>
                {dateTypeIcon}
              </div>
            )}
          </div>
        );
      })}
      {jobs.length > end && (
        <div className={`text-xs text-center ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>+{jobs.length - end} más</div>
      )}
    </div>
  );
};

const JobsOverviewPanel: React.FC<{ data: JobsOverviewFeed | null; highlightIds?: Set<string>; page?: number; pageSize?: number; theme?: 'light' | 'dark' }> = ({ data, highlightIds, page = 0, pageSize = 6, theme = 'light' }) => {
  const jobs = data?.jobs ?? [];
  const paginatedJobs = jobs.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(jobs.length / pageSize);

  return (
    <AutoScrollWrapper speed={50} resetKey={page}>
      <PanelContainer theme={theme}>
        <div className={`sticky top-0 z-10 pb-4 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-5xl font-semibold">Trabajos – Próximos días</h1>
            {totalPages > 1 && (
              <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Página {page + 1} de {totalPages}</div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedJobs.map(j => {
            const jt = (j as any).jobType || (j as any).job_type || '';
            const jtKey = String(jt).toLowerCase();
            const dateTypeIcon = getDateTypeIcon(
              getDateTypeForJobOnDay(
                { id: j.id, job_type: jtKey, start_time: j.start_time, end_time: j.end_time },
                new Date(j.start_time)
              )
            );
            return (
              <div
                key={j.id}
                className={`rounded-lg p-4 border shadow-sm ${highlightIds?.has(j.id)
                  ? (theme === 'light' ? 'border-amber-500 ring-4 ring-amber-400/40 animate-pulse' : 'border-amber-400 ring-4 ring-amber-400/40 animate-pulse')
                  : (theme === 'light' ? 'border-zinc-200' : 'border-zinc-800')
                  }`}
                style={{ backgroundColor: getJobCardBackground((j as any).color, theme) }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-38 font-medium truncate pr-2">{j.title}</div>
                  <div className="flex items-center gap-2">
                    <StatusDot color={j.status} />
                    {dateTypeIcon && (
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${theme === 'light' ? 'bg-white/80 text-zinc-700' : 'bg-black/40 text-zinc-100'
                        }`}>
                        {dateTypeIcon}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {formatJobTypeLabel(jt) && (
                    <span className={`px-2 py-0.5 rounded-full border ${theme === 'light' ? 'bg-white/70 text-blue-800 border-blue-200' : 'bg-black/40 text-blue-200 border-blue-700/60'}`}>
                      {formatJobTypeLabel(jt)}
                    </span>
                  )}
                  {formatJobDateTypeLabel((j as any).start_time, (j as any).end_time) && (
                    <span className={`px-2 py-0.5 rounded-full border ${theme === 'light' ? 'bg-white/70 text-zinc-800 border-zinc-300' : 'bg-black/40 text-zinc-200 border-zinc-700/60'}`}>
                      {formatJobDateTypeLabel((j as any).start_time, (j as any).end_time)}
                    </span>
                  )}
                </div>
                <div className={`text-30 mt-1 ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-300'}`}>{j.location?.name ?? '—'}</div>
                <div className={`mt-2 text-32 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>{new Date(j.start_time).toLocaleString()} → {new Date(j.end_time).toLocaleTimeString()}</div>
                <div className="mt-3 flex gap-6 text-30">
                  {j.departments.map(d => (
                    <div key={d} className="flex items-center gap-2">
                      <span className="text-38">{d === 'sound' ? '🎧' : d === 'lights' ? '💡' : '📹'}</span>
                      <span className="tabular-nums">{(j.crewAssigned as any)[d] || 0}/{(j.crewNeeded as any)[d] ?? 0}</span>
                    </div>
                  ))}
                </div>
                <div className={`mt-2 text-2xl ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>Docs: {j.departments.map(d => `${d[0].toUpperCase()}${d.slice(1)} ${j.docs[d]?.have ?? 0}/${j.docs[d]?.need ?? 0}`).join(' • ')}</div>
              </div>
            );
          })}
          {jobs.length === 0 && (
            <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>No hay trabajos en los próximos 7 días</div>
          )}
        </div>
      </PanelContainer>
    </AutoScrollWrapper>
  );
};

const CrewAssignmentsPanel: React.FC<{ data: CrewAssignmentsFeed | null; page?: number; pageSize?: number; theme?: 'light' | 'dark' }> = ({ data, page = 0, pageSize = 4, theme = 'light' }) => {
  const jobs = data?.jobs ?? [];
  const paginatedJobs = jobs.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(jobs.length / pageSize);

  return (
    <AutoScrollWrapper speed={50} resetKey={page}>
      <PanelContainer theme={theme}>
        <div className={`sticky top-0 z-10 pb-4 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-5xl font-semibold">Asignaciones de Equipo</h1>
            {totalPages > 1 && (
              <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Página {page + 1} de {totalPages}</div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {paginatedJobs.map(job => (
            <div
              key={job.id}
              className={`rounded-lg p-4 border ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'}`}
              style={{ backgroundColor: getJobCardBackground((job as any).color, theme) }}
            >
              <div className="mb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-38 font-medium">{job.title}</div>
                  {getDateTypeIcon(
                    getDateTypeForJobOnDay(
                      { id: job.id, job_type: (job as any).jobType, start_time: (job as any).start_time || '', end_time: (job as any).end_time || '' },
                      new Date((job as any).start_time || '')
                    )
                  ) && (
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${theme === 'light' ? 'bg-white/80 text-zinc-700' : 'bg-black/40 text-zinc-100'
                        }`}>
                        {getDateTypeIcon(
                          getDateTypeForJobOnDay(
                            { id: job.id, job_type: (job as any).jobType, start_time: (job as any).start_time || '', end_time: (job as any).end_time || '' },
                            new Date((job as any).start_time || '')
                          )
                        )}
                      </div>
                    )}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {formatJobTypeLabel((job as any).jobType || (job as any).job_type) && (
                    <span className={`px-2 py-0.5 rounded-full border ${theme === 'light' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-900/40 text-blue-200 border-blue-700/60'}`}>
                      {formatJobTypeLabel((job as any).jobType || (job as any).job_type)}
                    </span>
                  )}
                  {formatJobDateTypeLabel((job as any).start_time, (job as any).end_time) && (
                    <span className={`px-2 py-0.5 rounded-full border ${theme === 'light' ? 'bg-zinc-50 text-zinc-700 border-zinc-300' : 'bg-zinc-900/40 text-zinc-200 border-zinc-700/60'}`}>
                      {formatJobDateTypeLabel((job as any).start_time, (job as any).end_time)}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {job.crew.map((c, i) => (
                  <div key={i} className={`flex items-center justify-between rounded-md px-3 py-2 ${theme === 'light' ? 'bg-zinc-100' : 'bg-zinc-800/50'}`}>
                    <div className="flex items-center gap-3 truncate">
                      <span className="text-38">{c.dept === 'sound' ? '🎧' : c.dept === 'lights' ? '💡' : c.dept === 'video' ? '📹' : '👤'}</span>
                      <div className="truncate">
                        <div className="text-32 truncate">{c.name || '—'}</div>
                        <div className={`text-xl truncate ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>{c.role}</div>
                      </div>
                    </div>
                    {String(((job as any).jobType || (job as any).job_type || '')).toLowerCase() !== 'tourdate' && (
                      <div className={`px-2 py-1 rounded text-xl ${c.timesheetStatus === 'approved' ? 'bg-green-600' : c.timesheetStatus === 'submitted' ? 'bg-blue-600' : c.timesheetStatus === 'draft' ? 'bg-amber-600' : 'bg-red-600'} text-white`}>
                        {translateTimesheetStatus(c.timesheetStatus)}
                      </div>
                    )}
                  </div>
                ))}
                {job.crew.length === 0 && <div className={`text-30 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Aún no hay equipo asignado</div>}
              </div>
            </div>
          ))}
          {jobs.length === 0 && (
            <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>No hay trabajos para mostrar</div>
          )}
        </div>
      </PanelContainer>
    </AutoScrollWrapper>
  );
};

const DocProgressPanel: React.FC<{ data: DocProgressFeed | null; page?: number; pageSize?: number; theme?: 'light' | 'dark' }> = ({ data, page = 0, pageSize = 4, theme = 'light' }) => {
  const jobs = data?.jobs ?? [];
  const paginatedJobs = jobs.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(jobs.length / pageSize);

  return (
    <AutoScrollWrapper speed={50} resetKey={page}>
      <PanelContainer theme={theme}>
        <div className={`sticky top-0 z-10 pb-4 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-5xl font-semibold">Progreso de Documentos</h1>
            {totalPages > 1 && (
              <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Página {page + 1} de {totalPages}</div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {paginatedJobs.map(job => (
            <div
              key={job.id}
              className={`rounded-lg p-4 border ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'}`}
              style={{ backgroundColor: getJobCardBackground((job as any).color, theme) }}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="text-38 font-medium">{job.title}</div>
                {getDateTypeIcon(
                  getDateTypeForJobOnDay(
                    { id: job.id, job_type: (job as any).jobType, start_time: (job as any).start_time || '', end_time: (job as any).end_time || '' },
                    new Date((job as any).start_time || '')
                  )
                ) && (
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${theme === 'light' ? 'bg-white/80 text-zinc-700' : 'bg-black/40 text-zinc-100'
                      }`}>
                      {getDateTypeIcon(
                        getDateTypeForJobOnDay(
                          { id: job.id, job_type: (job as any).jobType, start_time: (job as any).start_time || '', end_time: (job as any).end_time || '' },
                          new Date((job as any).start_time || '')
                        )
                      )}
                    </div>
                  )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {job.departments.map(dep => {
                  const pct = dep.need > 0 ? Math.round((dep.have / dep.need) * 100) : 0;
                  return (
                    <div key={dep.dept} className={`rounded-md p-3 ${theme === 'light' ? 'bg-zinc-100' : 'bg-zinc-800/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-32 flex items-center gap-2">
                          <span className="text-38">{dep.dept === 'sound' ? '🎧' : dep.dept === 'lights' ? '💡' : '📹'}</span>
                          <span className="capitalize">{dep.dept}</span>
                        </div>
                        <div className={`text-2xl ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-300'}`}>{dep.have}/{dep.need}</div>
                      </div>
                      <div className={`h-3 rounded ${theme === 'light' ? 'bg-zinc-300' : 'bg-zinc-700'}`}>
                        <div className="h-3 bg-blue-500 rounded" style={{ width: `${pct}%` }} />
                      </div>
                      {dep.missing.length > 0 && (
                        <div className={`text-xl mt-2 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Faltante: {dep.missing.join(', ')}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {jobs.length === 0 && (
            <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Nada pendiente</div>
          )}
        </div>
      </PanelContainer>
    </AutoScrollWrapper>
  );
};

const PendingActionsPanel: React.FC<{ data: PendingActionsFeed | null; theme?: 'light' | 'dark' }> = ({ data, theme = 'light' }) => {
  const resetKey = (data?.items ?? []).map((it) => `${it.severity}:${it.text}`).join('|');
  return (
    <AutoScrollWrapper speed={50} resetKey={resetKey}>
      <PanelContainer theme={theme}>
        <div className={`sticky top-0 z-10 pb-4 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
          <h1 className="text-5xl font-semibold">Acciones Pendientes</h1>
        </div>
        <div className="flex flex-col gap-3 text-38">
          {(data?.items ?? []).map((it, i) => (
            <div
              key={i}
              className={`rounded-md px-4 py-3 border ${it.severity === 'red'
                ? (theme === 'light' ? 'border-red-500/60' : 'border-red-500/60')
                : (theme === 'light' ? 'border-amber-500/60' : 'border-amber-500/60')
                }`}
              style={{ backgroundColor: it.severity === 'red' ? getJobCardBackground('#ef4444', theme) : getJobCardBackground('#f59e0b', theme) }}
            >
              {it.text}
            </div>
          ))}
          {(data?.items.length ?? 0) === 0 && <div className={theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}>Todo bien ✅</div>}
        </div>
      </PanelContainer>
    </AutoScrollWrapper>
  )
};

const CalendarPanel: React.FC<{ data: CalendarFeed | null; highlightIds?: Set<string>; theme?: 'light' | 'dark'; scrollSpeed?: number }> = ({ data, highlightIds, theme = 'light', scrollSpeed = 50 }) => {
  const { dayNames, monthLabel, cells } = buildCalendarModel(data, highlightIds, true);
  const resetKey = data ? `${data.range.start}-${data.range.end}-${data.jobs.length}` : 'no-data';

  return (
    <AutoScrollWrapper speed={scrollSpeed} resetKey={resetKey}>
      <PanelContainer theme={theme}>
        <div className={`sticky top-0 z-10 pb-2 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
          <div className="flex items-end justify-between gap-6">
            <div>
              <h1 className="text-5xl font-semibold leading-tight">Calendario de Trabajos</h1>
              <div className={`text-38 uppercase tracking-[0.35em] mt-2 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>{monthLabel}</div>
            </div>
            <div className={`text-right text-2xl max-w-[28rem] leading-snug ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Vista del mes actual con visualización compacta de trabajos
            </div>
          </div>
          <div className={`grid grid-cols-7 gap-2 uppercase tracking-[0.35em] text-xl font-semibold pt-2 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {dayNames.map(name => (
              <div key={name} className="text-center">{name}</div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2" style={{ gridAutoRows: 'minmax(12rem, auto)' }}>
          {cells.map((cell, idx) => {
            const jobs = cell.jobs;
            const highlightSet = cell.highlightJobIds;
            const classes = [
              'rounded-lg border p-3 flex flex-col gap-2 shadow-inner transition-all duration-300',
              theme === 'light'
                ? (cell.inMonth ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-50 border-zinc-100 text-zinc-400')
                : (cell.inMonth ? 'bg-zinc-950/90 border-zinc-800 text-white' : 'bg-zinc-900/40 border-zinc-800/40 text-zinc-500'),
              cell.isToday ? 'border-blue-400/80 ring-2 ring-blue-400/30 shadow-[0_0_45px_rgba(96,165,250,0.35)]' : '',
              cell.hasHighlight ? 'border-amber-400/80 ring-4 ring-amber-400/30 shadow-[0_0_55px_rgba(251,191,36,0.35)]' : '',
            ].filter(Boolean).join(' ');
            return (
              <div key={cell.isoKey + idx} className={classes}>
                <div className="flex items-start justify-between">
                  <div className={`text-38 font-bold leading-none ${cell.inMonth ? '' : (theme === 'light' ? 'text-zinc-300' : 'text-zinc-600')}`}>{cell.date.getDate()}</div>
                  {jobs.length > 0 && (
                    <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 text-lg font-semibold tabular-nums">
                      {jobs.length}
                    </div>
                  )}
                </div>
                <CalendarCellJobsList jobs={jobs} highlightSet={highlightSet} theme={theme} cellKey={cell.isoKey} cellDate={cell.date} />
              </div>
            );
          })}
        </div>
      </PanelContainer>
    </AutoScrollWrapper>
  );
};

type TickerMessage = { message: string; level: AnnouncementLevel };

const Ticker: React.FC<{ messages: TickerMessage[]; bottomOffset?: number; theme?: 'light' | 'dark'; onMeasureHeight?: (h: number) => void }> = ({ messages, bottomOffset = 0, theme = 'light', onMeasureHeight }) => {
  const [posX, setPosX] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const gap = 64; // px spacing between repeats
  const contentKey = (messages || []).map(m => `${m.level}:${m.message}`).join('|');

  const hasMessages = messages.length > 0;

  const renderCopy = (options?: { ref?: (node: HTMLSpanElement | null) => void; paddingLeft?: number }) => (
    <span
      ref={options?.ref}
      className="inline-flex items-center text-30"
      style={options?.paddingLeft ? { paddingLeft: options.paddingLeft } : undefined}
    >
      {messages.map((msg, idx) => (
        <React.Fragment key={`${idx}-${msg.message}`}>
          <span className={`px-2 whitespace-nowrap ${ANNOUNCEMENT_LEVEL_STYLES[msg.level].text}`}>
            {msg.message}
          </span>
          {idx < messages.length - 1 && (
            <span className={`px-6 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>•</span>
          )}
        </React.Fragment>
      ))}
    </span>
  );

  // Start from the right edge whenever content changes
  useEffect(() => {
    const cw = containerRef.current?.offsetWidth || 0;
    setPosX(cw);
  }, [contentKey]);

  // Also reset to right edge on initial mount to avoid mid-screen starts
  useEffect(() => {
    const cw = containerRef.current?.offsetWidth || 0;
    setPosX(cw);
  }, []);

  // Smooth, endless loop: track translateX decreases; wrap by one copy width
  useEffect(() => {
    if (!hasMessages) return;
    let raf = 0;
    let last = performance.now();
    const speed = 50; // px/sec
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPosX(prev => {
        const w = (textRef.current?.offsetWidth || 0) + gap; // width of one copy
        if (w <= 0) return prev;
        let next = prev - speed * dt;
        // If we've fully scrolled one copy past the left, wrap forward by that width
        while (next <= -w) next += w;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [contentKey, hasMessages]);

  // Report ticker height so the main content area can avoid being covered
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onMeasureHeight) return;
    const report = () => onMeasureHeight(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener('resize', report);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', report);
    };
  }, [onMeasureHeight]);

  return (
    <div ref={containerRef} className={`fixed bottom-0 left-0 right-0 border-t py-2 text-xl overflow-hidden ${theme === 'light' ? 'bg-zinc-100/95 border-zinc-200' : 'bg-zinc-900/95 border-zinc-800'}`} style={{ bottom: bottomOffset }}>
      {hasMessages ? (
        <div className="whitespace-nowrap will-change-transform" style={{ transform: `translateX(${posX}px)` }}>
          {renderCopy({ ref: node => { textRef.current = node; } })}
          {renderCopy({ paddingLeft: gap })}
        </div>
      ) : (
        <div>—</div>
      )}
    </div>
  );
};

const FooterLogo: React.FC<{ onToggle?: () => void; onMeasure?: (h: number) => void; theme?: 'light' | 'dark' }> = ({ onToggle, onMeasure, theme = 'light' }) => {
  // Use Supabase public bucket: "public logos"/sectorlogow.png, with local fallbacks
  const { data } = supabase.storage.from('public logos').getPublicUrl('sectorpro.png');
  const primary = data?.publicUrl;
  const fallbacks = [
    '/sector pro logo.png',
    '/icon.png',
  ];
  const [idx, setIdx] = useState(0);
  const sources = primary ? [primary, ...fallbacks] : fallbacks;
  const src = sources[Math.min(idx, sources.length - 1)];
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const report = () => onMeasure && onMeasure(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener('resize', report);
    return () => { ro.disconnect(); window.removeEventListener('resize', report); };
  }, [onMeasure]);
  return (
    <div ref={containerRef} className={`fixed bottom-0 left-0 right-0 py-3 border-t flex items-center justify-center z-50 ${theme === 'light' ? 'bg-white/70 border-zinc-200' : 'bg-black/70 border-zinc-800'}`}>
      <img
        src={src}
        alt="Logo de la Empresa"
        className="h-12 w-auto opacity-90 cursor-pointer select-none"
        onError={() => setIdx(i => i + 1)}
        onClick={() => onToggle && onToggle()}
      />
    </div>
  );
};

type PanelKey = 'overview' | 'crew' | 'logistics' | 'pending' | 'calendar';

const PANEL_KEYS: PanelKey[] = ['overview', 'crew', 'logistics', 'pending', 'calendar'];
const DEFAULT_PANEL_ORDER: PanelKey[] = [...PANEL_KEYS];
const DEFAULT_PANEL_DURATIONS: Record<PanelKey, number> = {
  overview: 12,
  crew: 12,
  logistics: 12,
  pending: 12,
  calendar: 12,
};
const DEFAULT_ROTATION_FALLBACK_SECONDS = 12;
const DEFAULT_HIGHLIGHT_TTL_SECONDS = 300;
const DEFAULT_TICKER_SECONDS = 20;

function normalisePanelOrder(order?: string[] | null): PanelKey[] {
  if (!Array.isArray(order)) return [...DEFAULT_PANEL_ORDER];
  const seen = new Set<PanelKey>();
  const filtered: PanelKey[] = [];
  for (const value of order) {
    const key = (typeof value === 'string' ? value.toLowerCase() : '') as PanelKey;
    if ((PANEL_KEYS as readonly string[]).includes(key) && !seen.has(key)) {
      filtered.push(key);
      seen.add(key);
    }
  }
  if (!filtered.length) return [...DEFAULT_PANEL_ORDER];
  PANEL_KEYS.forEach(key => {
    if (!seen.has(key)) {
      filtered.push(key);
      seen.add(key);
    }
  });
  return filtered;
}

function coerceSeconds(value: unknown, fallback: number, min = 1, max = 600): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.min(Math.max(num, min), max);
  return Math.round(clamped);
}

// Main wallboard component - can be used with or without auth
function WallboardDisplay({
  presetSlug: propPresetSlug,
  skipSplash = false,
  wallboardApiToken,
  onFatalError,
}: {
  presetSlug?: string;
  skipSplash?: boolean;
  wallboardApiToken?: string;
  onFatalError?: (message?: string) => void;
} = {}) {
  const { presetSlug: urlPresetSlug } = useParams<{ presetSlug?: string }>();
  const presetSlug = propPresetSlug !== undefined ? propPresetSlug : urlPresetSlug;
  const effectiveSlug = (presetSlug?.trim() || 'default').toLowerCase();
  const isProduccionPreset = effectiveSlug === 'produccion';
  const isApiMode = Boolean(wallboardApiToken);

  useLgScreensaverBlock();

  const [isLoading, setIsLoading] = useState(!skipSplash); // Skip loading splash if already shown
  const [isAlien, setIsAlien] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); // Default to light mode
  const [panelOrder, setPanelOrder] = useState<PanelKey[]>([...DEFAULT_PANEL_ORDER]);
  const [panelDurations, setPanelDurations] = useState<Record<PanelKey, number>>({ ...DEFAULT_PANEL_DURATIONS });
  const [rotationFallbackSeconds, setRotationFallbackSeconds] = useState<number>(DEFAULT_ROTATION_FALLBACK_SECONDS);
  const [highlightTtlMs, setHighlightTtlMs] = useState<number>(DEFAULT_HIGHLIGHT_TTL_SECONDS * 1000);
  const [tickerIntervalMs, setTickerIntervalMs] = useState<number>(DEFAULT_TICKER_SECONDS * 1000);
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  // Data polling state - declared here to avoid temporal dead zone in useEffect below
  const [overview, setOverview] = useState<JobsOverviewFeed | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarFeed | null>(null);
  const [crew, setCrew] = useState<CrewAssignmentsFeed | null>(null);
  const [docs, setDocs] = useState<DocProgressFeed | null>(null);
  const [pending, setPending] = useState<PendingActionsFeed | null>(null);
  const [logistics, setLogistics] = useState<LogisticsItem[] | null>(null);
  const [tickerMsgs, setTickerMsgs] = useState<TickerMessage[]>([]);
  const [highlightJobs, setHighlightJobs] = useState<Map<string, number>>(new Map());
  const [footerH, setFooterH] = useState<number>(72);
  const [tickerH, setTickerH] = useState<number>(32);
  const [panelPages, setPanelPages] = useState<Record<PanelKey, number>>({
    overview: 0,
    crew: 0,
    logistics: 0,
    pending: 0,
    calendar: 0,
  });

  const processAnnouncements = useCallback((rows: Array<{ id?: string; message?: string | null; level?: string | null; created_at?: string | null }>) => {
    const regex = /^\s*\[HIGHLIGHT_JOB:([a-f0-9\-]+)\]\s*/i;
    const now = Date.now();
    const ttl = Math.max(1000, highlightTtlMs);
    const staleIds: string[] = [];
    const messages: TickerMessage[] = [];

    setHighlightJobs(prev => {
      const updated = new Map(prev);
      (rows || []).forEach((a) => {
        let m = a?.message || '';
        const levelRaw = (a?.level ?? 'info') as AnnouncementLevel;
        const level: AnnouncementLevel = ['info', 'warn', 'critical'].includes(levelRaw) ? levelRaw : 'info';
        const match = m.match(regex);
        if (match) {
          const jobId = match[1];
          const created = a?.created_at ? new Date(a.created_at).getTime() : now;
          const expireAt = created + ttl;
          if (expireAt > now) {
            updated.set(jobId, expireAt);
          } else if (a?.id) {
            staleIds.push(a.id);
          }
          m = m.replace(regex, '');
        }
        if (m.trim()) messages.push({ message: m.trim(), level });
      });
      for (const [jid, exp] of updated) {
        if (exp < now) {
          updated.delete(jid);
        }
      }
      return updated;
    });

    setTickerMsgs(messages);
    return staleIds;
  }, [highlightTtlMs]);

  useEffect(() => {
    setIdx(0);
  }, [panelOrder]);

  useEffect(() => {
    if (!panelOrder.length) return;
    const activePanels = panelOrder;
    const currentPanel = activePanels[idx % activePanels.length];
    const seconds = panelDurations[currentPanel] ?? rotationFallbackSeconds;
    const durationMs = Math.max(1, seconds) * 1000;
    const timer = window.setTimeout(() => {
      // Check if current panel has multiple pages
      const getCurrentPageCount = () => {
        if (currentPanel === 'overview') return Math.ceil((overview?.jobs.length ?? 0) / 6);
        if (currentPanel === 'crew') return Math.ceil((crew?.jobs.length ?? 0) / 4);
        if (currentPanel === 'logistics') return Math.ceil((logistics?.length ?? 0) / 6);
        return 1;
      };

      const pageCount = getCurrentPageCount();

      // If there is only a single panel and a single page (e.g. producción stub with just the calendar),
      // don't schedule any rotation to avoid unnecessary re-renders.
      if (activePanels.length === 1 && pageCount <= 1) {
        return;
      }
      const currentPage = panelPages[currentPanel] ?? 0;

      // If there are more pages, go to next page
      if (currentPage + 1 < pageCount) {
        setPanelPages(prev => ({ ...prev, [currentPanel]: currentPage + 1 }));
      } else {
        // Reset page and move to next panel
        setPanelPages(prev => ({ ...prev, [currentPanel]: 0 }));
        setIdx(current => {
          const total = activePanels.length;
          if (total <= 0) return 0;
          return (current + 1) % total;
        });
      }
    }, durationMs);
    return () => clearTimeout(timer);
  }, [idx, panelOrder, panelDurations, rotationFallbackSeconds, panelPages, overview, crew, logistics]);

  useEffect(() => {
    let cancelled = false;
    setPresetMessage(null);

    const loadPreset = async () => {
      let data: any = null;
      let error: any = null;

      console.log('🎨 [Wallboard] Loading preset configuration...', {
        effectiveSlug,
        isApiMode,
        isProduccionPreset,
        hasApiToken: !!wallboardApiToken
      });

      // HARDCODED: Presets for API mode (public wallboards)
      if (isApiMode) {
        if (effectiveSlug === 'produccion') {
          console.log('🎯 [Wallboard] Using hardcoded produccion config (calendar-only)');
          setPanelOrder(['calendar']);
          setPanelDurations({
            overview: 12,
            crew: 12,
            logistics: 12,
            pending: 12,
            calendar: 600,
          });
          setRotationFallbackSeconds(600);
          setHighlightTtlMs(300 * 1000);
          setTickerIntervalMs(20 * 1000);
          setPresetMessage(null);
          setHighlightJobs(new Map());
          setIdx(0);
          return;
        } else if (effectiveSlug === 'almacen') {
          console.log('🎯 [Wallboard] Using hardcoded almacen config');
          setPanelOrder(['logistics', 'overview', 'calendar']);
          setPanelDurations({
            overview: 15,
            crew: 12,
            logistics: 15,
            pending: 12,
            calendar: 30,
          });
          setRotationFallbackSeconds(15);
          setHighlightTtlMs(300 * 1000);
          setTickerIntervalMs(20 * 1000);
          setPresetMessage(null);
          setHighlightJobs(new Map());
          setIdx(0);
          return;
        } else if (effectiveSlug === 'oficinas') {
          console.log('🎯 [Wallboard] Using hardcoded oficinas config');
          setPanelOrder(['overview', 'crew', 'logistics', 'pending', 'calendar']);
          setPanelDurations({
            overview: 15,
            crew: 15,
            logistics: 15,
            pending: 10,
            calendar: 30,
          });
          setRotationFallbackSeconds(15);
          setHighlightTtlMs(300 * 1000);
          setTickerIntervalMs(20 * 1000);
          setPresetMessage(null);
          setHighlightJobs(new Map());
          setIdx(0);
          return;
        }
      }

      // For API mode (public wallboards), fetch config via API
      if (isApiMode) {
        try {
          console.log('🌐 [Wallboard] Fetching preset via API...', { effectiveSlug });
          const api = new WallboardApi(wallboardApiToken);
          const response = await api.presetConfig();
          data = response.config;
          console.log('✅ [Wallboard] Preset fetched via API:', {
            slug: response.slug,
            panelOrder: data?.panel_order,
            panelDurations: data?.panel_durations
          });
        } catch (err) {
          console.error('❌ [Wallboard] Failed to load preset config via API:', err);
          // Fall through to use defaults
          error = err;
        }
      } else {
        // For authenticated wallboards, fetch directly from database
        console.log('💾 [Wallboard] Fetching preset from database...', { effectiveSlug });
        const result = await supabase
          .from('wallboard_presets')
          .select('panel_order, panel_durations, rotation_fallback_seconds, highlight_ttl_seconds, ticker_poll_interval_seconds')
          .eq('slug', effectiveSlug)
          .maybeSingle();
        data = result.data;
        error = result.error;
        console.log('💾 [Wallboard] Database query result:', {
          hasData: !!data,
          hasError: !!error,
          panelOrder: data?.panel_order
        });
      }

      if (cancelled) return;

      if (error) {
        console.error('❌ [Wallboard] Preset load error:', error);
      }

      if (error || !data) {
        if (isProduccionPreset) {
          // Stub for /produccion: calendar-only layout with slower rotation
          setPanelOrder(['calendar']);
          setPanelDurations({
            overview: DEFAULT_PANEL_DURATIONS.overview,
            crew: DEFAULT_PANEL_DURATIONS.crew,
            logistics: DEFAULT_PANEL_DURATIONS.logistics,
            pending: DEFAULT_PANEL_DURATIONS.pending,
            calendar: 30,
          });
          setRotationFallbackSeconds(30);
          setHighlightTtlMs(DEFAULT_HIGHLIGHT_TTL_SECONDS * 1000);
          setTickerIntervalMs(DEFAULT_TICKER_SECONDS * 1000);
          setPresetMessage('Wallboard de producción: solo calendario (configurable en Presets).');
          setHighlightJobs(new Map());
          setIdx(0);
        } else {
          setPanelOrder([...DEFAULT_PANEL_ORDER]);
          setPanelDurations({ ...DEFAULT_PANEL_DURATIONS });
          setRotationFallbackSeconds(DEFAULT_ROTATION_FALLBACK_SECONDS);
          setHighlightTtlMs(DEFAULT_HIGHLIGHT_TTL_SECONDS * 1000);
          setTickerIntervalMs(DEFAULT_TICKER_SECONDS * 1000);
          setPresetMessage(`Using default wallboard preset${effectiveSlug !== 'default' ? ` (missing "${effectiveSlug}")` : ''}.`);
          setHighlightJobs(new Map());
          setIdx(0);
        }
        return;
      }

      const fallbackSeconds = coerceSeconds(data.rotation_fallback_seconds, DEFAULT_ROTATION_FALLBACK_SECONDS);
      const highlightSeconds = coerceSeconds(data.highlight_ttl_seconds, DEFAULT_HIGHLIGHT_TTL_SECONDS, 30, 3600);
      const tickerSeconds = coerceSeconds(data.ticker_poll_interval_seconds, DEFAULT_TICKER_SECONDS, 10, 600);
      const order = normalisePanelOrder(data.panel_order as string[] | null);
      const rawDurations = (data.panel_durations ?? {}) as Record<string, unknown>;
      const durations: Record<PanelKey, number> = { ...DEFAULT_PANEL_DURATIONS };
      PANEL_KEYS.forEach(key => {
        durations[key] = coerceSeconds(rawDurations[key], fallbackSeconds);
      });

      console.log('✅ [Wallboard] Applying preset configuration:', {
        effectiveSlug,
        panelOrder: order,
        panelDurations: durations,
        rotationFallback: fallbackSeconds
      });

      setPanelOrder(order);
      setPanelDurations(durations);
      setRotationFallbackSeconds(fallbackSeconds);
      setHighlightTtlMs(highlightSeconds * 1000);
      setTickerIntervalMs(tickerSeconds * 1000);
      setPresetMessage(null);
      setHighlightJobs(new Map());
      setIdx(0);
    };

    loadPreset();
    return () => {
      cancelled = true;
    };
  }, [effectiveSlug, isApiMode, wallboardApiToken]);

  // Data polling (client-side via RLS-safe views)
  // Note: State declarations moved earlier to avoid temporal dead zone issues

  useEffect(() => {
    if (isApiMode) {
      return;
    }
    let cancelled = false;
    let isFirstLoad = true;
    const fetchAll = async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekEnd = new Date(todayStart.getTime() + 7 * MS_PER_DAY - 1);
      const startOfMonth = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
      const monthOffset = (startOfMonth.getDay() + 6) % 7;
      const calendarGridStart = new Date(startOfMonth.getTime() - monthOffset * MS_PER_DAY);
      const calendarGridEnd = new Date(calendarGridStart.getTime() + 42 * MS_PER_DAY - 1);
      const weekStartISO = todayStart.toISOString();
      const weekEndISO = weekEnd.toISOString();
      const calendarStartISO = calendarGridStart.toISOString();
      const calendarEndISO = calendarGridEnd.toISOString();
      const weekStartMs = todayStart.getTime();
      const weekEndMs = weekEnd.getTime();
      const calendarStartMs = calendarGridStart.getTime();
      const calendarEndMs = calendarGridEnd.getTime();

      const jobOverlapsWeek = (j: any) => {
        const startTime = new Date(j.start_time).getTime();
        const endTime = new Date(j.end_time).getTime();
        return endTime >= weekStartMs && startTime <= weekEndMs;
      };
      const jobWithinCalendarWindow = (j: any) => {
        const startTime = new Date(j.start_time).getTime();
        const endTime = new Date(j.end_time).getTime();
        return endTime >= calendarStartMs && startTime <= calendarEndMs;
      };

      // 1) Fetch jobs (base fields only)
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id,title,start_time,end_time,status,location_id,job_type,tour_id,timezone,color')
        .in('job_type', ['single', 'festival', 'tourdate', 'dryhire'])
        .in('status', ['Confirmado', 'Tentativa', 'Completado'])
        .lte('start_time', calendarEndISO)
        .gte('end_time', calendarStartISO)
        .order('start_time', { ascending: true });
      if (jobsError) console.error('Wallboard jobs query error:', jobsError?.message || jobsError, { calendarStartISO, calendarEndISO });
      let jobArr = jobs || [];

      // Exclude jobs whose parent tour is cancelled (some entries may still be Confirmado)
      const tourIds = Array.from(new Set(jobArr.map((j: any) => j.tour_id).filter(Boolean)));
      if (tourIds.length) {
        const { data: toursMeta, error: toursErr } = await supabase
          .from('tours')
          .select('id,status')
          .in('id', tourIds);
        if (toursErr) {
          console.warn('Wallboard tours meta error:', toursErr);
        } else if (toursMeta && toursMeta.length) {
          const cancelledTours = new Set((toursMeta as any[]).filter(t => t.status === 'cancelled').map(t => t.id));
          if (cancelledTours.size) {
            jobArr = jobArr.filter((j: any) => !j.tour_id || !cancelledTours.has(j.tour_id));
          }
        }
      }
      const jobIds = jobArr.map(j => j.id);
      const detailJobSet = new Set(jobArr.filter(jobOverlapsWeek).map((j: any) => j.id));
      const detailJobIds = Array.from(detailJobSet);
      const dryhireIds = new Set<string>(jobArr.filter((j: any) => j.job_type === 'dryhire').map((j: any) => j.id));
      const locationIds = Array.from(new Set(jobArr.map((j: any) => j.location_id).filter(Boolean)));

      // 2) Fetch departments for these jobs
      const { data: deptRows, error: deptErr } = jobIds.length
        ? await supabase.from('job_departments').select('job_id,department').in('job_id', jobIds)
        : { data: [], error: null } as any;
      if (deptErr) console.error('Wallboard job_departments error:', deptErr);
      const deptsByJob = new Map<string, Dept[]>();
      (deptRows || []).forEach((r: any) => {
        const list = deptsByJob.get(r.job_id) ?? [];
        list.push(r.department);
        deptsByJob.set(r.job_id, list as Dept[]);
      });

      // 3) Fetch assignments for crew counts (restrict to detail window)
      const { data: assignRows, error: assignErr } = detailJobIds.length
        ? await supabase.from('job_assignments').select('job_id,technician_id,sound_role,lights_role,video_role').in('job_id', detailJobIds)
        : { data: [], error: null } as any;
      if (assignErr) console.error('Wallboard job_assignments error:', assignErr);
      const assignsByJob = new Map<string, any[]>();
      (assignRows || []).forEach((a: any) => {
        const list = assignsByJob.get(a.job_id) ?? [];
        list.push(a);
        assignsByJob.set(a.job_id, list);
      });

      // Fetch required-role summaries for these jobs
      const { data: reqRows, error: reqErr } = detailJobIds.length
        ? await supabase
          .from('job_required_roles_summary')
          .select('job_id, department, total_required')
          .in('job_id', detailJobIds)
        : { data: [], error: null } as any;
      if (reqErr) console.error('Wallboard job_required_roles_summary error:', reqErr);
      const needByJobDept = new Map<string, number>();
      (reqRows || []).forEach((r: any) => {
        needByJobDept.set(`${r.job_id}:${r.department}`, Number(r.total_required || 0));
      });

      // 4) Fetch locations for names
      const { data: locRows, error: locErr } = locationIds.length
        ? await supabase.from('locations').select('id,name').in('id', locationIds)
        : { data: [], error: null } as any;
      if (locErr) console.error('Wallboard locations error:', locErr);
      const locById = new Map<string, string>();
      (locRows || []).forEach((l: any) => locById.set(l.id, l.name));

      // Timesheet statuses via view
      const tsByJobTech = new Map<string, Map<string, string>>();
      if (detailJobIds.length) {
        const { data: ts } = await supabase
          .from('wallboard_timesheet_status')
          .select('job_id, technician_id, status')
          .in('job_id', detailJobIds);
        ts?.forEach(row => {
          const m = tsByJobTech.get(row.job_id) ?? new Map();
          m.set(row.technician_id, row.status as string);
          tsByJobTech.set(row.job_id, m);
        });
      }

      // Doc counts and requirements
      const [{ data: counts }, { data: reqs }] = await Promise.all([
        detailJobIds.length ? supabase.from('wallboard_doc_counts').select('job_id,department,have').in('job_id', detailJobIds) : Promise.resolve({ data: [] as any }),
        supabase.from('wallboard_doc_requirements').select('department,need')
      ]);

      const needByDept = new Map<string, number>((reqs || []).map(r => [r.department, r.need]));
      const haveByJobDept = new Map<string, number>();
      (counts || []).forEach((c: any) => haveByJobDept.set(`${c.job_id}:${c.department}`, c.have));

      const mapJob = (j: any): JobsOverviewJob => {
        const deptsAll: Dept[] = (deptsByJob.get(j.id) ?? []) as Dept[];
        const depts: Dept[] = deptsAll.filter(d => d !== 'video');
        const crewAssigned: Record<string, number> = { sound: 0, lights: 0, video: 0 };
        const assignmentRows = detailJobSet.has(j.id) ? (assignsByJob.get(j.id) ?? []) : [];
        assignmentRows.forEach((a: any) => {
          if (a.sound_role) crewAssigned.sound++;
          if (a.lights_role) crewAssigned.lights++;
          if (a.video_role) crewAssigned.video++;
        });
        const crewNeeded: Record<string, number> = { sound: 0, lights: 0, video: 0 };
        depts.forEach(d => {
          crewNeeded[d] = detailJobSet.has(j.id) ? (needByJobDept.get(`${j.id}:${d}`) || 0) : 0;
        });
        let status: 'green' | 'yellow' | 'red';
        if (detailJobSet.has(j.id)) {
          const hasReq = depts.some(d => (crewNeeded[d] || 0) > 0);
          if (hasReq) {
            const perDept = depts.map(d => {
              const need = crewNeeded[d] || 0;
              const have = crewAssigned[d] || 0;
              if (need <= 0) return 1;
              if (have >= need) return 1;
              if (have > 0) return 0.5;
              return 0;
            });
            const minCov = Math.min(...perDept);
            status = minCov >= 1 ? 'green' : (minCov > 0 ? 'yellow' : 'red');
          } else {
            const present = depts.map(d => crewAssigned[d]);
            const hasAny = present.some(n => n > 0);
            const allHave = depts.length > 0 && present.every(n => n > 0);
            status = allHave ? 'green' : hasAny ? 'yellow' : 'red';
          }
        } else {
          status = j.status === 'Confirmado' ? 'green' : 'yellow';
        }
        const docs: Record<string, { have: number; need: number }> = {};
        depts.forEach(d => {
          const have = detailJobSet.has(j.id) ? (haveByJobDept.get(`${j.id}:${d}`) ?? 0) : 0;
          const need = needByDept.get(d) ?? 0;
          docs[d] = { have, need };
        });
        return {
          id: j.id,
          title: j.title,
          start_time: j.start_time,
          end_time: j.end_time,
          location: { name: (j.location_id ? (locById.get(j.location_id) ?? null) : null) },
          departments: depts,
          crewAssigned: { ...crewAssigned, total: (crewAssigned.sound + crewAssigned.lights + crewAssigned.video) },
          crewNeeded: { ...crewNeeded, total: (crewNeeded.sound + crewNeeded.lights + crewNeeded.video) },
          docs,
          status,
          color: j.color ?? null,
          job_type: j.job_type ?? null,
        };
      };

      const calendarJobs: JobsOverviewJob[] = jobArr
        .filter((j: any) => !dryhireIds.has(j.id))
        .filter(jobWithinCalendarWindow)
        .map(mapJob)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const jobsForWeek: JobsOverviewJob[] = jobArr
        .filter((j: any) => !dryhireIds.has(j.id))
        .filter(jobOverlapsWeek)
        .map(mapJob)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const jobsByDate: Record<string, JobsOverviewJob[]> = {};
      const jobDateLookup: Record<string, string> = {};
      calendarJobs.forEach(job => {
        const startTs = new Date(job.start_time).getTime();
        const endTs = new Date(job.end_time).getTime();
        if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return;

        // Primary date for lookups/highlights – keep as start date
        const primaryKey = formatDateKey(new Date(job.start_time));
        jobDateLookup[job.id] = primaryKey;

        // Add the job to every calendar day it spans within the visible window
        const spanStart = Math.max(startTs, calendarStartMs);
        const spanEnd = Math.min(endTs, calendarEndMs);
        if (spanEnd < spanStart) return;

        let day = new Date(spanStart);
        day.setHours(0, 0, 0, 0);
        const lastDay = new Date(spanEnd);
        lastDay.setHours(0, 0, 0, 0);

        while (day.getTime() <= lastDay.getTime()) {
          const key = formatDateKey(day);
          const bucket = jobsByDate[key] ?? (jobsByDate[key] = []);
          bucket.push(job);
          day = new Date(day.getTime() + MS_PER_DAY);
        }
      });

      const overviewPayload: JobsOverviewFeed = {
        jobs: jobsForWeek,
      };

      // Crew assignments
      const assignedTechsByJob = new Map<string, string[]>();
      const crewPayload: CrewAssignmentsFeed = {
        jobs: jobArr
          .filter((j: any) => !dryhireIds.has(j.id))
          .filter(jobOverlapsWeek)
          .map((j: any) => {
            const crew = (assignsByJob.get(j.id) ?? [])
              // Hide video crew
              .filter((a: any) => a.video_role == null)
              .map((a: any) => {
                const dept: Dept | null = a.sound_role ? 'sound' : a.lights_role ? 'lights' : null;
                const role = a.sound_role || a.lights_role || 'assigned';
                const list = assignedTechsByJob.get(j.id) ?? [];
                list.push(a.technician_id);
                assignedTechsByJob.set(j.id, list);
                return { name: '', role, dept, timesheetStatus: 'missing' as TimesheetStatus, technician_id: a.technician_id } as any;
              });
            return { id: j.id, title: j.title, jobType: j.job_type, start_time: j.start_time, end_time: j.end_time, color: j.color ?? null, crew };
          })
      } as any;

      // Fill names in one request
      const techIds = Array.from(new Set(crewPayload.jobs.flatMap(j => j.crew.map((c: any) => c.technician_id))));
      if (techIds.length) {
        const { data: profs } = await supabase
          .from('wallboard_profiles')
          .select('id,first_name,last_name,department')
          .in('id', techIds);
        const byId = new Map<string, any>((profs || []).map(p => [p.id, p]));
        crewPayload.jobs.forEach(j => {
          j.crew.forEach((c: any) => {
            const p = byId.get(c.technician_id);
            c.name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '';
            const s = tsByJobTech.get(j.id)?.get(c.technician_id) as any;
            const inPast = new Date(jobArr.find(x => x.id === j.id)?.end_time || Date.now()) < new Date();
            const normalizedStatus = s === 'rejected' ? 'rejected' : s;
            c.timesheetStatus = inPast && normalizedStatus === 'approved' ? 'approved' : (normalizedStatus || 'missing');
            delete c.technician_id;
          });
        });
      }

      // Doc progress
      const docPayload: DocProgressFeed = {
        jobs: jobArr
          .filter((j: any) => !dryhireIds.has(j.id))
          .filter(jobOverlapsWeek)
          .map((j: any) => {
            const deptsAll: Dept[] = (deptsByJob.get(j.id) ?? []) as Dept[];
            return {
              id: j.id,
              title: j.title,
              color: j.color ?? null,
              departments: deptsAll.map((d: Dept) => ({
                dept: d,
                have: haveByJobDept.get(`${j.id}:${d}`) ?? 0,
                need: needByDept.get(d) ?? 0,
                missing: []
              }))
            };
          })
      };

      // Pending actions
      const items: PendingActionsFeed['items'] = [];
      overviewPayload.jobs.forEach(j => {
        if (dryhireIds.has(j.id)) return; // skip dryhire for pending
        // Under-staffed alerts based on requirements where present (sound/lights only)
        j.departments.filter((d) => d !== 'video').forEach((d: Dept) => {
          const need = (j.crewNeeded as any)[d] || 0;
          const have = (j.crewAssigned as any)[d] || 0;
          if (need > 0 && have < need) {
            const startsInMs = new Date(j.start_time).getTime() - Date.now();
            const within24h = startsInMs <= 24 * 3600 * 1000;
            items.push({ severity: within24h ? 'red' : 'yellow', text: `${j.title} – ${need - have} open ${d} slot(s)` });
          }
        });
        const ended24h = new Date(j.end_time).getTime() < Date.now() - 24 * 3600 * 1000;
        if (ended24h) {
          // count missing statuses for this job (assigned techs without submitted/approved)
          const m = tsByJobTech.get(j.id) ?? new Map<string, string>();
          const techList = assignedTechsByJob.get(j.id) ?? [];
          const missingCount = techList.filter(tid => {
            const s = m.get(tid);
            return !(s === 'approved' || s === 'submitted');
          }).length;
          if (missingCount > 0) items.push({ severity: 'red', text: `${j.title} – ${missingCount} missing timesheets` });
        }
      });

      if (!cancelled) {
        setOverview(overviewPayload);
        setCalendarData({
          jobs: calendarJobs,
          jobsByDate,
          jobDateLookup,
          range: { start: calendarStartISO, end: calendarEndISO },
          focusMonth: todayStart.getMonth(),
          focusYear: todayStart.getFullYear(),
        });
        setCrew(crewPayload);
        setDocs(docPayload);
        setPending({ items });
      }

      // 5) Logistics calendar (next 7 days)
      const startDate = weekStartISO.slice(0, 10);
      const endDate = weekEndISO.slice(0, 10);
      const { data: le, error: leErr } = await supabase
        .from('logistics_events')
        .select('id,event_date,event_time,title,transport_type,license_plate,job_id,event_type,loading_bay,color,logistics_event_departments(department)')
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true });
      if (leErr) {
        console.error('Wallboard logistics_events error:', leErr);
      }
      const evts = le || [];
      const evtJobIds = Array.from(new Set(evts.map((e: any) => e.job_id).filter(Boolean)));
      const titlesByJob = new Map<string, string>();
      if (evtJobIds.length) {
        const { data: trows } = await supabase.from('jobs').select('id,title').in('id', evtJobIds);
        (trows || []).forEach((r: any) => titlesByJob.set(r.id, r.title));
      }
      const logisticsItemsBase: LogisticsItem[] = evts.map((e: any) => {
        const departments: string[] = Array.isArray(e.logistics_event_departments)
          ? (e.logistics_event_departments as any[]).map(dep => dep?.department).filter(Boolean)
          : [];
        return {
          id: e.id,
          date: e.event_date,
          time: e.event_time,
          title: e.title || titlesByJob.get(e.job_id) || 'Logistics',
          transport_type: e.transport_type ?? null,
          plate: e.license_plate ?? null,
          job_title: titlesByJob.get(e.job_id) || null,
          procedure: e.event_type ?? null,
          loadingBay: e.loading_bay ?? null,
          departments,
          color: e.color ?? null
        };
      });
      // Also include confirmed dry-hire jobs as client pickups
      // Helper to format ISO to date/time strings in the job's timezone
      const toTZParts = (iso: string, tz?: string): { date: string; time: string } => {
        try {
          const d = new Date(iso);
          const zone = tz || 'Europe/Madrid';
          const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
          const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false });
          const date = dateFmt.format(d); // YYYY-MM-DD for en-CA
          const time = timeFmt.format(d); // HH:mm for en-GB
          return { date, time };
        } catch {
          return { date: (iso || '').slice(0, 10), time: (iso || '').slice(11, 16) };
        }
      };

      const dryHireItems: LogisticsItem[] = jobArr
        .filter((j: any) => j.job_type === 'dryhire' && (j.status === 'Confirmado'))
        .flatMap((j: any) => {
          const nowParts = toTZParts(new Date().toISOString(), j.timezone);
          const pickupParts = toTZParts(j.start_time, j.timezone);
          const returnParts = j.end_time ? toTZParts(j.end_time, j.timezone) : null;
          const nowKey = `${nowParts.date}${nowParts.time}`;
          const pickupKey = `${pickupParts.date}${pickupParts.time}`;
          const weekWindowParts = toTZParts(weekEnd.toISOString(), j.timezone);
          const weekWindowKey = `${weekWindowParts.date}${weekWindowParts.time}`;
          const items: LogisticsItem[] = [];

          if (pickupKey >= nowKey && pickupKey <= weekWindowKey) {
            items.push({
              id: `dryhire-${j.id}`,
              date: pickupParts.date,
              time: pickupParts.time,
              title: j.title || 'Dry Hire',
              transport_type: 'recogida cliente',
              plate: null,
              job_title: j.title || null,
              procedure: 'load',
              loadingBay: null,
              departments: [],
            });
          }

          if (returnParts) {
            const returnKey = `${returnParts.date}${returnParts.time}`;
            if (returnKey >= nowKey && returnKey <= weekWindowKey) {
              items.push({
                id: `dryhire-return-${j.id}`,
                date: returnParts.date,
                time: returnParts.time,
                title: j.title || 'Dry Hire',
                transport_type: 'devolución cliente',
                plate: null,
                job_title: j.title || null,
                procedure: 'unload',
                loadingBay: null,
                departments: [],
              });
            }
          }

          return items;
        });
      const logisticsItems: LogisticsItem[] = [...logisticsItemsBase, ...dryHireItems]
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      if (!cancelled) {
        setLogistics(logisticsItems);
        if (isFirstLoad) {
          setIsLoading(false);
          isFirstLoad = false;
        }
      }
    };
    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (cancelled || refreshTimer) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        fetchAll();
      }, 300);
    };

    const channel = supabase
      .channel('wallboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_departments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_documents' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timesheets' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, scheduleRefresh)
      .subscribe();

    fetchAll();

    return () => {
      cancelled = true;
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [isApiMode]);

  useEffect(() => {
    if (!wallboardApiToken) {
      return;
    }
    let cancelled = false;
    const api = new WallboardApi(wallboardApiToken);

    const fetchAll = async () => {
      try {
        const [overviewData, crewData, docData, pendingData, logisticsData, calendarData] = await Promise.all([
          api.jobsOverview(),
          api.crewAssignments(),
          api.docProgress(),
          api.pendingActions(),
          api.logistics(),
          api.calendar(),
        ]);
        if (cancelled) return;
        setOverview(overviewData);
        setCalendarData(buildCalendarFromJobsList(calendarData.jobs));
        setCrew(crewData);
        setDocs(docData);
        setPending(pendingData);
        setLogistics(logisticsData.items);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Wallboard API fetch error:', err);
        if (err instanceof WallboardApiError && (err.status === 401 || err.status === 403)) {
          onFatalError?.('Access token expired or invalid. Please request a new wallboard link.');
        }
      }
    };

    fetchAll();
    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (cancelled || refreshTimer) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        fetchAll();
      }, 300);
    };

    const channel = supabase
      .channel('wallboard-realtime-api')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_departments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_documents' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timesheets' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, scheduleRefresh)
      .subscribe();

    return () => {
      cancelled = true;
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [wallboardApiToken, onFatalError]);

  useEffect(() => {
    if (wallboardApiToken) return;
    let cancelled = false;
    const fetchAnns = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, message, level, active, created_at')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(20);
      if (cancelled) return;
      const staleIds = processAnnouncements(data || []);

      if (staleIds.length) {
        try {
          await supabase
            .from('announcements')
            .update({ active: false })
            .in('id', staleIds);
        } catch (e) {
          // ignore cleanup errors to avoid UI disruption
        }
      }
    };
    fetchAnns();
    const interval = Math.max(5000, tickerIntervalMs);
    const id = setInterval(fetchAnns, interval); // ticker polling
    return () => { cancelled = true; clearInterval(id); };
  }, [tickerIntervalMs, wallboardApiToken, processAnnouncements]);

  useEffect(() => {
    if (!wallboardApiToken) return;
    let cancelled = false;
    const api = new WallboardApi(wallboardApiToken);
    const fetchAnns = async () => {
      try {
        const { announcements } = await api.announcements();
        if (cancelled) return;
        processAnnouncements(announcements || []);
      } catch (err) {
        if (cancelled) return;
        console.error('Wallboard API announcements error:', err);
        if (err instanceof WallboardApiError && (err.status === 401 || err.status === 403)) {
          onFatalError?.('Access token expired or invalid. Please request a new wallboard link.');
        }
      }
    };
    fetchAnns();
    const interval = Math.max(5000, tickerIntervalMs);
    const id = window.setInterval(fetchAnns, interval);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [wallboardApiToken, tickerIntervalMs, processAnnouncements, onFatalError]);

  // Periodic cleanup of expired highlights
  useEffect(() => {
    const id = setInterval(() => {
      setHighlightJobs(prev => {
        const now = Date.now();
        const next = new Map(prev);
        let changed = false;
        for (const [jid, exp] of next) {
          if (exp < now) { next.delete(jid); changed = true; }
        }
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const activePanels = panelOrder.length ? panelOrder : DEFAULT_PANEL_ORDER;
  const safeIdx = activePanels.length ? idx % activePanels.length : 0;
  const current = activePanels[safeIdx] ?? 'overview';

  if (isLoading) {
    return <SplashScreen onComplete={() => setIsLoading(false)} />;
  }

  return (
    <div className={`min-h-screen ${isAlien ? 'bg-black text-[var(--alien-amber)] alien-scanlines alien-vignette' : (theme === 'light' ? 'bg-zinc-100 text-zinc-900' : 'bg-black text-white')}`}>
      {presetMessage && (
        <div className="bg-amber-500/20 text-amber-200 text-sm text-center py-2">
          {presetMessage}
        </div>
      )}
      <div className="overflow-hidden" style={{ height: `calc(100vh - ${footerH + tickerH}px)` }}>{/* Subtract measured ticker + footer height */}
        {current === 'overview' && (isAlien ? <AlienJobsPanel data={overview} highlightIds={new Set(highlightJobs.keys())} /> : <JobsOverviewPanel data={overview} highlightIds={new Set(highlightJobs.keys())} page={panelPages.overview} theme={theme} />)}
        {current === 'crew' && (isAlien ? <AlienCrewPanel data={crew} /> : <CrewAssignmentsPanel data={crew} page={panelPages.crew} theme={theme} />)}
        {current === 'logistics' && (isAlien ? <AlienLogisticsPanel data={logistics} /> : <LogisticsPanel data={logistics} page={panelPages.logistics} theme={theme} />)}
        {current === 'pending' && (isAlien ? <AlienPendingPanel data={pending} /> : <PendingActionsPanel data={pending} theme={theme} />)}
        {current === 'calendar' && (isAlien ? (
          <AlienCalendarPanel data={calendarData} highlightIds={new Set(highlightJobs.keys())} />
        ) : (
          <CalendarPanel
            data={calendarData}
            highlightIds={new Set(highlightJobs.keys())}
            theme={theme}
            scrollSpeed={isProduccionPreset ? 20 : 50}
          />
        ))}
      </div>
      <Ticker messages={tickerMsgs} bottomOffset={footerH} theme={theme} onMeasureHeight={setTickerH} />
      <FooterLogo onToggle={() => setIsAlien(v => !v)} onMeasure={setFooterH} theme={theme} />
    </div>
  );
}

// Alien-styled panels
const AlienShell: React.FC<{ title: string; kind?: 'standard' | 'critical' | 'env' | 'tracker'; children: React.ReactNode }> = ({ title, kind = 'standard', children }) => {
  const headerCls = kind === 'critical' ? 'bg-red-400' : kind === 'env' ? 'bg-blue-400' : kind === 'tracker' ? 'bg-green-400' : 'bg-amber-400';
  return (
    <div className="bg-black border border-amber-400 h-full overflow-hidden font-mono">
      <div className={`${headerCls} text-black px-3 py-1 text-sm font-bold tracking-wider uppercase`}>{title}</div>
      <div className="p-3 text-amber-300 text-xs overflow-auto">
        {children}
      </div>
    </div>
  );
};

const AlienCalendarPanel: React.FC<{ data: CalendarFeed | null; highlightIds?: Set<string> }> = ({ data, highlightIds }) => {
  const { dayNames, monthLabel, cells } = buildCalendarModel(data, highlightIds);
  return (
    <AlienShell title={`VENTANA DE CALENDARIO – ${monthLabel.toUpperCase()}`} kind="tracker">
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-2 text-[10px] uppercase tracking-[0.35em] text-amber-300">
          {dayNames.map(name => (
            <div key={name} className="text-center">{name}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 auto-rows-fr">
          {cells.map((cell, idx) => {
            const jobs = cell.jobs;
            const highlightSet = cell.highlightJobIds;
            const classes = [
              'border border-[var(--alien-border-dim)] bg-black/70 p-3 flex flex-col gap-2 min-h-[12rem] transition-all duration-300',
              cell.inMonth ? 'text-amber-200' : 'text-amber-400/50',
              cell.isToday ? 'border-blue-400 text-blue-200 shadow-[0_0_35px_rgba(96,165,250,0.35)]' : '',
              cell.hasHighlight ? 'bg-amber-400/25 border-amber-300 text-black shadow-[0_0_40px_rgba(251,191,36,0.45)]' : '',
            ].filter(Boolean).join(' ');
            return (
              <div key={cell.isoKey + idx} className={classes}>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold tabular-nums">{cell.date.getDate().toString().padStart(2, '0')}</div>
                  {jobs.length > 0 && (
                    <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300">
                      {jobs.length} evt
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  {jobs.slice(0, 4).map(job => {
                    const highlight = highlightSet.has(job.id);
                    const time = new Date(job.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const jobClasses = highlight
                      ? 'px-2 py-1 bg-amber-300 text-black font-bold uppercase tracking-[0.2em]'
                      : 'px-2 py-1 border border-[var(--alien-border-dim)] text-amber-200 uppercase tracking-[0.2em]';
                    return (
                      <div key={job.id} className={jobClasses}>
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="tabular-nums">{time}</span>
                          <span className="text-[9px] text-amber-400/80">{job.departments.join('/')}</span>
                        </div>
                        <div className="text-[11px] truncate">{job.title}</div>
                        {job.location?.name && (
                          <div className="text-[9px] text-amber-400/70 truncate">{job.location.name}</div>
                        )}
                      </div>
                    );
                  })}
                  {jobs.length > 4 && (
                    <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300">+{jobs.length - 4} MÁS</div>
                  )}
                  {jobs.length === 0 && (
                    <div className="text-[11px] text-amber-500/40 uppercase tracking-[0.4em]">—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AlienShell>
  );
};

const AlienJobsPanel: React.FC<{ data: JobsOverviewFeed | null; highlightIds?: Set<string> }> = ({ data, highlightIds }) => (
  <div className="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 min-h-[calc(100vh-120px)]">
    {(data?.jobs ?? []).map(j => (
      <AlienShell key={j.id} title="RESUMEN DE TRABAJOS - OPERACIONES">
        <div className="space-y-2">
          <div className={`flex justify-between items-center ${highlightIds?.has(j.id) ? 'animate-pulse' : ''}`}>
            <div className={`text-amber-100 text-sm font-bold uppercase tracking-wider ${highlightIds?.has(j.id) ? 'bg-amber-400 text-black px-1' : ''}`}>{j.title}</div>
            <div className={`w-2 h-2 ${j.status === 'green' ? 'bg-green-400 animate-pulse' : j.status === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'}`} />
          </div>
          <div className="text-amber-300 text-xs">{j.location?.name ?? '—'}</div>
          <div className="text-amber-200 text-xs tabular-nums">{new Date(j.start_time).toLocaleString()} → {new Date(j.end_time).toLocaleTimeString()}</div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {j.departments.map(d => (
              <div key={d} className="border border-[var(--alien-border-dim)] p-2">
                <div className="uppercase text-amber-300 text-[10px]">{d}</div>
                <div className="text-amber-100 text-xs tabular-nums">{j.crewAssigned[d] || 0} equipo</div>
                <div className="text-amber-200 text-[10px]">docs {j.docs[d]?.have ?? 0}/{j.docs[d]?.need ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      </AlienShell>
    ))}
    {(!data || data.jobs.length === 0) && (
      <AlienShell title="RESUMEN DE TRABAJOS - OPERACIONES"><div className="text-amber-300">NO HAY TRABAJOS EN VENTANA</div></AlienShell>
    )}
  </div>
);

const AlienCrewPanel: React.FC<{ data: CrewAssignmentsFeed | null }> = ({ data }) => (
  <AlienShell title="ESTADO DEL EQUIPO - MONITOR BIOSIGN" kind="tracker">
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
      {(data?.jobs ?? []).map(job => (
        <div key={job.id} className="border border-[var(--alien-border-dim)] p-2">
          <div className="uppercase text-amber-100 text-xs font-bold tracking-wider mb-1">{job.title}</div>
          <div className="space-y-1">
            {job.crew.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-amber-200 text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 ${c.timesheetStatus === 'approved' ? 'bg-green-400 animate-pulse' : c.timesheetStatus === 'submitted' ? 'bg-blue-400' : c.timesheetStatus === 'draft' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                  <span className="truncate">{c.name || '—'} ({c.dept || '—'})</span>
                </div>
                <div className="uppercase text-amber-300 text-[10px]">{c.role}</div>
              </div>
            ))}
            {job.crew.length === 0 && <div className="text-amber-300 text-xs">NO HAY EQUIPO ASIGNADO</div>}
          </div>
        </div>
      ))}
      {(!data || data.jobs.length === 0) && (
        <div className="text-amber-300">NO HAY TRABAJOS</div>
      )}
    </div>
  </AlienShell>
);

const AlienDocsPanel: React.FC<{ data: DocProgressFeed | null }> = ({ data }) => (
  <AlienShell title="DOCUMENTACIÓN - CONTROL AMBIENTAL" kind="env">
    <div className="space-y-2">
      {(data?.jobs ?? []).map(job => (
        <div key={job.id} className="border border-[var(--alien-border-dim)] p-2">
          <div className="uppercase text-amber-100 text-xs font-bold tracking-wider mb-1">{job.title}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {job.departments.map(dep => {
              const pct = dep.need > 0 ? Math.round((dep.have / dep.need) * 100) : 0;
              return (
                <div key={dep.dept}>
                  <div className="flex justify-between items-center text-amber-300 text-[10px] uppercase mb-1">
                    <span>{dep.dept}</span>
                    <span>{dep.have}/{dep.need}</span>
                  </div>
                  <div className="w-full h-2 bg-black border border-blue-400/50">
                    <div className={`${pct < 100 ? 'bg-blue-400' : 'bg-green-400'} h-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {(!data || data.jobs.length === 0) && (
        <div className="text-amber-300">NO HAY PROGRESO DE DOCUMENTOS DISPONIBLE</div>
      )}
    </div>
  </AlienShell>
);

const AlienPendingPanel: React.FC<{ data: PendingActionsFeed | null }> = ({ data }) => (
  <AlienShell title="ALERTAS DEL SISTEMA - PROTOCOLO DE EMERGENCIA" kind="critical">
    <div className="space-y-2">
      {(data?.items ?? []).map((it, i) => (
        <div key={i} className={`px-2 py-1 text-xs font-mono ${it.severity === 'red' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-black'}`}>{it.text}</div>
      ))}
      {(data?.items.length ?? 0) === 0 && <div className="text-amber-300">TODOS LOS SISTEMAS NOMINALES</div>}
    </div>
  </AlienShell>
);

// Logistics Panels
const LogisticsPanel: React.FC<{ data: LogisticsItem[] | null; page?: number; pageSize?: number; theme?: 'light' | 'dark' }> = ({ data, page = 0, pageSize = 6, theme = 'light' }) => {
  const items = data ?? [];
  const paginatedItems = items.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(items.length / pageSize);

  return (
    <AutoScrollWrapper speed={75}>
      <PanelContainer theme={theme}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-5xl font-semibold">Logística – Próximos días</h1>
          {totalPages > 1 && (
            <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Página {page + 1} de {totalPages}</div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {paginatedItems.map(ev => (
            <div
              key={ev.id}
              className={`border rounded p-3 flex items-center justify-between ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'}`}
              style={{ backgroundColor: getJobCardBackground(ev.color || undefined, theme) }}
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className={`text-32 tabular-nums ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-200'}`}>
                    {ev.date} {ev.time?.slice(0, 5)}
                  </div>
                  <div className={`text-2xl font-semibold ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-100'}`}>
                    {SPANISH_DAY_NAMES[new Date(ev.date).getDay()]}
                  </div>
                </div>
                {getTransportIcon(ev.transport_type as any, ev.procedure as any, 'text-38')}
                <div>
                  <div className="text-38 font-medium">{ev.title}</div>
                  <div className={`mt-1 flex flex-wrap items-center gap-2 text-2xl ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {ev.procedure ? (
                      <span className={`px-2 py-0.5 rounded capitalize ${theme === 'light' ? 'bg-zinc-200 text-zinc-700' : 'bg-zinc-800 text-zinc-200'}`}>{ev.procedure.replace(/_/g, ' ')}</span>
                    ) : null}
                    <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-300'}>{ev.transport_type || 'transport'}</span>
                    {ev.loadingBay && <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-300'}>Bay {ev.loadingBay}</span>}
                    {ev.plate && <span className={theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}>Plate {ev.plate}</span>}
                  </div>
                  {ev.departments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ev.departments.map(dep => (
                        <span key={dep} className={`px-2 py-0.5 rounded text-lg uppercase tracking-wide ${theme === 'light' ? 'bg-zinc-200 text-zinc-700' : 'bg-zinc-800 text-zinc-200'}`}>
                          {dep}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>No hay logística en los próximos 7 días</div>}
        </div>
      </PanelContainer>
    </AutoScrollWrapper>
  );
};

const AlienLogisticsPanel: React.FC<{ data: LogisticsItem[] | null }> = ({ data }) => (
  <AlienShell title="LOGÍSTICA - ESCANEO DE PROXIMIDAD" kind="tracker">
    <div className="space-y-2">
      {(data ?? []).map(ev => (
        <div key={ev.id} className="border border-[var(--alien-border-dim)] p-2 flex items-center justify-between text-amber-200 text-xs">
          <div className="flex items-center gap-3">
            <div className="font-mono tabular-nums">{ev.date} {ev.time?.slice(0, 5)}</div>
            <div className="uppercase text-amber-100">{ev.title}</div>
          </div>
          <div className="text-right">
            <div className="flex flex-wrap justify-end gap-2 text-[10px] text-amber-200">
              {ev.procedure ? (
                <span className="border border-[var(--alien-border-dim)] px-1 py-0.5 uppercase">{ev.procedure.replace(/_/g, ' ')}</span>
              ) : null}
              <span className="uppercase">{ev.transport_type || 'transport'}</span>
              {ev.loadingBay && <span className="uppercase">Bay {ev.loadingBay}</span>}
              {ev.plate && <span className="uppercase text-amber-300">Plate {ev.plate}</span>}
            </div>
            {ev.departments.length > 0 && (
              <div className="mt-1 flex flex-wrap justify-end gap-1 text-[10px] text-amber-300">
                {ev.departments.map(dep => (
                  <span key={dep} className="border border-[var(--alien-border-dim)] px-1 py-0.5 uppercase tracking-wide">
                    {dep}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {(!data || data.length === 0) && <div className="text-amber-300">NO HAY LOGÍSTICA EN VENTANA</div>}
    </div>
  </AlienShell>
);

// Export WallboardDisplay for use by public route
export { WallboardDisplay };

// Default export with auth guard for authenticated route
export default function Wallboard() {
  useRoleGuard(['admin', 'management', 'wallboard']);
  return <WallboardDisplay />;
}
