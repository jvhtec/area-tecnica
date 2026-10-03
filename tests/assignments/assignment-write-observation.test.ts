import { describe,expect,it,vi } from 'vitest';
import { observeLocalAssignmentWrites } from './helpers/observeLocalAssignmentWrites';
describe('local assignment transport evidence',()=>{
  it('returns the original response without recording headers, tokens or unrelated fields',async()=>{
    const response=new Response(null,{status:201});const fetch=vi.fn().mockResolvedValue(response);
    const transport=observeLocalAssignmentWrites(fetch);
    const result=await transport.fetch('http://127.0.0.1:54481/rest/v1/job_assignments?token=private-token',{
      method:'POST',headers:{Authorization:'private-header'},body:JSON.stringify({job_id:'owned-job',phone:'private-phone'})});
    expect(result).toBe(response);
    expect(transport.events).toEqual([{kind:'dispatch',path:'/rest/v1/job_assignments',jobId:'owned-job',date:undefined},
      {kind:'complete',path:'/rest/v1/job_assignments',jobId:'owned-job',date:undefined,status:201}]);
    expect(JSON.stringify(transport.events)).not.toContain('private-');
  });
  it('observes overlapping dispatches rather than assuming completion order',async()=>{
    let complete!:(response:Response)=>void;
    const first=new Promise<Response>(resolve=>{complete=resolve;});
    const fetch=vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce(new Response(null,{status:400}));
    const transport=observeLocalAssignmentWrites(fetch);
    const a=transport.fetch('http://127.0.0.1:54481/rest/v1/rpc/toggle_timesheet_day',{method:'POST',body:JSON.stringify({p_job_id:'job',p_date:'2027-10-20'})});
    await transport.fetch('http://127.0.0.1:54481/rest/v1/rpc/toggle_timesheet_day',{method:'POST',body:JSON.stringify({p_job_id:'job',p_date:'2027-10-22'})});
    complete(new Response(null,{status:200}));await a;
    expect(transport.events.map(({kind,date})=>[kind,date])).toEqual([
      ['dispatch','2027-10-20'],['dispatch','2027-10-22'],['complete','2027-10-22'],['complete','2027-10-20']]);
  });
});
