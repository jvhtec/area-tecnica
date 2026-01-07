import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { AnnouncementLevel } from '@/constants/announcementLevels';
import SplashScreen from '@/components/SplashScreen';
import { WallboardApi, WallboardApiError } from '@/lib/wallboard-api';
import { useLgScreensaverBlock } from '@/hooks/useLgScreensaverBlock';
import { WakeLockVideo } from '@/components/WakeLockVideo';

import { buildCalendarFromJobsList, formatDateKey, MS_PER_DAY } from './calendar';
import {
  DEFAULT_HIGHLIGHT_TTL_SECONDS,
  DEFAULT_PANEL_DURATIONS,
  DEFAULT_PANEL_ORDER,
  DEFAULT_ROTATION_FALLBACK_SECONDS,
  DEFAULT_TICKER_SECONDS,
} from './config';
import { useWallboardPreset } from './hooks/useWallboardPreset';
import type {
  CalendarFeed,
  CrewAssignmentsFeed,
  Dept,
  DocProgressFeed,
  JobsOverviewFeed,
  JobsOverviewJob,
  LogisticsItem,
  PanelKey,
  PendingActionsFeed,
  TickerMessage,
  TimesheetStatus,
} from './types';
import { Ticker } from './components/Ticker';
import { FooterLogo } from './components/FooterLogo';
import { CalendarPanel } from './components/panels/CalendarPanel';
import { CrewAssignmentsPanel } from './components/panels/CrewAssignmentsPanel';
import { JobsOverviewPanel } from './components/panels/JobsOverviewPanel';
import { LogisticsPanel } from './components/panels/LogisticsPanel';
import { PendingActionsPanel } from './components/panels/PendingActionsPanel';
import {
  AlienCalendarPanel,
  AlienCrewPanel,
  AlienJobsPanel,
  AlienLogisticsPanel,
  AlienPendingPanel,
} from './components/alien/AlienPanels';

export function WallboardDisplay({
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

  useWallboardPreset({
    effectiveSlug,
    isApiMode,
    isProduccionPreset,
    wallboardApiToken,
    setPanelOrder,
    setPanelDurations,
    setRotationFallbackSeconds,
    setHighlightTtlMs,
    setTickerIntervalMs,
    setPresetMessage,
    setHighlightJobs,
    setIdx,
  });

  const processAnnouncements = useCallback(
    (rows: Array<{ id?: string; message?: string | null; level?: string | null; created_at?: string | null }>) => {
      const regex = /^\s*\[HIGHLIGHT_JOB:([a-f0-9\-]+)\]\s*/i;
      const now = Date.now();
      const ttl = Math.max(1000, highlightTtlMs);
      const staleIds: string[] = [];
      const messages: TickerMessage[] = [];

      setHighlightJobs((prev) => {
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
    },
    [highlightTtlMs]
  );

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
        setPanelPages((prev) => ({ ...prev, [currentPanel]: currentPage + 1 }));
      } else {
        // Reset page and move to next panel
        setPanelPages((prev) => ({ ...prev, [currentPanel]: 0 }));
        setIdx((current) => {
          const total = activePanels.length;
          if (total <= 0) return 0;
          return (current + 1) % total;
        });
      }
    }, durationMs);
    return () => clearTimeout(timer);
  }, [idx, panelOrder, panelDurations, rotationFallbackSeconds, panelPages, overview, crew, logistics]);

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
      const calendarRange = `[${calendarStartISO},${calendarEndISO}]`;
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
        .in('job_type', ['single', 'festival', 'tourdate', 'dryhire', 'evento'])
        .in('status', ['Confirmado', 'Tentativa', 'Completado'])
        .filter('time_range', 'ov', calendarRange)
        .order('start_time', { ascending: true });
      if (jobsError)
        console.error('Wallboard jobs query error:', jobsError?.message || jobsError, { calendarStartISO, calendarEndISO });
      let jobArr = jobs || [];

      // Exclude jobs whose parent tour is cancelled (some entries may still be Confirmado)
      const tourIds = Array.from(new Set(jobArr.map((j: any) => j.tour_id).filter(Boolean)));
      if (tourIds.length) {
        const { data: toursMeta, error: toursErr } = await supabase.from('tours').select('id,status').in('id', tourIds);
        if (toursErr) {
          console.warn('Wallboard tours meta error:', toursErr);
        } else if (toursMeta && toursMeta.length) {
          const cancelledTours = new Set((toursMeta as any[]).filter((t) => t.status === 'cancelled').map((t) => t.id));
          if (cancelledTours.size) {
            jobArr = jobArr.filter((j: any) => !j.tour_id || !cancelledTours.has(j.tour_id));
          }
        }
      }
      const jobIds = jobArr.map((j) => j.id);
      const detailJobSet = new Set(jobArr.filter(jobOverlapsWeek).map((j: any) => j.id));
      const detailJobIds = Array.from(detailJobSet);
      const dryhireIds = new Set<string>(jobArr.filter((j: any) => j.job_type === 'dryhire').map((j: any) => j.id));
      const locationIds = Array.from(new Set(jobArr.map((j: any) => j.location_id).filter(Boolean)));

      // 2) Fetch departments for these jobs
      const { data: deptRows, error: deptErr } = jobIds.length
        ? await supabase.from('job_departments').select('job_id,department').in('job_id', jobIds)
        : ({ data: [], error: null } as any);
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
        : ({ data: [], error: null } as any);
      if (assignErr) console.error('Wallboard job_assignments error:', assignErr);
      const assignsByJob = new Map<string, any[]>();
      (assignRows || []).forEach((a: any) => {
        const list = assignsByJob.get(a.job_id) ?? [];
        list.push(a);
        assignsByJob.set(a.job_id, list);
      });

      // Fetch required-role summaries for these jobs
      const { data: reqRows, error: reqErr } = detailJobIds.length
        ? await supabase.from('job_required_roles_summary').select('job_id, department, total_required').in('job_id', detailJobIds)
        : ({ data: [], error: null } as any);
      if (reqErr) console.error('Wallboard job_required_roles_summary error:', reqErr);
      const needByJobDept = new Map<string, number>();
      (reqRows || []).forEach((r: any) => {
        needByJobDept.set(`${r.job_id}:${r.department}`, Number(r.total_required || 0));
      });

      // 4) Fetch locations for names
      const { data: locRows, error: locErr } = locationIds.length
        ? await supabase.from('locations').select('id,name').in('id', locationIds)
        : ({ data: [], error: null } as any);
      if (locErr) console.error('Wallboard locations error:', locErr);
      const locById = new Map<string, string>();
      (locRows || []).forEach((l: any) => locById.set(l.id, l.name));

      // Timesheet statuses via view
      const tsByJobTech = new Map<string, Map<string, string>>();
      if (detailJobIds.length) {
        const { data: ts } = await supabase.from('wallboard_timesheet_status').select('job_id, technician_id, status').in('job_id', detailJobIds);
        ts?.forEach((row) => {
          const m = tsByJobTech.get(row.job_id) ?? new Map();
          m.set(row.technician_id, row.status as string);
          tsByJobTech.set(row.job_id, m);
        });
      }

      // Doc counts and requirements
      const [{ data: counts }, { data: reqs }] = await Promise.all([
        detailJobIds.length ? supabase.from('wallboard_doc_counts').select('job_id,department,have').in('job_id', detailJobIds) : Promise.resolve({ data: [] as any }),
        supabase.from('wallboard_doc_requirements').select('department,need'),
      ]);

      const needByDept = new Map<string, number>((reqs || []).map((r) => [r.department, r.need]));
      const haveByJobDept = new Map<string, number>();
      (counts || []).forEach((c: any) => haveByJobDept.set(`${c.job_id}:${c.department}`, c.have));

      const mapJob = (j: any): JobsOverviewJob => {
        const deptsAll: Dept[] = (deptsByJob.get(j.id) ?? []) as Dept[];
        const depts: Dept[] = deptsAll.filter((d) => d !== 'video');
        const crewAssigned: Record<string, number> = { sound: 0, lights: 0, video: 0 };
        const assignmentRows = detailJobSet.has(j.id) ? assignsByJob.get(j.id) ?? [] : [];
        assignmentRows.forEach((a: any) => {
          if (a.sound_role) crewAssigned.sound++;
          if (a.lights_role) crewAssigned.lights++;
          if (a.video_role) crewAssigned.video++;
        });
        const crewNeeded: Record<string, number> = { sound: 0, lights: 0, video: 0 };
        depts.forEach((d) => {
          crewNeeded[d] = detailJobSet.has(j.id) ? needByJobDept.get(`${j.id}:${d}`) || 0 : 0;
        });
        let status: 'green' | 'yellow' | 'red';
        if (detailJobSet.has(j.id)) {
          const hasReq = depts.some((d) => (crewNeeded[d] || 0) > 0);
          if (hasReq) {
            const perDept = depts.map((d) => {
              const need = crewNeeded[d] || 0;
              const have = crewAssigned[d] || 0;
              if (need <= 0) return 1;
              if (have >= need) return 1;
              if (have > 0) return 0.5;
              return 0;
            });
            const minCov = Math.min(...perDept);
            status = minCov >= 1 ? 'green' : minCov > 0 ? 'yellow' : 'red';
          } else {
            const present = depts.map((d) => crewAssigned[d]);
            const hasAny = present.some((n) => n > 0);
            const allHave = depts.length > 0 && present.every((n) => n > 0);
            status = allHave ? 'green' : hasAny ? 'yellow' : 'red';
          }
        } else {
          status = j.status === 'Confirmado' ? 'green' : 'yellow';
        }
        const docs: Record<string, { have: number; need: number }> = {};
        depts.forEach((d) => {
          const have = detailJobSet.has(j.id) ? haveByJobDept.get(`${j.id}:${d}`) ?? 0 : 0;
          const need = needByDept.get(d) ?? 0;
          docs[d] = { have, need };
        });
        return {
          id: j.id,
          title: j.title,
          start_time: j.start_time,
          end_time: j.end_time,
          location: { name: j.location_id ? locById.get(j.location_id) ?? null : null },
          departments: depts,
          crewAssigned: { ...crewAssigned, total: crewAssigned.sound + crewAssigned.lights + crewAssigned.video },
          crewNeeded: { ...crewNeeded, total: crewNeeded.sound + crewNeeded.lights + crewNeeded.video },
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
      calendarJobs.forEach((job) => {
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
          }),
      } as any;

      // Fill names in one request
      const techIds = Array.from(new Set(crewPayload.jobs.flatMap((j) => j.crew.map((c: any) => c.technician_id))));
      if (techIds.length) {
        const { data: profs } = await supabase.from('wallboard_profiles').select('id,first_name,last_name,department').in('id', techIds);
        const byId = new Map<string, any>((profs || []).map((p) => [p.id, p]));
        crewPayload.jobs.forEach((j) => {
          j.crew.forEach((c: any) => {
            const p = byId.get(c.technician_id);
            c.name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '';
            const s = tsByJobTech.get(j.id)?.get(c.technician_id) as any;
            const inPast = new Date(jobArr.find((x) => x.id === j.id)?.end_time || Date.now()) < new Date();
            const normalizedStatus = s === 'rejected' ? 'rejected' : s;
            c.timesheetStatus = inPast && normalizedStatus === 'approved' ? 'approved' : normalizedStatus || 'missing';
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
                missing: [],
              })),
            };
          }),
      };

      // Pending actions
      const items: PendingActionsFeed['items'] = [];
      overviewPayload.jobs.forEach((j) => {
        if (dryhireIds.has(j.id)) return; // skip dryhire for pending
        // Under-staffed alerts based on requirements where present (sound/lights only)
        j.departments
          .filter((d) => d !== 'video')
          .forEach((d: Dept) => {
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
          const missingCount = techList.filter((tid) => {
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
          ? (e.logistics_event_departments as any[]).map((dep) => dep?.department).filter(Boolean)
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
          color: e.color ?? null,
        };
      });
      // Filter to only show logistics items that have been explicitly configured
      // (removed auto-generation of dry-hire pickup/return events to prevent showing unconfigured logistics)
      const logisticsItems: LogisticsItem[] = logisticsItemsBase.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tours' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_departments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_documents' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timesheets' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_events' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_event_departments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, scheduleRefresh)
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tours' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_departments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_documents' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timesheets' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_events' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_event_departments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, scheduleRefresh)
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
          await supabase.from('announcements').update({ active: false }).in('id', staleIds);
        } catch (e) {
          // ignore cleanup errors to avoid UI disruption
        }
      }
    };
    fetchAnns();
    const interval = Math.max(5000, tickerIntervalMs);
    const id = setInterval(fetchAnns, interval); // ticker polling
    return () => {
      cancelled = true;
      clearInterval(id);
    };
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
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [wallboardApiToken, tickerIntervalMs, processAnnouncements, onFatalError]);

  // Periodic cleanup of expired highlights
  useEffect(() => {
    const id = setInterval(() => {
      setHighlightJobs((prev) => {
        const now = Date.now();
        const next = new Map(prev);
        let changed = false;
        for (const [jid, exp] of next) {
          if (exp < now) {
            next.delete(jid);
            changed = true;
          }
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
    <div
      className={`min-h-screen ${
        isAlien
          ? 'bg-black text-[var(--alien-amber)] alien-scanlines alien-vignette'
          : theme === 'light'
            ? 'bg-zinc-100 text-zinc-900'
            : 'bg-black text-white'
      }`}
    >
      {presetMessage && (
        <div className="bg-amber-500/20 text-amber-200 text-sm text-center py-2">{presetMessage}</div>
      )}
      <div className="overflow-hidden" style={{ height: `calc(100vh - ${footerH + tickerH}px)` }}>
        {/* Subtract measured ticker + footer height */}
        {current === 'overview' &&
          (isAlien ? (
            <AlienJobsPanel data={overview} highlightIds={new Set(highlightJobs.keys())} />
          ) : (
            <JobsOverviewPanel data={overview} highlightIds={new Set(highlightJobs.keys())} page={panelPages.overview} theme={theme} />
          ))}
        {current === 'crew' &&
          (isAlien ? <AlienCrewPanel data={crew} /> : <CrewAssignmentsPanel data={crew} page={panelPages.crew} theme={theme} />)}
        {current === 'logistics' &&
          (isAlien ? <AlienLogisticsPanel data={logistics} /> : <LogisticsPanel data={logistics} page={panelPages.logistics} theme={theme} />)}
        {current === 'pending' &&
          (isAlien ? <AlienPendingPanel data={pending} /> : <PendingActionsPanel data={pending} theme={theme} />)}
        {current === 'calendar' &&
          (isAlien ? (
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
      <FooterLogo onToggle={() => setIsAlien((v) => !v)} onMeasure={setFooterH} theme={theme} />
      <WakeLockVideo />
    </div>
  );
}

