import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRoleGuard } from '@/hooks/useRoleGuard';

type Dept = 'sound' | 'lights' | 'video';

interface JobsOverviewFeed { jobs: Array<{ id:string; title:string; start_time:string; end_time:string; location:{ name:string|null }|null; departments: Dept[]; crewAssigned: Record<string, number>; crewNeeded: Record<string, number>; docs: Record<string, { have:number; need:number }>; status: 'green'|'yellow'|'red'; }> }
interface CrewAssignmentsFeed { jobs: Array<{ id:string; title:string; crew: Array<{ name:string; role:string; dept:Dept|null; timesheetStatus:'submitted'|'draft'|'missing'|'approved'; }> }>; }
interface DocProgressFeed { jobs: Array<{ id:string; title:string; departments: Array<{ dept:Dept; have:number; need:number; missing:string[] }> }> }
interface PendingActionsFeed { items: Array<{ severity:'red'|'yellow'; text:string }> }

const PanelContainer: React.FC<{ children: React.ReactNode }>=({ children })=> (
  <div className="w-full h-full p-6 flex flex-col gap-4 bg-black text-white">
    {children}
  </div>
);

const StatusDot: React.FC<{ color: 'green'|'yellow'|'red' }>=({ color }) => (
  <span className={`inline-block w-3 h-3 rounded-full mr-2 ${color==='green'?'bg-green-500':color==='yellow'?'bg-yellow-400':'bg-red-500'}`} />
);

const JobsOverviewPanel: React.FC<{ data: JobsOverviewFeed | null }>=({ data })=> (
  <PanelContainer>
    <h1 className="text-5xl font-semibold">Jobs – Today & Tomorrow</h1>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {(data?.jobs ?? []).map(j => (
        <div key={j.id} className="rounded-lg bg-zinc-900 p-4 border border-zinc-800">
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
        <div className="text-zinc-400 text-2xl">No jobs in the next 2 days</div>
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
  const [offset, setOffset] = useState(0);
  const text = messages.join('   •   ');
  useEffect(() => {
    const id = setInterval(() => setOffset(o => (o+1)%10000), 30);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 border-t border-zinc-800 py-2 text-xl overflow-hidden" style={{ bottom: bottomOffset }}>
      <div className="whitespace-nowrap will-change-transform" style={{ transform: `translateX(-${offset}px)` }}>
        {text || '—'}
      </div>
    </div>
  );
};

const FooterLogo: React.FC = () => {
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
  return (
    <div className="fixed bottom-0 left-0 right-0 py-3 bg-black/70 border-t border-zinc-800 flex items-center justify-center z-50">
      <img
        src={src}
        alt="Company Logo"
        className="h-12 w-auto opacity-90"
        onError={() => setIdx(i => i + 1)}
      />
    </div>
  );
};

type PanelKey = 'overview'|'crew'|'docs'|'pending';

export default function Wallboard() {
  useRoleGuard(['admin','management','wallboard']);

  // Rotate panels every 12s (overview, crew, docs, pending)
  const panels: PanelKey[] = ['overview','crew','docs','pending'];
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
  const [tickerMsgs, setTickerMsgs] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 23,59,59,999);
      const startISO = todayStart.toISOString();
      const endISO = tomorrowEnd.toISOString();

      // 1) Fetch jobs (base fields only)
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id,title,start_time,end_time,status,location_id,job_type')
        .in('job_type', ['single','festival','tourdate','dryhire'])
        .in('status', ['Confirmado','Tentativa'])
        .lte('start_time', endISO)
        .gte('end_time', startISO)
        .order('start_time', { ascending: true });
      if (jobsError) console.error('Wallboard jobs query error:', jobsError?.message || jobsError, { startISO, endISO });
      const jobArr = jobs || [];
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
        jobs: jobArr.map((j:any)=>{
          const depts: Dept[] = (deptsByJob.get(j.id) ?? []) as Dept[];
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
          const crew = (assignsByJob.get(j.id) ?? []).map((a:any)=>{
            const dept: Dept | null = a.sound_role ? 'sound' : a.lights_role ? 'lights' : a.video_role ? 'video' : null;
            const role = a.sound_role || a.lights_role || a.video_role || 'assigned';
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
        jobs: overviewPayload.jobs.filter(j => !dryhireIds.has(j.id)).map(j => ({
          id: j.id,
          title: j.title,
          departments: j.departments.map((d:Dept)=>({
            dept: d,
            have: j.docs[d]?.have ?? 0,
            need: j.docs[d]?.need ?? 0,
            missing: []
          }))
        }))
      };

      // Pending actions
      const items: PendingActionsFeed['items'] = [];
      overviewPayload.jobs.forEach(j=>{
        if (dryhireIds.has(j.id)) return; // skip dryhire for pending
        j.departments.forEach((d:Dept)=>{
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
        .select('message, active')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!cancelled) setTickerMsgs((data||[]).map(a=>a.message));
    };
    fetchAnns();
    const id = setInterval(fetchAnns, 20000); // 20s ticker polling
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const current = panels[idx];
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pb-28">{/* space for ticker + footer */}
        {current==='overview' && <JobsOverviewPanel data={overview} />}
        {current==='crew' && <CrewAssignmentsPanel data={crew} />}
        {current==='docs' && <DocProgressPanel data={docs} />}
        {current==='pending' && <PendingActionsPanel data={pending} />}
      </div>
      <Ticker messages={tickerMsgs} bottomOffset={56} />
      <FooterLogo />
    </div>
  );
}
