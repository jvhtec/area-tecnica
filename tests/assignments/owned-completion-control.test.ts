import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { ownedCompletionHarness } from './helpers/ownedCompletionControl';

const s=vi.hoisted(()=>({commands:[] as string[][],journals:[] as Record<string,unknown>[],pending:false,uncertain:false,
 late:false,expireAt:'',failAt:'',present:false,bytes:'',beforeDelete:undefined as undefined|((marker:string,fresh:()=>void)=>Promise<void>),
 deleted:false,calls:[] as string[],sdkFetch:undefined as undefined|typeof globalThis.fetch}));
const identity='owned-control-unit';
const job='11111111-1111-4111-8111-111111111111';
const manager='22222222-2222-4222-8222-222222222222';
const tech='33333333-3333-4333-8333-333333333333';
const campaign='44444444-4444-4444-8444-444444444444';
vi.mock('node:fs',()=>({statSync:()=>({isDirectory:()=>true}),writeFileSync:(_path:string,body:string)=>{
 const record=JSON.parse(body);s.journals.push(record);if(record.status===s.expireAt)s.late=true;
}}));
vi.mock('./helpers/disposableCampaignTarget',()=>({verifyDisposableCampaignTarget:()=>undefined,readDisposableCampaignTarget:()=>undefined}));
vi.mock('node:crypto',async importOriginal=>{
 const original=await importOriginal<typeof import('node:crypto')>();
 return {...original,createHash:()=>({update:(value:string)=>({digest:()=>value==='adapter'
  ?'09aa701aab1b37b4f35bcff281081de4b4de88e641685e354c7eb0bc05642ab7'
  :'870e27d602a5f74ff4e952d077bea5ee616ee5dc692a8b68fa1301615debebde'})})};
});
vi.mock('node:child_process',()=>({spawnSync:vi.fn(),execFileSync:(_binary:string,args:string[],options?:{input?:string})=>{
 s.commands.push(args);
 if(args[0]==='run') {if(s.failAt==='run')throw new Error('Uncertain Docker create');return 'created';}
 if(args[0]==='rm') {if(s.failAt==='rm')throw new Error('Uncertain helper retirement');return 'removed';}
 if(args[0]==='inspect')return JSON.stringify([{Config:{Labels:{'local.matrix-fault':identity}},HostConfig:{NetworkMode:'none'},
  Mounts:args[1]==='unit-edge'?[
   {Type:'volume',Name:identity+'-code',Destination:'/local',RW:false},
   {Type:'volume',Name:identity+'-src',Destination:'/src',RW:false},
  ]:[{Type:'volume',Name:identity+'-code',Destination:'/local',RW:true}]}]);
 if(args.includes('python')) {
  if(s.failAt==='python')throw new Error('Unknown write result');
  const code=args.at(-1)!;
  if(code.includes('O_EXCL')){s.present=true;s.bytes=options?.input??'';return '';}
  s.present=false;return 'absent\n';
 }
 if(args.includes('sh'))return s.present?'present\n':'absent\n';
 if(args.at(-1)==='/local/_wave_control.json')return s.bytes;
 if(args.at(-1)==='/local/capture.py')return 'capture';
 return 'adapter';
}}));
vi.mock('./helpers/campaignHarnessCore',()=>({campaignHarnessCore:(_extra:unknown,options:{beforeJobDelete:typeof s.beforeDelete;wrapFetch:(fetch:typeof globalThis.fetch)=>typeof globalThis.fetch})=>{
 s.beforeDelete=options.beforeJobDelete;
 s.sdkFetch=options.wrapFetch(async()=>{s.calls.push('SDK transport');return new Response(null,{status:200});});
 const fresh=()=>{if(s.late)throw new Error('Fence expired');};
 const safe=()=>{if(s.uncertain||s.pending)throw new Error('Transport uncertain/pending');};
 const fence=async(action:(check:()=>void)=>Promise<unknown>)=>{
  safe();s.pending=true;try{return await action(fresh);}finally{s.pending=false;}
 };
 const rows={select:()=>({eq:()=>({single:async()=>({error:null,data:{id:job,title:'unit-marker'}}),
  then:(resolve:(value:unknown)=>unknown)=>resolve({error:null,data:[{id:campaign,created_by:manager,department:'sound',status:'active'}]})})})};
 return {marker:'unit-marker',target:{identity,edge:'unit-edge',capture:'unit-capture',volumes:[identity+'-code']},client:{from:()=>rows},
  prepare:async()=>undefined,assertCleanupSafe:safe,assertFixtureSafe:safe,ownsJob:(id:string)=>id===job,ownsUser:(id:string)=>[manager,tech].includes(id),
  withCleanupFence:fence,runGuardedMutation:async(action:()=>unknown)=>{try{return await action();}catch(error){s.uncertain=true;throw error;}},
  ...Object.fromEntries(['user','job','request','assignment','start','api','cleanUsers'].map(name=>[name,async()=>{
   if(s.uncertain)throw new Error('Transport uncertain');s.calls.push(name);
  }])),
  cleanJobs:async()=>fence(async check=>{await s.beforeDelete?.('unit-marker',check);s.deleted=true;}),
  get cleanupSafe(){return !s.uncertain&&!s.pending;}};
}}));
beforeEach(()=>{
 Object.assign(s,{commands:[],journals:[],pending:false,uncertain:false,late:false,expireAt:'',failAt:'',present:false,bytes:'',beforeDelete:undefined,deleted:false,calls:[],sdkFetch:undefined});
 vi.stubEnv('STAFFING_DISPOSABLE_MANIFEST','C:/private/unit/manifest.json');
});
afterEach(()=>vi.unstubAllEnvs());

it.each(['writer-starting','write-starting'])('known deadline refusal at %s permits fresh-fence cleanup',async expireAt=>{
 const h=ownedCompletionHarness();await h.prepare();s.expireAt=expireAt;
 await expect(h.arm(job,campaign,manager,[tech])).rejects.toThrow('Fence expired');
 expect(s.uncertain).toBe(false);expect(s.present).toBe(false);expect(h.cleanupSafe).toBe(true);
 expect(s.commands.filter(args=>args[0]==='run')).toHaveLength(expireAt==='writer-starting'?0:1);
 expect(s.commands.filter(args=>args.includes('python'))).toHaveLength(0);
 s.late=false;s.expireAt='';await h.cleanJobs();expect(s.deleted).toBe(true);
});
it('removes owned control inside pending cleanup fence before deleting fixtures',async()=>{
 const h=ownedCompletionHarness();await h.prepare();await h.arm(job,campaign,manager,[tech]);
 expect(s.present).toBe(true);await h.cleanJobs();
 expect(s.present).toBe(false);expect(s.deleted).toBe(true);expect(h.cleanupSafe).toBe(true);
});
it.each(['run','python','rm'])('uncertain %s driver result retains fixtures',async failAt=>{
 const h=ownedCompletionHarness();await h.prepare();s.failAt=failAt;
 await expect(h.arm(job,campaign,manager,[tech])).rejects.toThrow();
 expect(h.cleanupSafe).toBe(false);expect(()=>h.assertControllerSafe()).toThrow();
 await expect(h.cleanJobs()).rejects.toThrow();expect(s.deleted).toBe(false);
 for(const action of [()=>h.job(),()=>h.user(),()=>h.request(job,tech,'availability','pending'),()=>h.assignment(job,tech,'invited'),
  ()=>h.start(job,'unit-token'),()=>h.api('tick',{}),()=>h.cleanUsers(),()=>s.sdkFetch!('http://localhost.invalid')]) {
  await expect(action()).rejects.toThrow();
 }
 expect(s.calls).toEqual([]);
 if(failAt==='rm')expect(s.journals.at(-1)).toMatchObject({status:'writer-retirement-uncertain',mutationUncertain:true,activeWriter:expect.any(String)});
});
it('controller gate preserves concurrent API admission when its own state is certain',async()=>{
 const h=ownedCompletionHarness();await h.prepare();s.pending=true;
 await h.api('tick',{});expect(s.calls).toEqual(['api']);
 s.pending=false;
});
