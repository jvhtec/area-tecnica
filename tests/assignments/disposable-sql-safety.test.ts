import { execFileSync } from 'node:child_process';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { disposableCampaignHarness } from './helpers/disposableCampaignHarness';
import { verifyDisposableCampaignTarget } from './helpers/disposableCampaignTarget';

vi.mock('node:child_process',()=>({execFileSync:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:vi.fn(()=>({}))}));
// This control isolates CLI uncertainty; live target/source/fence behavior is
// covered by the separate Docker admission controls and opt-in runtime cases.
vi.mock('./helpers/disposableCampaignTarget',()=>({
  readDisposableCampaignTarget:()=>({database:'matrix-fault-0123456789-db',url:'http://127.0.0.1:54481',edge:'matrix-fault-0123456789-edge'}),
  verifyDisposableCampaignTarget:vi.fn(),
}));
vi.mock('./helpers/edgeSnapshot',()=>({edgeSnapshot:()=>new Map([['staffing-orchestrator/index.ts','handler']])}));
vi.mock('./helpers/withLocalRuntimeFence',()=>({withLocalRuntimeFence:(_runtime:unknown,action:(check:()=>void)=>Promise<unknown>)=>{
  const deadline=performance.now()+45_000;
  return action(()=>{if(performance.now()>=deadline)throw new Error('Owned cleanup deadline exceeded');});
}}));

beforeEach(()=>{vi.mocked(verifyDisposableCampaignTarget).mockReset();});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
it('a failed Docker SQL driver independently blocks cleanup and new fixtures',async()=>{
  const jwt=(role:string)=>`header.${Buffer.from(JSON.stringify({iss:'supabase-demo',role})).toString('base64url')}.signature`;
  vi.stubEnv('STAFFING_EDGE_TEST_URL','http://127.0.0.1:54481');
  vi.stubEnv('STAFFING_EDGE_TEST_ANON_KEY',jwt('anon'));vi.stubEnv('STAFFING_EDGE_TEST_SERVICE_KEY',jwt('service_role'));
  vi.mocked(execFileSync).mockImplementation((_command,args)=>{
    const parts=args as string[];
    if(parts.includes('sh'))return '/local/functions/staffing-orchestrator/index.ts\0handler\0';
    throw new Error('SQL driver interrupted before proving remote completion');
  });
  const h=disposableCampaignHarness();
  await expect(h.prepare()).rejects.toThrow('SQL driver interrupted');
  expect(h.cleanupSafe).toBe(false);
  await expect(h.job()).rejects.toThrow('Owned fixtures retained');
  await expect(h.user()).rejects.toThrow('Owned fixtures retained');
  await expect(h.cleanJobs()).rejects.toThrow('Owned fixtures retained');
  await expect(h.cleanUsers()).rejects.toThrow('Owned fixtures retained');
});

it('target inspection exhausting the fence refuses SQL, then permits a fresh retry',async()=>{
  const jwt=(role:string)=>`header.${Buffer.from(JSON.stringify({iss:'supabase-demo',role})).toString('base64url')}.signature`;
  vi.stubEnv('STAFFING_EDGE_TEST_URL','http://127.0.0.1:54481');
  vi.stubEnv('STAFFING_EDGE_TEST_ANON_KEY',jwt('anon'));vi.stubEnv('STAFFING_EDGE_TEST_SERVICE_KEY',jwt('service_role'));
  let clock=0;
  vi.spyOn(performance,'now').mockImplementation(()=>clock);
  let sqlCalls=0;
  vi.mocked(execFileSync).mockImplementation((_command,args)=>{
    const parts=args as string[];
    if(parts.includes('sh'))return '/local/functions/staffing-orchestrator/index.ts\0handler\0';
    if(parts.includes('psql')){sqlCalls++;return '0';}
    throw new Error('Unexpected command');
  });
  const h=disposableCampaignHarness();
  vi.mocked(verifyDisposableCampaignTarget).mockImplementation(()=>{clock+=45_000;});
  await expect(h.prepare()).rejects.toThrow('Owned cleanup deadline exceeded');
  expect(sqlCalls).toBe(0);
  expect(h.cleanupSafe).toBe(true);
  vi.mocked(verifyDisposableCampaignTarget).mockImplementation(()=>undefined);
  await h.prepare();
  expect(sqlCalls).toBe(1);
});
