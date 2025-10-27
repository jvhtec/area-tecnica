import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { ANNOUNCEMENT_LEVEL_STYLES, type AnnouncementLevel } from '@/constants/announcementLevels';

type Dept = 'sound' | 'lights' | 'video';

interface JobsOverviewFeed { jobs: Array<{ id:string; title:string; start_time:string; end_time:string; location:{ name:string|null }|null; departments: Dept[]; crewAssigned: Record<string, number>; crewNeeded: Record<string, number>; docs: Record<string, { have:number; need:number }>; status: 'green'|'yellow'|'red'; }> }
type JobsOverviewJob = JobsOverviewFeed['jobs'][number];
type CalendarFeed = {
  jobs: JobsOverviewJob[];
  jobsByDate: Record<string, JobsOverviewJob[]>;
  jobDateLookup: Record<string, string>;
  range: { start: string; end: string };
  focusMonth: number;
  focusYear: number;
};
interface CrewAssignmentsFeed { jobs: Array<{ id:string; title:string; crew: Array<{ name:string; role:string; dept:Dept|null; timesheetStatus:'submitted'|'draft'|'missing'|'approved'; }> }>; }
interface DocProgressFeed { jobs: Array<{ id:string; title:string; departments: Array<{ dept:Dept; have:number; need:number; missing:string[] }> }> }
interface PendingActionsFeed { items: Array<{ severity:'red'|'yellow'; text:string }> }
interface LogisticsItem { id:string; date:string; time:string; title:string; transport_type:string|null; plate:string|null; job_title?: string|null }

const PanelContainer: React.FC<{ children: React.ReactNode }>=({ children })=> (
  <div className="w-full h-full p-6 flex flex-col gap-4 bg-black text-white">
    {children}
  </div>
);

const StatusDot: React.FC<{ color: 'green'|'yellow'|'red' }>=({ color }) => (
  <span className={`inline-block w-3 h-3 rounded-full mr-2 ${color==='green'?'bg-green-500':color==='yellow'?'bg-yellow-400':'bg-red-500'}`} />
);

const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function buildCalendarModel(data: CalendarFeed | null, highlightIds?: Set<string>): { dayNames: readonly string[]; monthLabel: string; cells: CalendarCell[] } {
  const today = new Date();
  const highlightSet = highlightIds ? new Set(highlightIds) : new Set<string>();
  const fallbackGrid = (() => {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const offset = (startOfMonth.getDay() + 6) % 7;
    const start = new Date(startOfMonth.getTime() - offset * MS_PER_DAY);
    const end = new Date(start.getTime() + (42 - 1) * MS_PER_DAY);
    return { start, end };
  })();
  const gridStart = data ? new Date(data.range.start) : fallbackGrid.start;
  const gridEnd = data ? new Date(data.range.end) : fallbackGrid.end;
  const dayCount = Math.max(1, Math.round((gridEnd.getTime() - gridStart.getTime()) / MS_PER_DAY) + 1);
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
  const rangeStart = data ? new Date(data.range.start) : gridStart;
  const rangeEnd = data ? new Date(data.range.end) : gridEnd;
  const startLabel = monthFormatter.format(new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1));
  const endLabel = monthFormatter.format(new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1));
  const monthLabel = startLabel === endLabel ? startLabel : `${startLabel} → ${endLabel}`;

  const focusMonth = data ? data.focusMonth : today.getMonth();
  const focusYear = data ? data.focusYear : today.getFullYear();

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

const JobsOverviewPanel: React.FC<{ data: JobsOverviewFeed | null; highlightIds?: Set<string> }>=({ data, highlightIds })=> (
  <PanelContainer>
    <h1 className="text-5xl font-semibold">Jobs – Next 7 Days</h1>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {(data?.jobs ?? []).map(j => (
        <div
          key={j.id}
          className={`rounded-lg bg-zinc-900 p-4 border ${highlightIds?.has(j.id) ? 'border-amber-400 ring-4 ring-amber-400/40 animate-pulse' : 'border-zinc-800'}`}
        >
          <div className="flex items-center justify-between">
            <div className="text-2xl font-medium truncate pr-2">{j.title}</div>
            <div className="flex items-center"><StatusDot color={j.status} /></div>
          </div>
          <div className="text-zinc-300 text-lg mt-1">{j.location?.name ?? '—'}</div>
          <div className="text-zinc-400 mt-2 text-xl">{new Date(j.start_time).toLocaleString()} → {new Date(j.end_time).toLocaleTimeString()}</div>
          <div className="mt-3 flex gap-6 text-lg">
            {j.departments.map(d => (
              <div key={d} className="flex items-center gap-2">
                <span className="text-2xl">{d==='sound'?'🎧':d==='lights'?'💡':'📹'}</span>
                <span className="tabular-nums">{(j.crewAssigned as any)[d] || 0}/{(j.crewNeeded as any)[d] ?? 0}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm text-zinc-500">Docs: {j.departments.map(d=>`${d[0].toUpperCase()}${d.slice(1)} ${j.docs[d]?.have ?? 0}/${j.docs[d]?.need ?? 0}`).join(' • ')}</div>
        </div>
      ))}
      {(!data || data.jobs.length===0) && (
        <div className="text-zinc-400 text-2xl">No jobs in the next 7 days</div>
      )}
  </div>
  </PanelContainer>
);

const CrewAssignmentsPanel: React.FC<{ data: CrewAssignmentsFeed | null }>=({ data })=> (
  <PanelContainer>
    <h1 className="text-5xl font-semibold">Crew Assignments</h1>
    <div className="flex flex-col gap-4">
      {(data?.jobs ?? []).map(job => (
        <div key={job.id} className="rounded-lg bg-zinc-900 p-4 border border-zinc-800">
          <div className="text-2xl font-medium mb-3">{job.title}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {job.crew.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-zinc-800/50 rounded-md px-3 py-2">
                <div className="flex items-center gap-3 truncate">
                  <span className="text-2xl">{c.dept==='sound'?'🎧':c.dept==='lights'?'💡':c.dept==='video'?'📹':'👤'}</span>
                  <div className="truncate">
                    <div className="text-xl truncate">{c.name || '—'}</div>
                    <div className="text-sm text-zinc-400 truncate">{c.role}</div>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-sm ${c.timesheetStatus==='approved'?'bg-green-600':c.timesheetStatus==='submitted'?'bg-blue-600':c.timesheetStatus==='draft'?'bg-amber-600':'bg-red-600'}`}>{c.timesheetStatus}</div>
              </div>
            ))}
            {job.crew.length===0 && <div className="text-zinc-400 text-lg">No crew assigned yet</div>}
          </div>
        </div>
      ))}
      {(!data || data.jobs.length===0) && (
        <div className="text-zinc-400 text-2xl">No jobs to show</div>
      )}
    </div>
  </PanelContainer>
);

const DocProgressPanel: React.FC<{ data: DocProgressFeed | null }>=({ data })=> (
  <PanelContainer>
    <h1 className="text-5xl font-semibold">Document Progress</h1>
    <div className="flex flex-col gap-4">
      {(data?.jobs ?? []).map(job => (
        <div key={job.id} className="rounded-lg bg-zinc-900 p-4 border border-zinc-800">
          <div className="text-2xl font-medium mb-3">{job.title}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {job.departments.map(dep => {
              const pct = dep.need>0 ? Math.round((dep.have/dep.need)*100) : 0;
              return (
                <div key={dep.dept} className="bg-zinc-800/50 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xl flex items-center gap-2">
                      <span className="text-2xl">{dep.dept==='sound'?'🎧':dep.dept==='lights'?'💡':'📹'}</span>
                      <span className="capitalize">{dep.dept}</span>
                    </div>
                    <div className="text-sm text-zinc-300">{dep.have}/{dep.need}</div>
                  </div>
                  <div className="h-2 bg-zinc-700 rounded">
                    <div className="h-2 bg-blue-500 rounded" style={{ width: `${pct}%` }} />
                  </div>
                  {dep.missing.length>0 && (
                    <div className="text-sm text-zinc-400 mt-2">Missing: {dep.missing.join(', ')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {(!data || data.jobs.length===0) && (
        <div className="text-zinc-400 text-2xl">Nothing pending</div>
      )}
    </div>
  </PanelContainer>
);

const PendingActionsPanel: React.FC<{ data: PendingActionsFeed | null }>=({ data })=> (
  <PanelContainer>
    <h1 className="text-5xl font-semibold">Pending Actions</h1>
    <div className="flex flex-col gap-3 text-2xl">
      {(data?.items ?? []).map((it, i) => (
        <div key={i} className={`rounded-md px-4 py-3 ${it.severity==='red'?'bg-red-700/30 border border-red-700/50':'bg-amber-700/30 border border-amber-700/50'}`}>{it.text}</div>
      ))}
      {(data?.items.length ?? 0)===0 && <div className="text-zinc-400">All good ✅</div>}
    </div>
  </PanelContainer>
);

const CalendarPanel: React.FC<{ data: CalendarFeed | null; highlightIds?: Set<string> }>=({ data, highlightIds }) => {
  const { dayNames, monthLabel, cells } = buildCalendarModel(data, highlightIds);
  return (
    <PanelContainer>
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-semibold leading-tight">Job Calendar</h1>
          <div className="text-2xl uppercase tracking-[0.35em] text-zinc-400 mt-2">{monthLabel}</div>
        </div>
        <div className="text-right text-xl text-zinc-500 max-w-[28rem] leading-snug">
          Six-week horizon of confirmed & tentative jobs with highlight callouts.
        </div>
      </div>
      <div className="grid grid-cols-7 gap-4 text-zinc-500 uppercase tracking-[0.35em] text-lg font-semibold pt-2">
        {dayNames.map(name => (
          <div key={name} className="text-center">{name}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-4 auto-rows-fr flex-1">
        {cells.map((cell, idx) => {
          const jobs = cell.jobs;
          const highlightSet = cell.highlightJobIds;
          const classes = [
            'rounded-2xl border p-6 flex flex-col gap-4 min-h-[18rem] shadow-inner transition-all duration-300 backdrop-blur-sm',
            cell.inMonth ? 'bg-zinc-950/90 border-zinc-800 text-white' : 'bg-zinc-900/40 border-zinc-800/40 text-zinc-500',
            cell.isToday ? 'border-blue-400/80 ring-2 ring-blue-400/30 shadow-[0_0_45px_rgba(96,165,250,0.35)]' : '',
            cell.hasHighlight ? 'border-amber-400/80 ring-4 ring-amber-400/30 shadow-[0_0_55px_rgba(251,191,36,0.35)]' : '',
          ].filter(Boolean).join(' ');
          return (
            <div key={cell.isoKey + idx} className={classes}>
              <div className="flex items-start justify-between">
                <div className={`text-5xl font-bold leading-none ${cell.inMonth ? '' : 'text-zinc-600'}`}>{cell.date.getDate()}</div>
                {jobs.length > 0 && (
                  <div className="flex items-center gap-3 text-zinc-400">
                    <span className="px-4 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-2xl font-semibold tabular-nums">
                      {jobs.length}
                    </span>
                    <span className="tracking-[0.4em] uppercase text-sm">jobs</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                {jobs.slice(0, 3).map(job => {
                  const highlight = highlightSet.has(job.id);
                  const time = new Date(job.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const itemClasses = [
                    'flex items-start gap-3 rounded-xl border px-4 py-3 backdrop-blur-sm',
                    highlight
                      ? 'border-amber-300 bg-amber-500/20 text-amber-100 shadow-[0_0_35px_rgba(251,191,36,0.4)]'
                      : 'border-zinc-700 bg-zinc-900/70 text-zinc-100',
                  ].join(' ');
                  return (
                    <div key={job.id} className={itemClasses}>
                      <div className="pt-1"><StatusDot color={job.status} /></div>
                      <div className="flex-1 overflow-hidden">
                        <div className="text-2xl font-semibold truncate leading-tight">{job.title}</div>
                        <div className="text-lg text-zinc-400 flex flex-wrap gap-x-3 gap-y-1 leading-tight">
                          <span className="tabular-nums">{time}</span>
                          {job.location?.name && (
                            <span className="truncate max-w-[16rem]">{job.location.name}</span>
                          )}
                          {job.departments.length > 0 && (
                            <span className="uppercase tracking-[0.3em] text-sm text-zinc-500">
                              {job.departments.join(' / ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {jobs.length > 3 && (
                  <div className="text-xl text-zinc-400">+{jobs.length - 3} more scheduled</div>
                )}
                {jobs.length === 0 && (
                  <div className="text-3xl text-zinc-700 tracking-[0.4em] uppercase">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PanelContainer>
  );
};

type TickerMessage = { message: string; level: AnnouncementLevel };

const Ticker: React.FC<{ messages: TickerMessage[]; bottomOffset?: number }>=({ messages, bottomOffset = 0 })=> {
  const [posX, setPosX] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const gap = 64; // px spacing between repeats
  const contentKey = (messages || []).map(m => `${m.level}:${m.message}`).join('|');

  const hasMessages = messages.length > 0;

  const renderCopy = (options?: { ref?: (node: HTMLSpanElement | null) => void; paddingLeft?: number }) => (
    <span
      ref={options?.ref}
      className="inline-flex items-center text-xl"
      style={options?.paddingLeft ? { paddingLeft: options.paddingLeft } : undefined}
    >
      {messages.map((msg, idx) => (
        <React.Fragment key={`${idx}-${msg.message}`}>
          <span className={`px-2 whitespace-nowrap ${ANNOUNCEMENT_LEVEL_STYLES[msg.level].text}`}>
            {msg.message}
          </span>
          {idx < messages.length - 1 && (
            <span className="px-6 text-zinc-500">•</span>
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

  return (
    <div ref={containerRef} className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 border-t border-zinc-800 py-2 text-xl overflow-hidden" style={{ bottom: bottomOffset }}>
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

const FooterLogo: React.FC<{ onToggle?: () => void; onMeasure?: (h: number) => void }> = ({ onToggle, onMeasure }) => {
  // Use Supabase public bucket: "public logos"/sectorlogow.png, with local fallbacks
  const { data } = supabase.storage.from('public logos').getPublicUrl('sectorlogow.png');
  const primary = data?.publicUrl;
  const fallbacks = [
    '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png',
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
    <div ref={containerRef} className="fixed bottom-0 left-0 right-0 py-3 bg-black/70 border-t border-zinc-800 flex items-center justify-center z-50">
      <img
        src={src}
        alt="Company Logo"
        className="h-12 w-auto opacity-90 cursor-pointer select-none"
        onError={() => setIdx(i => i + 1)}
        onClick={() => onToggle && onToggle()}
      />
    </div>
  );
};

type PanelKey = 'overview'|'crew'|'docs'|'logistics'|'pending'|'calendar';

const PANEL_KEYS: PanelKey[] = ['overview','crew','docs','logistics','pending','calendar'];
const DEFAULT_PANEL_ORDER: PanelKey[] = [...PANEL_KEYS];
const DEFAULT_PANEL_DURATIONS: Record<PanelKey, number> = {
  overview: 12,
  crew: 12,
  docs: 12,
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

export default function Wallboard() {
  useRoleGuard(['admin','management','wallboard']);
  const { presetSlug } = useParams<{ presetSlug?: string }>();
  const effectiveSlug = (presetSlug?.trim() || 'default').toLowerCase();

  const [isAlien, setIsAlien] = useState(false);
  const [panelOrder, setPanelOrder] = useState<PanelKey[]>([...DEFAULT_PANEL_ORDER]);
  const [panelDurations, setPanelDurations] = useState<Record<PanelKey, number>>({ ...DEFAULT_PANEL_DURATIONS });
  const [rotationFallbackSeconds, setRotationFallbackSeconds] = useState<number>(DEFAULT_ROTATION_FALLBACK_SECONDS);
  const [highlightTtlMs, setHighlightTtlMs] = useState<number>(DEFAULT_HIGHLIGHT_TTL_SECONDS * 1000);
  const [tickerIntervalMs, setTickerIntervalMs] = useState<number>(DEFAULT_TICKER_SECONDS * 1000);
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

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
      setIdx(current => {
        const total = activePanels.length;
        if (total <= 0) return 0;
        return (current + 1) % total;
      });
    }, durationMs);
    return () => clearTimeout(timer);
  }, [idx, panelOrder, panelDurations, rotationFallbackSeconds]);

  useEffect(() => {
    let cancelled = false;
    setPresetMessage(null);
    const loadPreset = async () => {
      const { data, error } = await supabase
        .from('wallboard_presets')
        .select('panel_order, panel_durations, rotation_fallback_seconds, highlight_ttl_seconds, ticker_poll_interval_seconds')
        .eq('slug', effectiveSlug)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('Wallboard preset load error:', error);
      }

      if (error || !data) {
        setPanelOrder([...DEFAULT_PANEL_ORDER]);
        setPanelDurations({ ...DEFAULT_PANEL_DURATIONS });
        setRotationFallbackSeconds(DEFAULT_ROTATION_FALLBACK_SECONDS);
        setHighlightTtlMs(DEFAULT_HIGHLIGHT_TTL_SECONDS * 1000);
        setTickerIntervalMs(DEFAULT_TICKER_SECONDS * 1000);
        setPresetMessage(`Using default wallboard preset${effectiveSlug !== 'default' ? ` (missing "${effectiveSlug}")` : ''}.`);
        setHighlightJobs(new Map());
        setIdx(0);
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
  }, [effectiveSlug]);

  // Data polling (client-side via RLS-safe views)
  const [overview, setOverview] = useState<JobsOverviewFeed|null>(null);
  const [calendarData, setCalendarData] = useState<CalendarFeed|null>(null);
  const [crew, setCrew] = useState<CrewAssignmentsFeed|null>(null);
  const [docs, setDocs] = useState<DocProgressFeed|null>(null);
  const [pending, setPending] = useState<PendingActionsFeed|null>(null);
  const [logistics, setLogistics] = useState<LogisticsItem[]|null>(null);
  const [tickerMsgs, setTickerMsgs] = useState<TickerMessage[]>([]);
  const [highlightJobs, setHighlightJobs] = useState<Map<string, number>>(new Map());
  const [footerH, setFooterH] = useState<number>(72);

  useEffect(() => {
    let cancelled = false;
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

      const jobOverlapsWeek = (j:any) => {
        const startTime = new Date(j.start_time).getTime();
        const endTime = new Date(j.end_time).getTime();
        return endTime >= weekStartMs && startTime <= weekEndMs;
      };
      const jobWithinCalendarWindow = (j:any) => {
        const startTime = new Date(j.start_time).getTime();
        const endTime = new Date(j.end_time).getTime();
        return endTime >= calendarStartMs && startTime <= calendarEndMs;
      };

      // 1) Fetch jobs (base fields only)
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id,title,start_time,end_time,status,location_id,job_type,tour_id,timezone')
        .in('job_type', ['single','festival','tourdate','dryhire'])
        .in('status', ['Confirmado','Tentativa'])
        .lte('start_time', calendarEndISO)
        .gte('end_time', calendarStartISO)
        .order('start_time', { ascending: true });
      if (jobsError) console.error('Wallboard jobs query error:', jobsError?.message || jobsError, { calendarStartISO, calendarEndISO });
      let jobArr = jobs || [];

      // Exclude jobs whose parent tour is cancelled (some entries may still be Confirmado)
      const tourIds = Array.from(new Set(jobArr.map((j:any)=>j.tour_id).filter(Boolean)));
      if (tourIds.length) {
        const { data: toursMeta, error: toursErr } = await supabase
          .from('tours')
          .select('id,status')
          .in('id', tourIds);
        if (toursErr) {
          console.warn('Wallboard tours meta error:', toursErr);
        } else if (toursMeta && toursMeta.length) {
          const cancelledTours = new Set((toursMeta as any[]).filter(t=>t.status==='cancelled').map(t=>t.id));
          if (cancelledTours.size) {
            jobArr = jobArr.filter((j:any)=> !j.tour_id || !cancelledTours.has(j.tour_id));
          }
        }
      }
      const jobIds = jobArr.map(j=>j.id);
      const detailJobSet = new Set(jobArr.filter(jobOverlapsWeek).map((j:any)=>j.id));
      const detailJobIds = Array.from(detailJobSet);
      const dryhireIds = new Set<string>(jobArr.filter((j:any)=>j.job_type==='dryhire').map((j:any)=>j.id));
      const locationIds = Array.from(new Set(jobArr.map((j:any)=>j.location_id).filter(Boolean)));

      // 2) Fetch departments for these jobs
      const { data: deptRows, error: deptErr } = jobIds.length
        ? await supabase.from('job_departments').select('job_id,department').in('job_id', jobIds)
        : { data: [], error: null } as any;
      if (deptErr) console.error('Wallboard job_departments error:', deptErr);
      const deptsByJob = new Map<string, Dept[]>();
      (deptRows||[]).forEach((r:any)=>{
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
      (assignRows||[]).forEach((a:any)=>{
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
      (reqRows || []).forEach((r:any) => {
        needByJobDept.set(`${r.job_id}:${r.department}`, Number(r.total_required || 0));
      });

      // 4) Fetch locations for names
      const { data: locRows, error: locErr } = locationIds.length
        ? await supabase.from('locations').select('id,name').in('id', locationIds)
        : { data: [], error: null } as any;
      if (locErr) console.error('Wallboard locations error:', locErr);
      const locById = new Map<string, string>();
      (locRows||[]).forEach((l:any)=> locById.set(l.id, l.name));

      // Timesheet statuses via view
      const tsByJobTech = new Map<string, Map<string,string>>();
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

      const needByDept = new Map<string, number>((reqs||[]).map(r=>[r.department, r.need]));
      const haveByJobDept = new Map<string, number>();
      (counts||[]).forEach((c:any)=> haveByJobDept.set(`${c.job_id}:${c.department}`, c.have));

      const mapJob = (j:any): JobsOverviewJob => {
        const deptsAll: Dept[] = (deptsByJob.get(j.id) ?? []) as Dept[];
        const depts: Dept[] = deptsAll.filter(d => d !== 'video');
        const crewAssigned: Record<string, number> = { sound: 0, lights: 0, video: 0 };
        const assignmentRows = detailJobSet.has(j.id) ? (assignsByJob.get(j.id) ?? []) : [];
        assignmentRows.forEach((a:any)=>{
          if (a.sound_role) crewAssigned.sound++;
          if (a.lights_role) crewAssigned.lights++;
          if (a.video_role) crewAssigned.video++;
        });
        const crewNeeded: Record<string, number> = { sound: 0, lights: 0, video: 0 };
        depts.forEach(d => {
          crewNeeded[d] = detailJobSet.has(j.id) ? (needByJobDept.get(`${j.id}:${d}`) || 0) : 0;
        });
        let status: 'green'|'yellow'|'red';
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
            const present = depts.map(d=>crewAssigned[d]);
            const hasAny = present.some(n=>n>0);
            const allHave = depts.length>0 && present.every(n=>n>0);
            status = allHave ? 'green' : hasAny ? 'yellow' : 'red';
          }
        } else {
          status = j.status === 'Confirmado' ? 'green' : 'yellow';
        }
        const docs: Record<string, { have:number; need:number }> = {};
        depts.forEach(d=>{
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
          crewAssigned: { ...crewAssigned, total: (crewAssigned.sound+crewAssigned.lights+crewAssigned.video) },
          crewNeeded: { ...crewNeeded, total: (crewNeeded.sound + crewNeeded.lights + crewNeeded.video) },
          docs,
          status,
        };
      };

      const calendarJobs: JobsOverviewJob[] = jobArr
        .filter((j:any)=> !dryhireIds.has(j.id))
        .filter(jobWithinCalendarWindow)
        .map(mapJob)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const jobsForWeek: JobsOverviewJob[] = jobArr
        .filter((j:any)=> !dryhireIds.has(j.id))
        .filter(jobOverlapsWeek)
        .map(mapJob)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const jobsByDate: Record<string, JobsOverviewJob[]> = {};
      const jobDateLookup: Record<string, string> = {};
      calendarJobs.forEach(job => {
        const key = formatDateKey(new Date(job.start_time));
        jobDateLookup[job.id] = key;
        const bucket = jobsByDate[key] ?? (jobsByDate[key] = []);
        bucket.push(job);
      });

      const overviewPayload: JobsOverviewFeed = {
        jobs: jobsForWeek,
      };

        // Crew assignments
        const assignedTechsByJob = new Map<string, string[]>();
        const crewPayload: CrewAssignmentsFeed = {
          jobs: jobArr
            .filter((j:any)=> !dryhireIds.has(j.id))
            .filter(jobOverlapsWeek)
            .map((j:any)=>{
              const crew = (assignsByJob.get(j.id) ?? [])
                // Hide video crew
                .filter((a:any)=> a.video_role == null)
                .map((a:any)=>{
                  const dept: Dept | null = a.sound_role ? 'sound' : a.lights_role ? 'lights' : null;
                  const role = a.sound_role || a.lights_role || 'assigned';
                  const list = assignedTechsByJob.get(j.id) ?? [];
                  list.push(a.technician_id);
                  assignedTechsByJob.set(j.id, list);
                  return { name: '', role, dept, timesheetStatus: 'missing' as const, technician_id: a.technician_id } as any;
                });
              return { id: j.id, title: j.title, crew };
            })
        } as any;

        // Fill names in one request
        const techIds = Array.from(new Set(crewPayload.jobs.flatMap(j=>j.crew.map((c:any)=>c.technician_id))));
        if (techIds.length) {
        const { data: profs } = await supabase
          .from('wallboard_profiles')
          .select('id,first_name,last_name,department')
          .in('id', techIds);
        const byId = new Map<string, any>((profs||[]).map(p=>[p.id, p]));
        crewPayload.jobs.forEach(j=>{
          j.crew.forEach((c:any)=>{
            const p = byId.get(c.technician_id);
            c.name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '';
            const s = tsByJobTech.get(j.id)?.get(c.technician_id) as any;
            const inPast = new Date(jobArr.find(x=>x.id===j.id)?.end_time||Date.now()) < new Date();
            const normalizedStatus = s === 'rejected' ? 'rejected' : s;
            c.timesheetStatus = inPast && normalizedStatus==='approved' ? 'approved' : (normalizedStatus || 'missing');
            delete c.technician_id;
          });
        });
      }

      // Doc progress
        const docPayload: DocProgressFeed = {
          jobs: jobArr
            .filter((j:any)=> !dryhireIds.has(j.id))
            .filter(jobOverlapsWeek)
            .map((j:any)=>{
              const deptsAll: Dept[] = (deptsByJob.get(j.id) ?? []) as Dept[];
              return {
                id: j.id,
              title: j.title,
              departments: deptsAll.map((d:Dept)=>({
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
      overviewPayload.jobs.forEach(j=>{
        if (dryhireIds.has(j.id)) return; // skip dryhire for pending
        // Under-staffed alerts based on requirements where present (sound/lights only)
        j.departments.filter((d)=> d!=='video').forEach((d:Dept)=>{
          const need = (j.crewNeeded as any)[d] || 0;
          const have = (j.crewAssigned as any)[d] || 0;
          if (need > 0 && have < need) {
            const startsInMs = new Date(j.start_time).getTime() - Date.now();
            const within24h = startsInMs <= 24*3600*1000;
            items.push({ severity: within24h ? 'red' : 'yellow', text: `${j.title} – ${need-have} open ${d} slot(s)`});
          }
        });
        const ended24h = new Date(j.end_time).getTime() < Date.now() - 24*3600*1000;
        if (ended24h) {
          // count missing statuses for this job (assigned techs without submitted/approved)
          const m = tsByJobTech.get(j.id) ?? new Map<string,string>();
          const techList = assignedTechsByJob.get(j.id) ?? [];
          const missingCount = techList.filter(tid => {
            const s = m.get(tid);
            return !(s === 'approved' || s === 'submitted');
          }).length;
          if (missingCount>0) items.push({ severity: 'red', text: `${j.title} – ${missingCount} missing timesheets`});
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
      const startDate = weekStartISO.slice(0,10);
      const endDate = weekEndISO.slice(0,10);
      const { data: le, error: leErr } = await supabase
        .from('logistics_events')
        .select('id,event_date,event_time,title,transport_type,license_plate,job_id')
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true });
      if (leErr) {
        console.error('Wallboard logistics_events error:', leErr);
      }
      const evts = le || [];
      const evtJobIds = Array.from(new Set(evts.map((e:any)=>e.job_id).filter(Boolean)));
      const titlesByJob = new Map<string,string>();
      if (evtJobIds.length) {
        const { data: trows } = await supabase.from('jobs').select('id,title').in('id', evtJobIds);
        (trows||[]).forEach((r:any)=> titlesByJob.set(r.id, r.title));
      }
      const logisticsItemsBase: LogisticsItem[] = evts.map((e:any)=>({
        id: e.id,
        date: e.event_date,
        time: e.event_time,
        title: e.title || titlesByJob.get(e.job_id) || 'Logistics',
        transport_type: e.transport_type ?? null,
        plate: e.license_plate ?? null,
        job_title: titlesByJob.get(e.job_id) || null,
      }));
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
          return { date: (iso || '').slice(0,10), time: (iso || '').slice(11,16) };
        }
      };

      const dryHireItems: LogisticsItem[] = jobArr
        .filter((j:any)=> j.job_type==='dryhire' && (j.status==='Confirmado'))
        .flatMap((j:any)=>{
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
              });
            }
          }

          return items;
        });
      const logisticsItems: LogisticsItem[] = [...logisticsItemsBase, ...dryHireItems]
        .sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time));
      if (!cancelled) setLogistics(logisticsItems);
    };
    fetchAll();
    const id = setInterval(fetchAll, 60000); // 60s polling
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchAnns = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, message, level, active, created_at')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!cancelled) {
        const regex = /^\s*\[HIGHLIGHT_JOB:([a-f0-9\-]+)\]\s*/i;
        const messages: TickerMessage[] = [];
        const now = Date.now();
        const updated = new Map(highlightJobs);
        const ttl = Math.max(1000, highlightTtlMs);
        const staleIds: string[] = [];
        (data||[]).forEach((a:any) => {
          let m = a.message || '';
          const levelRaw = (a.level ?? 'info') as AnnouncementLevel;
          const level: AnnouncementLevel = ['info','warn','critical'].includes(levelRaw) ? levelRaw : 'info';
          const match = m.match(regex);
          if (match) {
            const jobId = match[1];
            const created = a.created_at ? new Date(a.created_at).getTime() : now;
            const expireAt = created + ttl;
            if (expireAt > now) {
              updated.set(jobId, expireAt);
            } else if (a.id) {
              staleIds.push(a.id);
            }
            m = m.replace(regex, '');
          }
          // Always include the message body in the ticker
          if (m.trim()) messages.push({ message: m.trim(), level });
        });
        // Drop expired
        for (const [jid, exp] of updated) {
          if (exp < now) updated.delete(jid);
        }
        setHighlightJobs(updated);
        setTickerMsgs(messages);

        // Best-effort cleanup of stale highlight announcements (DB flip to inactive)
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
      }
    };
    fetchAnns();
    const interval = Math.max(5000, tickerIntervalMs);
    const id = setInterval(fetchAnns, interval); // ticker polling
    return () => { cancelled = true; clearInterval(id); };
  }, [highlightTtlMs, tickerIntervalMs]);

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
  return (
    <div className={`min-h-screen ${isAlien ? 'bg-black text-[var(--alien-amber)] alien-scanlines alien-vignette' : 'bg-black text-white'}`}>
      {presetMessage && (
        <div className="bg-amber-500/20 text-amber-200 text-sm text-center py-2">
          {presetMessage}
        </div>
      )}
      <div className="pb-28">{/* space for ticker + footer */}
        {current==='overview' && (isAlien ? <AlienJobsPanel data={overview} highlightIds={new Set(highlightJobs.keys())} /> : <JobsOverviewPanel data={overview} highlightIds={new Set(highlightJobs.keys())} />)}
        {current==='crew' && (isAlien ? <AlienCrewPanel data={crew} /> : <CrewAssignmentsPanel data={crew} />)}
        {current==='docs' && (isAlien ? <AlienDocsPanel data={docs} /> : <DocProgressPanel data={docs} />)}
        {current==='logistics' && (isAlien ? <AlienLogisticsPanel data={logistics} /> : <LogisticsPanel data={logistics} />)}
        {current==='pending' && (isAlien ? <AlienPendingPanel data={pending} /> : <PendingActionsPanel data={pending} />)}
        {current==='calendar' && (isAlien ? <AlienCalendarPanel data={calendarData} highlightIds={new Set(highlightJobs.keys())} /> : <CalendarPanel data={calendarData} highlightIds={new Set(highlightJobs.keys())} />)}
      </div>
      <Ticker messages={tickerMsgs} bottomOffset={footerH} />
      <FooterLogo onToggle={() => setIsAlien(v => !v)} onMeasure={setFooterH} />
    </div>
  );
}

// Alien-styled panels
const AlienShell: React.FC<{ title: string; kind?: 'standard'|'critical'|'env'|'tracker'; children: React.ReactNode }>=({ title, kind='standard', children })=> {
  const headerCls = kind==='critical' ? 'bg-red-400' : kind==='env' ? 'bg-blue-400' : kind==='tracker' ? 'bg-green-400' : 'bg-amber-400';
  return (
    <div className="bg-black border border-amber-400 h-full overflow-hidden font-mono">
      <div className={`${headerCls} text-black px-3 py-1 text-sm font-bold tracking-wider uppercase`}>{title}</div>
      <div className="p-3 text-amber-300 text-xs overflow-auto">
        {children}
      </div>
    </div>
  );
};

const AlienCalendarPanel: React.FC<{ data: CalendarFeed | null; highlightIds?: Set<string> }>=({ data, highlightIds })=> {
  const { dayNames, monthLabel, cells } = buildCalendarModel(data, highlightIds);
  return (
    <AlienShell title={`CALENDAR WINDOW – ${monthLabel.toUpperCase()}`} kind="tracker">
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
                    <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300">+{jobs.length - 4} MORE</div>
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

const AlienJobsPanel: React.FC<{ data: JobsOverviewFeed | null; highlightIds?: Set<string> }>=({ data, highlightIds })=> (
  <div className="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 min-h-[calc(100vh-120px)]">
    {(data?.jobs ?? []).map(j => (
      <AlienShell key={j.id} title="JOBS OVERVIEW - OPERATIONS">
        <div className="space-y-2">
          <div className={`flex justify-between items-center ${highlightIds?.has(j.id) ? 'animate-pulse' : ''}`}>
            <div className={`text-amber-100 text-sm font-bold uppercase tracking-wider ${highlightIds?.has(j.id) ? 'bg-amber-400 text-black px-1' : ''}`}>{j.title}</div>
            <div className={`w-2 h-2 ${j.status==='green'?'bg-green-400 animate-pulse': j.status==='yellow'?'bg-yellow-400':'bg-red-400'}`} />
          </div>
          <div className="text-amber-300 text-xs">{j.location?.name ?? '—'}</div>
          <div className="text-amber-200 text-xs tabular-nums">{new Date(j.start_time).toLocaleString()} → {new Date(j.end_time).toLocaleTimeString()}</div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {j.departments.map(d => (
              <div key={d} className="border border-[var(--alien-border-dim)] p-2">
                <div className="uppercase text-amber-300 text-[10px]">{d}</div>
                <div className="text-amber-100 text-xs tabular-nums">{j.crewAssigned[d] || 0} crew</div>
                <div className="text-amber-200 text-[10px]">docs {j.docs[d]?.have ?? 0}/{j.docs[d]?.need ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      </AlienShell>
    ))}
    {(!data || data.jobs.length===0) && (
      <AlienShell title="JOBS OVERVIEW - OPERATIONS"><div className="text-amber-300">NO JOBS IN WINDOW</div></AlienShell>
    )}
  </div>
);

const AlienCrewPanel: React.FC<{ data: CrewAssignmentsFeed | null }>=({ data })=> (
  <AlienShell title="CREW STATUS - BIOSIGN MONITOR" kind="tracker">
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
      {(data?.jobs ?? []).map(job => (
        <div key={job.id} className="border border-[var(--alien-border-dim)] p-2">
          <div className="uppercase text-amber-100 text-xs font-bold tracking-wider mb-1">{job.title}</div>
          <div className="space-y-1">
            {job.crew.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-amber-200 text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 ${c.timesheetStatus==='approved'?'bg-green-400 animate-pulse': c.timesheetStatus==='submitted'?'bg-blue-400': c.timesheetStatus==='draft'?'bg-yellow-400':'bg-red-400'}`} />
                  <span className="truncate">{c.name || '—'} ({c.dept || '—'})</span>
                </div>
                <div className="uppercase text-amber-300 text-[10px]">{c.role}</div>
              </div>
            ))}
            {job.crew.length===0 && <div className="text-amber-300 text-xs">NO CREW ASSIGNED</div>}
          </div>
        </div>
      ))}
      {(!data || data.jobs.length===0) && (
        <div className="text-amber-300">NO JOBS</div>
      )}
    </div>
  </AlienShell>
);

const AlienDocsPanel: React.FC<{ data: DocProgressFeed | null }>=({ data })=> (
  <AlienShell title="DOCUMENTATION - ENV CONTROL" kind="env">
    <div className="space-y-2">
      {(data?.jobs ?? []).map(job => (
        <div key={job.id} className="border border-[var(--alien-border-dim)] p-2">
          <div className="uppercase text-amber-100 text-xs font-bold tracking-wider mb-1">{job.title}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {job.departments.map(dep => {
              const pct = dep.need>0 ? Math.round((dep.have/dep.need)*100) : 0;
              return (
                <div key={dep.dept}>
                  <div className="flex justify-between items-center text-amber-300 text-[10px] uppercase mb-1">
                    <span>{dep.dept}</span>
                    <span>{dep.have}/{dep.need}</span>
                  </div>
                  <div className="w-full h-2 bg-black border border-blue-400/50">
                    <div className={`${pct<100?'bg-blue-400':'bg-green-400'} h-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {(!data || data.jobs.length===0) && (
        <div className="text-amber-300">NO DOCUMENT PROGRESS AVAILABLE</div>
      )}
    </div>
  </AlienShell>
);

const AlienPendingPanel: React.FC<{ data: PendingActionsFeed | null }>=({ data })=> (
  <AlienShell title="SYSTEM ALERTS - EMERGENCY PROTOCOL" kind="critical">
    <div className="space-y-2">
      {(data?.items ?? []).map((it, i) => (
        <div key={i} className={`px-2 py-1 text-xs font-mono ${it.severity==='red'?'bg-red-600 text-white':'bg-yellow-600 text-black'}`}>{it.text}</div>
      ))}
      {(data?.items.length ?? 0)===0 && <div className="text-amber-300">ALL SYSTEMS NOMINAL</div>}
    </div>
  </AlienShell>
);

// Logistics Panels
const LogisticsPanel: React.FC<{ data: LogisticsItem[] | null }>=({ data })=> (
  <PanelContainer>
    <h1 className="text-5xl font-semibold">Logistics – Next 7 Days</h1>
    <div className="flex flex-col gap-3">
      {(data ?? []).map(ev => (
        <div key={ev.id} className="bg-zinc-900 border border-zinc-800 rounded p-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-xl tabular-nums text-zinc-200">{ev.date} {ev.time?.slice(0,5)}</div>
            <div className="text-2xl">🚚</div>
            <div>
              <div className="text-2xl font-medium text-white">{ev.title}</div>
              <div className="text-zinc-400 text-sm">{ev.transport_type || 'transport'} {ev.plate ? `• ${ev.plate}` : ''}</div>
            </div>
          </div>
        </div>
      ))}
      {(!data || data.length===0) && <div className="text-zinc-400 text-2xl">No logistics in the next 7 days</div>}
    </div>
  </PanelContainer>
);

const AlienLogisticsPanel: React.FC<{ data: LogisticsItem[] | null }>=({ data })=> (
  <AlienShell title="LOGISTICS - PROXIMITY SCAN" kind="tracker">
    <div className="space-y-2">
      {(data ?? []).map(ev => (
        <div key={ev.id} className="border border-[var(--alien-border-dim)] p-2 flex items-center justify-between text-amber-200 text-xs">
          <div className="flex items-center gap-3">
            <div className="font-mono tabular-nums">{ev.date} {ev.time?.slice(0,5)}</div>
            <div className="uppercase text-amber-100">{ev.title}</div>
          </div>
          <div className="text-amber-300">{ev.transport_type || 'transport'} {ev.plate ? `• ${ev.plate}` : ''}</div>
        </div>
      ))}
      {(!data || data.length===0) && <div className="text-amber-300">NO LOGISTICS IN WINDOW</div>}
    </div>
  </AlienShell>
);
