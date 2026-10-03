import { afterAll,afterEach,beforeAll,beforeEach,describe,expect,it } from 'vitest';
import { ownedCompletionHarness } from './helpers/ownedCompletionControl';

describe.skipIf(!process.env.STAFFING_DISPOSABLE_MANIFEST)('owned completion controls on actual clone (P1.14)',()=>{
  let h:ReturnType<typeof ownedCompletionHarness>;
  let manager:Awaited<ReturnType<typeof h.user>>;
  let tech:Awaited<ReturnType<typeof h.user>>;
  let baseline:string[];let original:string[];let extended:string[];let originalExtended:string[];
  beforeAll(async()=>{
    h=ownedCompletionHarness();await h.prepare();
    baseline=h.fingerprint();original=h.historicalFingerprint();extended=h.extendedFingerprint();originalExtended=h.extendedFingerprint(true);
    h.recordBaselines({clone:baseline,history:original,cloneExtended:extended,historyExtended:originalExtended});
    manager=await h.user('management');tech=await h.user();
  },100_000);
  beforeEach(()=>{h.assertFixtureSafe();h.assertControllerSafe();});
  afterEach(async()=>{await h.cleanJobs();},100_000);
  afterAll(async()=>{
    if(!h)return;h.assertControllerSafe();
    const failures:unknown[]=[];
    for(const action of [h.cleanJobs,h.cleanUsers])try{await action();}catch(error){failures.push(error);}
    for(const check of [()=>expect(h.fingerprint()).toEqual(baseline),()=>expect(h.historicalFingerprint()).toEqual(original),
      ()=>expect(h.extendedFingerprint()).toEqual(extended),()=>expect(h.extendedFingerprint(true)).toEqual(originalExtended)]) {
      try{check();}catch(error){failures.push(error);}
    }
    if(failures.length)throw new AggregateError(failures,'Private completion cleanup/preservation failed');
  },200_000);
  for(const failure of [false,true])it(`completion push ${failure?'503 failure':'success'} preserves state, clears lock and does not replay`,async()=>{
    const jobId=await h.job();await h.assignment(jobId,tech.id,'invited');
    const started=await h.start(jobId,manager.token);
    const campaignId=started.campaign.id;
    await h.arm(jobId,campaignId,manager.id,[tech.id],failure);
    const since=new Date().toISOString();
    const result=await h.api('tick',{campaign_id:campaignId});
    expect(result.status).toBe(200);expect(result.body.tick_completed).toBe(true);
    await h.withCleanupFence(async()=>undefined);
    expect(await h.campaign(campaignId)).toMatchObject({status:'completed',run_lock:null,next_run_at:null});
    const completed=await h.campaign(campaignId);
    const captures=await h.captures(jobId);
    expect(captures).toHaveLength(2);
    expect(captures.map(item=>item.stage)).toEqual(['dispatch',failure?'controlled-response-ready':'forwarded-response']);
    expect(captures[1].status).toBe(failure?503:200);
    for(const capture of captures)expect(JSON.parse(capture.body)).toEqual({
      action:'broadcast',type:'staffing.campaign.completed',job_id:jobId,campaign_id:campaignId,recipient_id:manager.id,department:'sound',
    });
    const inbox=await h.client.from('notification_inbox').select('id,user_id,event_type,meta').eq('meta->>jobId',jobId);
    expect(inbox.error).toBeNull();
    if(failure){
      expect(inbox.data).toEqual([]);
      const logs=h.logsSince(since);
      const events=[...logs.matchAll(/\{"event":"push_broadcast_(?:rejected|failed)"[^\n]*?\}/g)].map(match=>JSON.parse(match[0]));
      expect(events.filter(event=>event.eventType==='staffing.campaign.completed')).toEqual([
        {event:'push_broadcast_rejected',eventType:'staffing.campaign.completed',status:503},
      ]);
    }else{
      expect(inbox.data?.some(item=>item.user_id===manager.id)).toBe(true);
      for(const item of inbox.data??[])expect(item).toMatchObject({event_type:'staffing.campaign.completed',meta:{jobId,campaignId}});
    }
    const beforeReplay=await h.captures(jobId);
    expect(await h.api('tick',{campaign_id:campaignId})).toEqual({status:400,body:{error:'Campaign not active'}});
    await h.withCleanupFence(async()=>undefined);
    expect(await h.captures(jobId)).toEqual(beforeReplay);
    expect(await h.campaign(campaignId)).toEqual(completed);
    expect((await h.client.from('notification_inbox').select('id,user_id,event_type,meta').eq('meta->>jobId',jobId)).data).toEqual(inbox.data);
  },90_000);
});
