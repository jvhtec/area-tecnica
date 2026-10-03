import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect } from 'vitest';
import { campaignHarnessCore } from './campaignHarnessCore';
import { readDisposableCampaignTarget, verifyDisposableCampaignTarget } from './disposableCampaignTarget';

type Owned = { version:1; marker:string; job_id:string; campaign_id:string; manager_id:string; department:'sound'; profiles:string[]; fail_completion_push:boolean };
export type InternalCapture = { kind:string; stage:string; status?:number; body:string; method:string; url:string };
const remote='/local/_wave_control.json';
const docker=(...args:string[])=>execFileSync('docker',args,{encoding:'utf8',timeout:15_000,maxBuffer:64*1024*1024});

/** Opt-in clone control: only this run's registered completion fixtures. */
export function ownedCompletionHarness() {
  let owned:Owned|undefined;
  let persisted:string|undefined;
  let baselineGroups:Record<string,string[]>|undefined;
  let activeWriter:string|undefined;
  let mutationUncertain=false;
  const h=campaignHarnessCore([], {mode:'disposable',beforeJobDelete:async(_marker,assertFresh)=>{await remove(assertFresh);},
    wrapFetch:transport=>async(...args)=>{assertControlCertain();return transport(...args);}});
  const target=h.target as ReturnType<typeof readDisposableCampaignTarget>;
  const privateRoot=resolve(dirname(process.env.STAFFING_DISPOSABLE_MANIFEST!),'wave-capture-prototype');
  if(!statSync(privateRoot).isDirectory())throw new Error('Private wave instrumentation directory required');
  const journal=resolve(privateRoot,`owned-control-${randomUUID()}.json`);
  function save(status:string) {writeFileSync(journal,JSON.stringify({identity:target.identity,marker:h.marker,status,owned,mutationUncertain,activeWriter,baselineGroups},null,2));}
  function assertControlCertain() {if(mutationUncertain||activeWriter)throw new Error('Private control mutation uncertain; retain fixtures');}
  function assertControllerSafe() {assertControlCertain();h.assertCleanupSafe();}
  async function prepare() {
    await h.prepare();
    await h.withCleanupFence(async assertFresh=>{
      await verify(assertFresh);
      const spec=JSON.parse(await guardedDocker(()=>docker('inspect',target.edge)))[0];
      for(const [volume,path] of [[`${target.identity}-code`,'/local'],[`${target.identity}-src`,'/src']]) {
        expect(spec.Mounts.filter((mount:{Name:string;Destination:string})=>mount.Name===volume&&mount.Destination===path)).toEqual([
          expect.objectContaining({Type:'volume',Name:volume,Destination:path,RW:false}),
        ]);
      }
      const adapter=await guardedDocker(()=>docker('exec',target.edge,'cat','/local/outbound.ts'));
      expect(createHash('sha256').update(adapter).digest('hex')).toBe('09aa701aab1b37b4f35bcff281081de4b4de88e641685e354c7eb0bc05642ab7');
      const capture=await guardedDocker(()=>docker('exec',target.capture,'cat','/local/capture.py'));
      expect(createHash('sha256').update(capture).digest('hex')).toBe('870e27d602a5f74ff4e952d077bea5ee616ee5dc692a8b68fa1301615debebde');
      expect(await guardedDocker(()=>docker('exec',target.edge,'sh','-c',
        'if test -e /local/_wave_control.json; then echo present; else echo absent; fi'))).toBe('absent\n');
    });
  }
  async function guardedDocker<T>(operation:()=>T) {return h.runGuardedMutation(async()=>operation());}
  async function freshDocker<T>(assertFresh:()=>void,operation:()=>T) {
    const result=await guardedDocker(()=>{
      try{assertFresh();}catch(error){return {ok:false as const,error};}
      return {ok:true as const,value:operation()};
    });
    if(!result.ok)throw result.error;
    return result.value;
  }
  async function verify(assertFresh:()=>void) {
    await guardedDocker(()=>verifyDisposableCampaignTarget(target,docker));
    assertFresh();
  }
  async function writer(assertFresh:()=>void,code:string,input:string) {
    await verify(assertFresh);
    const volume=`${target.identity}-code`;
    if(!target.volumes.includes(volume))throw new Error('Unowned code volume');
    const helper=`${target.identity}-owned-control-${randomUUID().slice(0,8)}`;
    let created=false;
    let creationAttempted=false;
    let failure:{error:unknown}|undefined;
    let output='';
    try {
      assertFresh();
      activeWriter=helper;save('writer-starting');
      await freshDocker(assertFresh,()=>{
        creationAttempted=true;
        return docker('run','-d','--pull=never','--name',helper,'--network','none','--label',`local.matrix-fault=${target.identity}`,
          '-v',`${volume}:/local`,'python:3.13-slim','sleep','90');
      });
      created=true;
      const spec=JSON.parse(await guardedDocker(()=>docker('inspect',helper)))[0];
      expect(spec.Config.Labels['local.matrix-fault']).toBe(target.identity);
      expect(spec.HostConfig.NetworkMode).toBe('none');
      expect(spec.Mounts).toHaveLength(1);
      expect(spec.Mounts[0]).toMatchObject({Type:'volume',Name:volume,RW:true});
      save('write-starting');
      output=await freshDocker(assertFresh,()=>{
        mutationUncertain=true;
        return execFileSync('docker',['exec','-i',helper,'python','-c',code],{
          input,encoding:'utf8',timeout:15_000,maxBuffer:1024*1024,
        });
      });
      mutationUncertain=false;
    } catch(error) { failure={error};if(!creationAttempted)activeWriter=undefined; }
    try {
      if(created) {
        const spec=JSON.parse(docker('inspect',helper))[0];
        if(spec.Config.Labels?.['local.matrix-fault']!==target.identity)throw new Error('Refuse foreign writer removal');
        docker('rm','-f',helper);
        activeWriter=undefined;
      }
    } catch(error) {
      mutationUncertain=true;
      const errors:unknown[]=failure?[failure.error,error]:[error];
      try{save('writer-retirement-uncertain');}catch(journalError){errors.push(journalError);}
      throw new AggregateError(errors,'Owned control operation/writer retirement/journal failed; retain fixtures');
    }
    if(failure)throw failure.error;
    return output;
  }
  async function arm(jobId:string,campaignId:string,managerId:string,profiles:string[],failure=false) {
    h.assertFixtureSafe();assertControllerSafe();
    if(owned)throw new Error('Prior owned control must be retired');
    if(!h.ownsJob(jobId)||![managerId,...profiles].every(h.ownsUser)||profiles.length===0)throw new Error('Control tuple must be owned');
    for(const id of [jobId,campaignId,managerId,...profiles])if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid owned UUID');
    await h.withCleanupFence(async assertFresh=>{
      const job=await h.client.from('jobs').select('id,title').eq('id',jobId).single();
      expect(job.error).toBeNull();expect(job.data?.title).toBe(h.marker);
      const campaigns=await h.client.from('staffing_campaigns').select('id,created_by,department,status').eq('job_id',jobId);
      expect(campaigns.error).toBeNull();
      expect(campaigns.data).toEqual([{id:campaignId,created_by:managerId,department:'sound',status:'active'}]);
      await verify(assertFresh);
      expect(await guardedDocker(()=>docker('exec',target.edge,'sh','-c',
        'if test -e /local/_wave_control.json; then echo present; else echo absent; fi'))).toBe('absent\n');
      assertFresh();
      owned={version:1,marker:h.marker,job_id:jobId,campaign_id:campaignId,manager_id:managerId,department:'sound',profiles,fail_completion_push:failure};
      persisted=JSON.stringify(owned);save('prepared');
      await writer(assertFresh,
        "import os,sys; data=sys.stdin.buffer.read(); fd=os.open('/local/_wave_control.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600); f=os.fdopen(fd,'wb'); f.write(data); f.close()",persisted);
      expect(await guardedDocker(()=>docker('exec',target.edge,'cat',remote))).toBe(persisted);
      save('armed');
    });
  }
  async function remove(assertFresh:()=>void) {
    // Called inside the acknowledged pending fence, so only controller
    // uncertainty is checked here; the external entry point owns transport admission.
    if(mutationUncertain||activeWriter)throw new Error('Private control/writer uncertain; retain fixtures');
    assertFresh();
    if(!owned)return;
    if(owned.marker!==h.marker||!h.ownsJob(owned.job_id))throw new Error('Control ownership changed');
    const outcome=await writer(assertFresh,
      "import os,sys,stat,pathlib\np=pathlib.Path('/local/_wave_control.json'); expected=sys.stdin.buffer.read()\nif not os.path.lexists(p): print('absent')\nelse:\n assert stat.S_ISREG(os.lstat(p).st_mode)\n assert p.read_bytes()==expected\n p.unlink(); print('removed')",persisted!);
    expect(['absent\n','removed\n']).toContain(outcome);
    expect(await guardedDocker(()=>docker('exec',target.edge,'sh','-c',
      'if test -e /local/_wave_control.json; then echo present; else echo absent; fi'))).toBe('absent\n');
    save('retired');owned=undefined;persisted=undefined;
  }
  async function captures(jobId:string):Promise<InternalCapture[]> {
    assertControllerSafe();
    const source=await guardedDocker(()=>docker('exec',target.capture,'cat','/captures/deliveries.jsonl'));
    return source.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line) as InternalCapture)
      .filter(item=>item.kind==='internal-call'&&JSON.parse(item.body).job_id===jobId);
  }
  function logsSince(since:string) {
    assertControllerSafe();
    const result=spawnSync('docker',['logs','--since',since,target.edge],{encoding:'utf8',timeout:15_000,maxBuffer:64*1024*1024});
    if(result.error||result.status!==0)throw new Error('Private caller log read failed');
    return result.stdout+result.stderr;
  }
  const extraTables=['staffing_campaigns','staffing_campaign_roles','staffing_events'];
  function extendedFingerprint(original=false) {
    const db=original?'supabase_db_dev-history':target.database;
    return [...extraTables,'technician_fridge'].map(table=>docker('exec',db,'psql','-h','/var/run/postgresql','-XqAt','-U','postgres','-d','postgres','-c',
      `SELECT count(*)||':'||md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY t.${table==='technician_fridge'?'technician_id':'id'}),'')) FROM public.${table} t;`).trim());
  }
  function historicalFingerprint() {
    return ['jobs','staffing_requests','job_assignments','timesheets','profiles','activity_log','notification_inbox','push_delivery_attempts'].map(table=>
      docker('exec','supabase_db_dev-history','psql','-h','/var/run/postgresql','-XqAt','-U','postgres','-d','postgres','-c',
        `SELECT count(*)||':'||md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY t.id),'')) FROM public.${table} t;`).trim());
  }
  function recordBaselines(groups:Record<string,string[]>) {
    assertControllerSafe();if(owned||baselineGroups)throw new Error('Baseline must be recorded once before arming');
    baselineGroups=groups;save('baseline-recorded');
  }
  function guardedControl<Args extends unknown[],Result>(operation:(...args:Args)=>Promise<Result>) {
    return async(...args:Args):Promise<Result>=>{assertControlCertain();return operation(...args);};
  }
  const withCleanupFence:typeof h.withCleanupFence=async action=>{assertControlCertain();return h.withCleanupFence(action);};
  const runGuardedMutation:typeof h.runGuardedMutation=async action=>{assertControlCertain();return h.runGuardedMutation(action);};
  return {...h,prepare,arm,captures,logsSince,extendedFingerprint,historicalFingerprint,recordBaselines,assertControllerSafe,
    user:guardedControl(h.user),job:guardedControl(h.job),request:guardedControl(h.request),assignment:guardedControl(h.assignment),
    start:guardedControl(h.start),api:guardedControl(h.api),cleanJobs:guardedControl(h.cleanJobs),cleanUsers:guardedControl(h.cleanUsers),
    withCleanupFence,runGuardedMutation,assertCleanupSafe:assertControllerSafe,
    assertFixtureSafe:()=>{assertControlCertain();h.assertFixtureSafe();},
    get cleanupSafe(){return !mutationUncertain&&!activeWriter&&h.cleanupSafe;}};
}
