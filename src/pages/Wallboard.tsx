import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRoleGuard } from '@/hooks/useRoleGuard';

type Dept = 'sound' | 'lights' | 'video';

interface JobsOverviewFeed { jobs: Array<{ id:string; title:string; start_time:string; end_time:string; location:{ name:string|null }|null; departments: Dept[]; crewAssigned: Record<string, number>; crewNeeded: Record<string, number>; docs: Record<string, { have:number; need:number }>; status: 'green'|'yellow'|'red'; }> }
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
                <span className="tabular-nums">{j.crewAssigned[d] || 0}/?</span>
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

const Ticker: React.FC<{ messages: string[]; bottomOffset?: number }>=({ messages, bottomOffset = 0 })=> {
  const [posX, setPosX] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const gap = 64; // px spacing between repeats
  const text = (messages || []).join('   •   ');

  // Start from the right edge whenever content changes
  useEffect(() => {
    const cw = containerRef.current?.offsetWidth || 0;
    setPosX(cw);
  }, [text]);

  // Smooth, endless loop: track translateX decreases; wrap by one copy width
  useEffect(() => {
    if (!text) return;
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
  }, [text]);

  return (
    <div ref={containerRef} className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 border-t border-zinc-800 py-2 text-xl overflow-hidden" style={{ bottom: bottomOffset }}>
      {text ? (
        <div className="whitespace-nowrap will-change-transform" style={{ transform: `translateX(${posX}px)` }}>
          <span ref={textRef} className="inline-block">{text}</span>
          <span className="inline-block" style={{ paddingLeft: gap }}>{text}</span>
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

type PanelKey = 'overview'|'crew'|'docs'|'pending'|'logistics';

export default function Wallboard() {
  useRoleGuard(['admin','management','wallboard']);
  const [isAlien, setIsAlien] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Rotate panels every 12s (overview, crew, docs, pending)
  const panels: PanelKey[] = ['overview','crew','docs','logistics','pending'];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i+1)%panels.length), 12000);
    return () => clearInterval(id);
  }, []);

  // Data polling (client-side via RLS-safe views)
  const [overview, setOverview] = useState<JobsOverviewFeed|null>(null);
  const [crew, setCrew] = useState<CrewAssignmentsFeed|null>(null);
  const [docs, setDocs] = useState<DocProgressFeed|null>(null);
  const [pending, setPending] = useState<PendingActionsFeed|null>(null);
  const [logistics, setLogistics] = useState<LogisticsItem[]|null>(null);
  const [tickerMsgs, setTickerMsgs] = useState<string[]>([]);
  const [highlightJobs, setHighlightJobs] = useState<Map<string, number>>(new Map());
  const [footerH, setFooterH] = useState<number>(72);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // Look-ahead window: next 7 days (including today)
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()+6, 23,59,59,999);
      const startISO = todayStart.toISOString();
      const endISO = weekEnd.toISOString();

      // 1) Fetch jobs (base fields only)
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id,title,start_time,end_time,status,location_id,job_type,tour_id')
        .in('job_type', ['single','festival','tourdate','dryhire'])
        .in('status', ['Confirmado','Tentativa'])
        .lte('start_time', endISO)
        .gte('end_time', startISO)
        .order('start_time', { ascending: true });
      if (jobsError) console.error('Wallboard jobs query error:', jobsError?.message || jobsError, { startISO, endISO });
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

      // 3) Fetch assignments for crew counts
      const { data: assignRows, error: assignErr } = jobIds.length
        ? await supabase.from('job_assignments').select('job_id,technician_id,sound_role,lights_role,video_role').in('job_id', jobIds)
        : { data: [], error: null } as any;
      if (assignErr) console.error('Wallboard job_assignments error:', assignErr);
      const assignsByJob = new Map<string, any[]>();
      (assignRows||[]).forEach((a:any)=>{
        const list = assignsByJob.get(a.job_id) ?? [];
        list.push(a);
        assignsByJob.set(a.job_id, list);
      });

      // 4) Fetch locations for names
      const { data: locRows, error: locErr } = locationIds.length
        ? await supabase.from('locations').select('id,name').in('id', locationIds)
        : { data: [], error: null } as any;
      if (locErr) console.error('Wallboard locations error:', locErr);
      const locById = new Map<string, string>();
      (locRows||[]).forEach((l:any)=> locById.set(l.id, l.name));

      // Timesheet statuses via view
      let tsByJobTech = new Map<string, Map<string,string>>();
      if (jobIds.length) {
        const { data: ts } = await supabase
          .from('wallboard_timesheet_status')
          .select('job_id, technician_id, status')
          .in('job_id', jobIds);
        ts?.forEach(row => {
          const m = tsByJobTech.get(row.job_id) ?? new Map();
          m.set(row.technician_id, row.status as string);
          tsByJobTech.set(row.job_id, m);
        });
      }

      // Doc counts and requirements
      const [{ data: counts }, { data: reqs }] = await Promise.all([
        jobIds.length ? supabase.from('wallboard_doc_counts').select('job_id,department,have').in('job_id', jobIds) : Promise.resolve({ data: [] as any }),
        supabase.from('wallboard_doc_requirements').select('department,need')
      ]);

      const needByDept = new Map<string, number>((reqs||[]).map(r=>[r.department, r.need]));
      const haveByJobDept = new Map<string, number>();
      (counts||[]).forEach((c:any)=> haveByJobDept.set(`${c.job_id}:${c.department}`, c.have));

      // Build overview
      const overviewPayload: JobsOverviewFeed = {
        jobs: jobArr
          // Hide dryhire from overview to avoid one-off items only visible here
          .filter((j:any)=> !dryhireIds.has(j.id))
          .map((j:any)=>{
          // Hide Video in crew context
          const deptsAll: Dept[] = (deptsByJob.get(j.id) ?? []) as Dept[];
          const depts: Dept[] = deptsAll.filter(d => d !== 'video');
          const crewAssigned: any = { sound:0, lights:0, video:0 };
          (assignsByJob.get(j.id) ?? []).forEach((a:any)=>{
            if (a.sound_role) crewAssigned.sound++;
            if (a.lights_role) crewAssigned.lights++;
            if (a.video_role) crewAssigned.video++;
          });
          const present = depts.map(d=>crewAssigned[d]);
          const hasAny = present.some(n=>n>0);
          const allHave = depts.length>0 && present.every(n=>n>0);
          const status: 'green'|'yellow'|'red' = allHave ? 'green' : hasAny ? 'yellow' : 'red';
          const docs: any = {};
          depts.forEach(d=>{
            const have = haveByJobDept.get(`${j.id}:${d}`) ?? 0;
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
            crewNeeded: { sound: 0, lights: 0, video: 0, total: 0 },
            docs,
            status,
          };
        })
      };

      // Crew assignments
      const assignedTechsByJob = new Map<string, string[]>();
      const crewPayload: CrewAssignmentsFeed = {
        jobs: jobArr.filter((j:any)=>!dryhireIds.has(j.id)).map((j:any)=>{
          const crew = (assignsByJob.get(j.id) ?? [])
            // Hide video crew
            .filter((a:any)=> a.video_role == null)
            .map((a:any)=>{
            const dept: Dept | null = a.sound_role ? 'sound' : a.lights_role ? 'lights' : null;
            const role = a.sound_role || a.lights_role || 'assigned';
            // collect tech ids per job
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
            c.timesheetStatus = inPast && s==='approved' ? 'approved' : (s || 'missing');
            delete c.technician_id;
          });
        });
      }

      // Doc progress
      const docPayload: DocProgressFeed = {
        jobs: jobArr
          .filter((j:any)=> !dryhireIds.has(j.id))
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
        // Only consider sound/lights for crew checks
        j.departments.filter((d)=> d!=='video').forEach((d:Dept)=>{
          if ((j.crewAssigned as any)[d] === 0) items.push({ severity: 'yellow', text: `${j.title} – missing crew (${d})`});
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
        setCrew(crewPayload);
        setDocs(docPayload);
        setPending({ items });
      }

      // 5) Logistics calendar (next 7 days)
      const startDate = startISO.slice(0,10);
      const endDate = endISO.slice(0,10);
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
      let titlesByJob = new Map<string,string>();
      if (evtJobIds.length) {
        const { data: trows } = await supabase.from('jobs').select('id,title').in('id', evtJobIds);
        (trows||[]).forEach((r:any)=> titlesByJob.set(r.id, r.title));
      }
      const logisticsItems: LogisticsItem[] = evts.map((e:any)=>({
        id: e.id,
        date: e.event_date,
        time: e.event_time,
        title: e.title || titlesByJob.get(e.job_id) || 'Logistics',
        transport_type: e.transport_type ?? null,
        plate: e.license_plate ?? null,
        job_title: titlesByJob.get(e.job_id) || null,
      }));
      if (!cancelled) setLogistics(logisticsItems);
    };
    fetchAll();
    const id = setInterval(fetchAll, 60000); // 60s polling
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Load current user's role for cleanup permissions
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        setUserRole(prof?.role ?? null);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchAnns = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, message, active, created_at')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!cancelled) {
        const regex = /^\s*\[HIGHLIGHT_JOB:([a-f0-9\-]+)\]\s*/i;
        const messages: string[] = [];
        const now = Date.now();
        const updated = new Map(highlightJobs);
        const HIGHLIGHT_TTL_MS = 2 * 60 * 1000; // 2 minutes
        const staleIds: string[] = [];
        (data||[]).forEach((a:any) => {
          let m = a.message || '';
          const match = m.match(regex);
          if (match) {
            const jobId = match[1];
            const created = a.created_at ? new Date(a.created_at).getTime() : now;
            const expireAt = created + HIGHLIGHT_TTL_MS;
            if (expireAt > now) {
              updated.set(jobId, expireAt);
            } else if (a.id) {
              staleIds.push(a.id);
            }
            m = m.replace(regex, '');
          }
          // Include ticker message only if not a highlight directive or still within TTL
          if (m.trim()) {
            const created = a.created_at ? new Date(a.created_at).getTime() : now;
            const expireAt = created + HIGHLIGHT_TTL_MS;
            const isHighlight = !!match;
            if (!isHighlight || expireAt > now) {
              messages.push(m.trim());
            }
          }
        });
        // Drop expired
        for (const [jid, exp] of updated) {
          if (exp < now) updated.delete(jid);
        }
        setHighlightJobs(updated);
        setTickerMsgs(messages);

        // Best-effort cleanup of stale highlight announcements (DB flip to inactive)
        if (staleIds.length && (userRole === 'admin' || userRole === 'management')) {
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
    const id = setInterval(fetchAnns, 20000); // 20s ticker polling
    return () => { cancelled = true; clearInterval(id); };
  }, []);

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

  const current = panels[idx];
  return (
    <div className={`min-h-screen ${isAlien ? 'bg-black text-[var(--alien-amber)] alien-scanlines alien-vignette' : 'bg-black text-white'}`}>
      <div className="pb-28">{/* space for ticker + footer */}
        {current==='overview' && (isAlien ? <AlienJobsPanel data={overview} highlightIds={new Set(highlightJobs.keys())} /> : <JobsOverviewPanel data={overview} highlightIds={new Set(highlightJobs.keys())} />)}
        {current==='crew' && (isAlien ? <AlienCrewPanel data={crew} /> : <CrewAssignmentsPanel data={crew} />)}
        {current==='docs' && (isAlien ? <AlienDocsPanel data={docs} /> : <DocProgressPanel data={docs} />)}
        {current==='logistics' && (isAlien ? <AlienLogisticsPanel data={logistics} /> : <LogisticsPanel data={logistics} />)}
        {current==='pending' && (isAlien ? <AlienPendingPanel data={pending} /> : <PendingActionsPanel data={pending} />)}
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
