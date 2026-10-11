// @vitest-environment jsdom
import React from 'react';
import { randomUUID } from 'node:crypto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { localCampaignHarness } from './helpers/localCampaignHarness';

const binding = vi.hoisted(() => ({ client: null as unknown as SupabaseClient, showUndo: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: new Proxy({}, {
  get(_target, property) {
    const value = Reflect.get(binding.client, property);
    return typeof value === 'function' ? value.bind(binding.client) : value;
  },
}) }));
vi.mock('@/features/matrix-v2/undoToast', () => ({ showUndoToast: binding.showUndo }));

import { createMatrixCommandRunner } from '@/features/matrix-v2/commandRunner';
import { resetDeferredEffectsForTests } from '@/features/matrix-v2/deferredEffects';
import { CellInspectorBody } from '@/features/matrix-v2/inspector/CellInspectorBody';
import type { InspectorEnvironment } from '@/features/matrix-v2/inspector/environment';
import type { MatrixIntent, MatrixRunOutcome, MatrixUndo } from '@/features/matrix-v2/types';
import type { MatrixJob } from '@/hooks/useOptimizedMatrixData';
import { getAssignmentCommandState, applyDirectAssignment, undoAssignmentCommand, releaseAssignmentCommandEffects } from '@/features/assignments/commands';

// This suite is admitted by the certified synthetic Auth/REST/SQL runtime.
// Every command and claim is real; the effect sink records deliveries without
// contacting a provider. No production URL, credential or source DB is used.
describe.skipIf(!process.env.STAFFING_EDGE_TEST_URL)('matrix v2 undo on real local Auth/RLS/SQL', () => {
  let h: ReturnType<typeof localCampaignHarness>;
  let manager: Awaited<ReturnType<typeof h.user>>;
  let tech: Awaited<ReturnType<typeof h.user>>;
  let baseline: string[];
  let queryClient: QueryClient;
  let unsafe = false;
  const deliveries = vi.fn();
  const commands = new Set<string>();
  const ownedJobs = new Set<string>();

  beforeAll(async () => {
    h = localCampaignHarness();
    await h.prepare();
    baseline = h.fingerprint();
    manager = await h.user('management');
    tech = await h.user();
    binding.client = manager.client;
  }, 90_000);
  beforeEach(() => {
    if (unsafe) throw new Error('Local transport uncertainty requires runtime quiescence');
    h.assertFixtureSafe();
    resetDeferredEffectsForTests();
    deliveries.mockClear(); binding.showUndo.mockClear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });
  afterEach(async () => {
    if (unsafe) return;
    unsafe = true;
    cleanup(); resetDeferredEffectsForTests(); queryClient?.clear();
    // Already-started SDK requests must settle before the server cleanup fence.
    await waitFor(() => h.assertCleanupSafe(), { timeout: 15_000 });
    // Owned command IDs only, under the same cleanup fence as the fixture jobs.
    await h.withCleanupFence(async assertFresh => {
      if (ownedJobs.size) {
        assertFresh();
        // Include rejected inverse IDs, which intentionally have no undo link.
        const ledger = await h.client.from('assignment_commands').select('command_id')
          .eq('technician_id', tech.id).in('job_id', [...ownedJobs]);
        expect(ledger.error).toBeNull();
        for (const row of ledger.data ?? []) commands.add(row.command_id);
      }
      if (commands.size) {
        assertFresh();
        expect((await h.client.from('assignment_commands').delete().in('command_id', [...commands])).error).toBeNull();
        commands.clear();
      }
    });
    await h.cleanJobs();
    ownedJobs.clear();
    unsafe = false;
  }, 100_000);
  afterAll(async () => {
    if (!h) return;
    if (unsafe) throw new Error('Owned fixtures retained pending safe transport cleanup');
    await h.cleanJobs(); await h.cleanUsers();
    expect(h.fingerprint()).toEqual(baseline);
  }, 200_000);

  async function fixture() {
    const id = await h.job();
    ownedJobs.add(id);
    const item = await h.client.from('jobs').select('id,title,start_time,end_time,status,job_type').eq('id', id).single();
    expect(item.error).toBeNull();
    const job = item.data as MatrixJob;
    const runner = createMatrixCommandRunner({
      queryClient, getJob: candidate => candidate === id ? job : undefined,
      getTechnician: candidate => candidate === tech.id ? { id: tech.id, first_name: 'Local', last_name: 'Technician', department: 'sound' } : undefined,
      effects: { run: async (commandId) => {
        const claim = await manager.client.rpc('claim_assignment_side_effects', { p_command_id: commandId });
        expect(claim.error).toBeNull();
        const plan = claim.data as { effects: unknown[] };
        if (plan.effects.length) deliveries(commandId, plan.effects);
        return { attempted: plan.effects.length, failed: 0, recorded: false };
      } },
    });
    const assign = (overrides: Partial<Extract<MatrixIntent, { kind: 'assign' }>> = {}): MatrixIntent => ({
      kind: 'assign', jobId: id, technicianId: tech.id, role: 'SND-FOH-R', status: 'invited', coverage: 'full', source: 'matrix-inspector', ...overrides,
    });
    const run = async (intent: MatrixIntent) => {
      const outcome = await runner.run(intent);
      if (outcome.ok) commands.add(outcome.result.command_id);
      return outcome;
    };
    return { job, runner, run, assign };
  }
  function success(outcome: MatrixRunOutcome) {
    if (!outcome.ok) throw new Error(`Expected commit, got ${outcome.code}`);
    return outcome;
  }
  async function claim(commandId: string) {
    const response = await manager.client.rpc('claim_assignment_side_effects', { p_command_id: commandId });
    expect(response.error).toBeNull();
    return (response.data as { effects: unknown[] }).effects;
  }
  async function undo(handle: MatrixUndo | null) {
    expect(handle).not.toBeNull();
    const result = await handle!.undo();
    // The inverse ID is server-owned linkage: collect only our original's ID.
    const ledger = await h.client.from('assignment_commands').select('undone_by_command_id').eq('command_id', handle!.commandId).single();
    expect(ledger.error).toBeNull();
    if (ledger.data?.undone_by_command_id) commands.add(ledger.data.undone_by_command_id);
    return result;
  }

  it('the actual inspector commits and its undo cancels both real effect plans', async () => {
    const f = await fixture();
    const env: InspectorEnvironment = {
      runner: { ...f.runner, run: f.run }, getTechnician: () => ({ id: tech.id, first_name: 'Local', last_name: 'Technician', department: 'sound' }),
      getJob: () => f.job, getJobsForDate: () => [f.job], getAssignmentForCell: () => undefined, getAvailabilityForCell: () => undefined,
      roleSlotsByJob: new Map([[f.job.id, [{ code: 'SND-FOH-R', department: 'sound', required: 1, filled: 0, invited: 0, open: 1 }]]]),
      lastRoleByTechnician: new Map(), declinedJobIds: () => new Set(), isFridge: () => false, staffingByDate: () => null,
      profileNames: new Map(), canAssign: true, canMarkUnavailable: true,
      staffing: { send: vi.fn(), cancel: vi.fn(), channel: 'email', setChannel: vi.fn(), department: 'sound' },
    };
    const close = vi.fn();
    render(<QueryClientProvider client={queryClient}><CellInspectorBody env={env}
      target={{ technicianId: tech.id, date: new Date('2027-10-20T12:00:00Z'), dateKey: '2027-10-20', anchor: null }} onClose={close} /></QueryClientProvider>);
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Asignar', exact: true });
    await waitFor(() => expect(button).toBeEnabled(), { timeout: 15_000 });
    await user.click(button);
    await waitFor(() => expect(close).toHaveBeenCalledOnce(), { timeout: 15_000 });
    const handle = binding.showUndo.mock.calls[0][0].undo as MatrixUndo;
    expect(await claim(handle.commandId)).toEqual([]);
    await act(async () => { expect(await undo(handle)).toEqual({ ok: true }); });
    expect((await getAssignmentCommandState(f.job.id, tech.id)).exists).toBe(false);
    expect(await claim(handle.commandId)).toEqual([]);
    expect(deliveries).not.toHaveBeenCalled();
  }, 45_000);

  it('restores full coverage and the exact prior decision token', async () => {
    const f = await fixture();
    const first = success(await f.run(f.assign()));
    const prior = await getAssignmentCommandState(f.job.id, tech.id);
    const changed = success(await f.run(f.assign({ role: 'SND-MON-E', coverage: 'single', dates: ['2027-10-21'], mode: 'replace' })));
    expect(await undo(changed.undo)).toEqual({ ok: true });
    expect((await getAssignmentCommandState(f.job.id, tech.id)).state_token).toBe(prior.state_token);
    await undo(first.undo);
  }, 45_000);

  it('confirmation undo restores invited status without sending either notification', async () => {
    const f = await fixture();
    success(await f.run(f.assign()));
    const prior = await getAssignmentCommandState(f.job.id, tech.id);
    const confirmed = success(await f.run({ kind: 'confirm', jobId: f.job.id, technicianId: tech.id, source: 'matrix-keyboard' }));
    expect(await claim(confirmed.result.command_id)).toEqual([]);
    expect(await undo(confirmed.undo)).toEqual({ ok: true });
    expect((await getAssignmentCommandState(f.job.id, tech.id)).state_token).toBe(prior.state_token);
    expect(deliveries).not.toHaveBeenCalled();
  }, 45_000);

  it('an explicit release wins and undo makes no core mutation', async () => {
    const f = await fixture();
    const outcome = success(await f.run(f.assign()));
    expect(await releaseAssignmentCommandEffects(outcome.result.command_id)).toBe(true);
    expect((await claim(outcome.result.command_id)).length).toBeGreaterThan(0);
    expect(await undo(outcome.undo)).toMatchObject({ ok: false });
    expect((await getAssignmentCommandState(f.job.id, tech.id)).state_token).toBe(outcome.result.state_token);
  }, 45_000);

  it('a status-only apply upgrade atomically restores invited membership and cancels both plans', async () => {
    const f = await fixture();
    success(await f.run(f.assign()));
    const prior = await getAssignmentCommandState(f.job.id, tech.id);
    const upgraded = success(await f.run(f.assign({ status: 'confirmed' })));
    expect(upgraded.result.assignment?.status).toBe('confirmed');
    expect(await claim(upgraded.result.command_id)).toEqual([]);
    expect(await undo(upgraded.undo)).toEqual({ ok: true });
    expect((await getAssignmentCommandState(f.job.id, tech.id)).state_token).toBe(prior.state_token);
    const link = await h.client.from('assignment_commands').select('undone_by_command_id').eq('command_id', upgraded.result.command_id).single();
    expect(link.error).toBeNull();
    expect(link.data?.undone_by_command_id).toBeTruthy();
    expect(await claim(upgraded.result.command_id)).toEqual([]);
    expect(await claim(link.data!.undone_by_command_id!)).toEqual([]);
    expect(deliveries).not.toHaveBeenCalled();
  }, 45_000);

  it('a newer manager decision blocks undo without changing that decision', async () => {
    const f = await fixture();
    const first = success(await f.run(f.assign()));
    const newerId = randomUUID(); commands.add(newerId);
    await applyDirectAssignment({ commandId: newerId, jobId: f.job.id, technicianId: tech.id, role: 'SND-MON-E', status: 'invited', coverage: 'full', expectedStateToken: first.result.state_token, source: 'assignment-dialog' });
    const current = await getAssignmentCommandState(f.job.id, tech.id);
    expect(await undo(first.undo)).toMatchObject({ ok: false, reason: 'stale' });
    expect((await getAssignmentCommandState(f.job.id, tech.id)).state_token).toBe(current.state_token);
  }, 45_000);

  it('lost-response replay restores once and cannot adopt an unrelated command ID', async () => {
    const f = await fixture();
    const prior = await getAssignmentCommandState(f.job.id, tech.id);
    const first = success(await f.run(f.assign()));
    const inverseId = randomUUID(); commands.add(inverseId);
    const packet = { commandId: inverseId, originalCommandId: first.result.command_id, expectedStateToken: first.result.state_token!, priorState: prior };
    const restored = await undoAssignmentCommand(packet);
    expect(restored.ok).toBe(true);
    expect(await undoAssignmentCommand(packet)).toMatchObject({ ok: true, replayed: true, state_token: restored.state_token });
    expect((await getAssignmentCommandState(f.job.id, tech.id)).state_token).toBe(prior.state_token);
    await expect(undoAssignmentCommand({ ...packet, expectedStateToken: 'forged' })).rejects.toMatchObject({ code: 'command_id_reused' });
  }, 45_000);

  it('a forged prior snapshot cannot restore an unobserved role', async () => {
    const f = await fixture();
    const prior = await getAssignmentCommandState(f.job.id, tech.id);
    const first = success(await f.run(f.assign()));
    const inverseId = randomUUID(); commands.add(inverseId);
    const response = await manager.client.rpc('undo_assignment_command', { p_command_id: inverseId,
      p_original_command_id: first.result.command_id, p_expected_state_token: first.result.state_token!,
      p_prior_state: { ...prior, dates: ['2027-10-21'] } });
    expect(response.error !== null || (response.data as { ok?: boolean })?.ok === false).toBe(true);
    expect((await getAssignmentCommandState(f.job.id, tech.id)).state_token).toBe(first.result.state_token);
  }, 45_000);

  it('a technician cannot inspect or undo a manager command', async () => {
    const f = await fixture();
    const first = success(await f.run(f.assign()));
    const response = await tech.client.rpc('get_assignment_command_undo_window', { p_command_id: first.result.command_id });
    expect(response.error?.code).toBe('42501');
    const attempt = await tech.client.rpc('undo_assignment_command', { p_command_id: randomUUID(), p_original_command_id: first.result.command_id,
      p_expected_state_token: first.result.state_token!, p_prior_state: { exists: false, assignment: null, dates: [], state_token: 'ignored' } });
    expect(attempt.error?.code).toBe('42501');
  }, 45_000);
});
