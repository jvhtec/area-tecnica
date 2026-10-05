// @vitest-environment jsdom
import { cleanup } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { disposableCampaignHarness } from './helpers/disposableCampaignHarness';
import { trackLocalFunctions } from './helpers/trackLocalFunctions';

const binding = vi.hoisted(() => ({ client: null as unknown as SupabaseClient }));
// The legacy dataLayerClient captures this export during module initialization.
// Forward its properties to the same real signed-in client as the services.
vi.mock('@/lib/supabase', () => ({ supabase: new Proxy({}, {
  get(_target, property) {
    const value = Reflect.get(binding.client, property);
    return typeof value === 'function' ? value.bind(binding.client) : value;
  },
}) }));
vi.mock('@/integrations/supabase/client', () => ({ get supabase() { return binding.client; } }));
import { AssignmentCommandError, applyDirectAssignment, createAssignmentCommandId, getAssignmentCommandState,
  requireCommitted } from '@/features/assignments/commands';
import { toggleTimesheetDay } from '@/services/toggleTimesheetDay';

describe.skipIf(!process.env.STAFFING_DISPOSABLE_MANIFEST && !process.env.STAFFING_CI_MANIFEST)('disposable clone real assignment-command atomic-write evidence (P0.16)', () => {
  let h: ReturnType<typeof disposableCampaignHarness>;
  let manager: Awaited<ReturnType<typeof h.user>>;
  let tech: Awaited<ReturnType<typeof h.user>>;
  let baseline: string[];
  let historicalBaseline: string[];
  let background: ReturnType<typeof trackLocalFunctions> | undefined;
  let cleanupUnsafe = false;

  beforeAll(async () => {
    h = disposableCampaignHarness(['manage-flex-crew-assignments/index.ts']);
    await h.prepare();
    baseline = h.fingerprint(); historicalBaseline = h.historicalFingerprint();
    manager = await h.user('management');
    tech = await h.user();
  }, 90_000);
  beforeEach(() => {
    if (cleanupUnsafe) throw new Error('Local transport failure requires runtime quiescence before further fixtures');
    h?.assertFixtureSafe();
  });
  afterEach(async () => {
    if (cleanupUnsafe) return;
    cleanupUnsafe = true;
    try {
      cleanup();
      await background?.drain();
      await h?.cleanJobs();
      cleanupUnsafe = false;
    }
    catch (error) {
      cleanupUnsafe = !h?.cleanupSafe || background?.transportComplete === false;
      throw error;
    }
    finally {
      cleanup();
      background?.restore();
      background = undefined;
    }
  }, 100_000);
  afterAll(async () => {
    if (!h) return;
    if (cleanupUnsafe) throw new Error('Owned fixtures retained: local function transport needs quiescence before cleanup');
    const failures: unknown[] = [];
    for (const action of [h.cleanJobs, h.cleanUsers, h.finish]) {
      try { await action(); } catch (error) { failures.push(error); }
    }
    try { if (baseline) expect(h.fingerprint()).toEqual(baseline); expect(h.historicalFingerprint()).toEqual(historicalBaseline); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'Local matrix fixture cleanup or preservation failed');
  }, 200_000);

  function bind(client = manager.client) {
    binding.client = client;
    background = trackLocalFunctions(client);
  }

  async function job() {
    const id = await h.job();
    // Provision the crew-call scope required by the real reconciliation RPC.
    // This technician has no provider resource, so no Flex HTTP write occurs.
    const crew = await h.client.from('flex_crew_calls').insert({
      job_id: id, department: 'sound', flex_element_id: crypto.randomUUID(),
    });
    expect(crew.error).toBeNull();
    // UTC begins on the previous day, but the intended Madrid span is 20–22.
    const result = await h.client.from('jobs').update({ start_time: '2027-10-19T22:30:00Z',
      end_time: '2027-10-22T21:59:00Z' }).eq('id', id).select('id').single();
    expect(result.error).toBeNull();
    return result.data!;
  }

  async function assignment(jobId: string) {
    const result = await h.client.from('job_assignments').select('*').eq('job_id', jobId).eq('technician_id', tech.id).single();
    expect(result.error).toBeNull();
    return result.data!;
  }

  async function dates(jobId: string) {
    const result = await h.client.from('timesheets').select('date').eq('job_id', jobId).eq('technician_id', tech.id).eq('is_active', true).order('date');
    expect(result.error).toBeNull();
    return result.data!.map(row => row.date);
  }

  async function members(jobId: string) {
    const result = await h.client.from('job_assignments').select('job_id').eq('job_id', jobId).eq('technician_id', tech.id);
    expect(result.error).toBeNull();
    return result.data!;
  }

  const sparse = async (jobId: string) => applyDirectAssignment({ commandId: createAssignmentCommandId(), jobId, technicianId: tech.id,
    role: 'SND-FOH-R', status: 'invited', coverage: 'multi', dates: ['2027-10-20', '2027-10-22'],
    expectedStateToken: (await getAssignmentCommandState(jobId, tech.id)).state_token, source: 'matrix-batch' });

  it('same manager without fault creates both sparse dates', async () => {
    const item = await job();
    bind();
    requireCommitted(await sparse(item.id));
    expect(await dates(item.id)).toEqual(['2027-10-20', '2027-10-22']);
    expect(await assignment(item.id)).toMatchObject({ single_day: true, assignment_date: '2027-10-20',
      status: 'invited', assignment_source: 'direct', sound_role: 'SND-FOH-R', assigned_by: manager.id });
  }, 45_000);

  it('one failed date rolls back the whole command: no membership, no day', async () => {
    const item = await job();
    await h.armFault(item.id, tech.id, manager.id, '2027-10-22');
    bind();
    const outcome = await sparse(item.id).then(result => result, (error: unknown) => error);
    // The database rejects the command as a whole, whether the client surfaces it as a result or an error.
    expect(outcome instanceof AssignmentCommandError || (outcome as { ok?: boolean }).ok === false).toBe(true);
    await background!.drain();
    expect(await dates(item.id)).toEqual([]);
    expect(await members(item.id)).toEqual([]);
    const trace = h.transportEvents.filter(event => event.jobId === item.id);
    expect(trace.filter(event => event.path === '/rest/v1/job_assignments')).toEqual([]);
    expect(background!.calls).toEqual([]);
  }, 45_000);

  it('the unchanged date RPC still rejects a technician with exact authorization denial', async () => {
    const item = await job(); bind(tech.client);
    await expect(toggleTimesheetDay({ jobId: item.id, technicianId: tech.id, dateIso: '2027-10-20', present: true }))
      .rejects.toMatchObject({ code: '42501' });
    expect(await dates(item.id)).toEqual([]);
    expect(await members(item.id)).toEqual([]);
  }, 45_000);
});
