// @vitest-environment jsdom
import { cleanup } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { localCampaignHarness } from './helpers/localCampaignHarness';
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
import { applyDirectAssignment, createAssignmentCommandId, getAssignmentCommandState, removeAssignmentDate,
  removeDirectAssignment, requireCommitted } from '@/features/assignments/commands';
import { toggleTimesheetDay } from '@/services/toggleTimesheetDay';

describe.skipIf(!process.env.STAFFING_EDGE_TEST_URL)('real assignment-command persistence on local Auth/RLS/SQL (P0.14/15/17)', () => {
  let h: ReturnType<typeof localCampaignHarness>;
  let manager: Awaited<ReturnType<typeof h.user>>;
  let tech: Awaited<ReturnType<typeof h.user>>;
  let baseline: string[];
  let background: ReturnType<typeof trackLocalFunctions> | undefined;
  let cleanupUnsafe = false;

  beforeAll(async () => {
    h = localCampaignHarness(['manage-flex-crew-assignments/index.ts']);
    await h.prepare();
    baseline = h.fingerprint();
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
    for (const action of [h.cleanJobs, h.cleanUsers]) {
      try { await action(); } catch (error) { failures.push(error); }
    }
    try { if (baseline) expect(h.fingerprint()).toEqual(baseline); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'Local matrix fixture cleanup or preservation failed');
  }, 200_000);

  function bind(client = manager.client) {
    binding.client = client;
    background = trackLocalFunctions(client);
  }

  async function job() {
    const id = await h.job();
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

  const stateToken = async (jobId: string) => (await getAssignmentCommandState(jobId, tech.id)).state_token;

  /** What the matrix runner sends for a direct assignment, signed in as the manager. */
  async function assign(jobId: string, input: { coverage: 'full' | 'single' | 'multi'; dates?: string[];
    mode?: 'add' | 'replace'; status?: 'invited' | 'confirmed' }) {
    bind();
    return requireCommitted(await applyDirectAssignment({ commandId: createAssignmentCommandId(), jobId, technicianId: tech.id,
      role: 'SND-FOH-R', status: input.status ?? 'invited', coverage: input.coverage, dates: input.dates, mode: input.mode,
      expectedStateToken: await stateToken(jobId), source: 'matrix-inspector' }));
  }

  it('full coverage creates every intended Madrid calendar date', async () => {
    const item = await job();
    await assign(item.id, { coverage: 'full' });
    expect(await dates(item.id)).toEqual(['2027-10-20', '2027-10-21', '2027-10-22']);
    expect(await assignment(item.id)).toMatchObject({ single_day: false, assignment_date: null, status: 'invited',
      assignment_source: 'direct', sound_role: 'SND-FOH-R', assigned_by: manager.id });
  }, 45_000);

  it('single-day coverage creates only the selected day', async () => {
    const item = await job();
    await assign(item.id, { coverage: 'single', dates: ['2027-10-21'], status: 'confirmed' });
    expect(await dates(item.id)).toEqual(['2027-10-21']);
    expect(await assignment(item.id)).toMatchObject({ single_day: true, assignment_date: '2027-10-21', status: 'confirmed' });
  }, 45_000);

  it('multiple dates preserve sparse selection including an earlier prep day', async () => {
    const item = await job();
    expect((await h.client.from('job_date_types').insert({ job_id: item.id, date: '2027-10-18', type: 'prep_day' })).error).toBeNull();
    await assign(item.id, { coverage: 'multi', dates: ['2027-10-18', '2027-10-22'] });
    expect(await dates(item.id)).toEqual(['2027-10-18', '2027-10-22']);
    expect(await assignment(item.id)).toMatchObject({ single_day: true, assignment_date: '2027-10-18' });
  }, 45_000);

  it('adding a day preserves confirmed membership, its anchor and approved work fields', async () => {
    const item = await job();
    bind();
    await h.assignment(item.id, tech.id, 'confirmed', 'SND-FOH-R');
    expect((await h.client.from('job_assignments').update({ single_day: true, assignment_date: '2027-10-20',
      response_time: '2026-10-01T08:00:00Z' }).eq('job_id', item.id).eq('technician_id', tech.id)).error).toBeNull();
    await toggleTimesheetDay({ jobId: item.id, technicianId: tech.id, dateIso: '2027-10-20', present: true });
    expect((await h.client.from('timesheets').update({ status: 'submitted' }).eq('job_id', item.id).eq('technician_id', tech.id)).error).toBeNull();
    const approved = { status: 'approved', approved_by_manager: true, approved_by: manager.id, approved_at: '2026-10-01T09:00:00Z',
      start_time: '08:00:00', end_time: '18:00:00', break_minutes: 60, signature_data: 'local-test-signature', notes: 'Local approved work' };
    expect((await h.client.from('timesheets').update(approved).eq('job_id', item.id).eq('technician_id', tech.id)).error).toBeNull();
    const retainedFields = 'id,status,approved_by_manager,approved_by,approved_at,start_time,end_time,break_minutes,signature_data,notes';
    const before = await h.client.from('timesheets').select(retainedFields).eq('job_id', item.id).eq('technician_id', tech.id).eq('date', '2027-10-20').single();
    expect(before.error).toBeNull();
    expect(before.data).toMatchObject({ status: 'approved', approved_by_manager: true });
    await assign(item.id, { coverage: 'single', dates: ['2027-10-22'], mode: 'add' });
    expect(await dates(item.id)).toEqual(['2027-10-20', '2027-10-22']);
    expect(await assignment(item.id)).toMatchObject({ single_day: true, assignment_date: '2027-10-20', status: 'confirmed',
      response_time: '2026-10-01T08:00:00+00:00' });
    const retained = await h.client.from('timesheets').select(retainedFields).eq('job_id', item.id).eq('technician_id', tech.id).eq('date', '2027-10-20').single();
    expect(retained.error).toBeNull();
    expect(retained.data).toEqual(before.data);
  }, 45_000);

  it('replacing dates removes the old schedule and updates the scoped anchor', async () => {
    const item = await job();
    await assign(item.id, { coverage: 'full' });
    await assign(item.id, { coverage: 'single', dates: ['2027-10-22'], mode: 'replace' });
    expect(await dates(item.id)).toEqual(['2027-10-22']);
    expect(await assignment(item.id)).toMatchObject({ single_day: true, assignment_date: '2027-10-22' });
  }, 45_000);

  it('single-date removal retains the base assignment and the other schedule', async () => {
    const item = await job();
    await assign(item.id, { coverage: 'full' });
    const saved = await assignment(item.id);
    requireCommitted(await removeAssignmentDate({ commandId: createAssignmentCommandId(), jobId: item.id, technicianId: tech.id,
      date: '2027-10-21', expectedStateToken: await stateToken(item.id), source: 'matrix-inspector' }));
    expect(await dates(item.id)).toEqual(['2027-10-20', '2027-10-22']);
    expect(await assignment(item.id)).toMatchObject({ job_id: saved.job_id, technician_id: saved.technician_id, status: saved.status });
  }, 45_000);

  it('the real date RPC rejects a technician caller', async () => {
    const item = await job();
    bind(tech.client);
    await expect(toggleTimesheetDay({ jobId: item.id, technicianId: tech.id, dateIso: '2027-10-20', present: true }))
      .rejects.toMatchObject({ code: '42501' });
    expect(await dates(item.id)).toEqual([]);
  }, 45_000);

  it('removing the last date is refused, and removing the assignment deletes membership', async () => {
    const item = await job();
    await assign(item.id, { coverage: 'single', dates: ['2027-10-21'] });
    const refused = await removeAssignmentDate({ commandId: createAssignmentCommandId(), jobId: item.id, technicianId: tech.id,
      date: '2027-10-21', expectedStateToken: await stateToken(item.id), source: 'matrix-inspector' });
    expect(refused).toMatchObject({ ok: false, code: 'last_date' });
    expect(await dates(item.id)).toEqual(['2027-10-21']);
    requireCommitted(await removeDirectAssignment({ commandId: createAssignmentCommandId(), jobId: item.id, technicianId: tech.id,
      expectedStateToken: await stateToken(item.id), source: 'matrix-inspector' }));
    expect(await dates(item.id)).toEqual([]);
    const remaining = await h.client.from('job_assignments').select('job_id').eq('job_id', item.id).eq('technician_id', tech.id);
    expect(remaining.error).toBeNull();
    expect(remaining.data).toEqual([]);
  }, 45_000);
});
