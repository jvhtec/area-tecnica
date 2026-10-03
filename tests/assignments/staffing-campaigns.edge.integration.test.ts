import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { localCampaignHarness } from './helpers/localCampaignHarness';
import { holdCampaignRole } from './helpers/campaignRowLock';

// Actual Edge Runtime, GoTrue/JWT, PostgREST, constraints, RPCs and triggers.
// Opt-in only: provider delivery is captured by the isolated local stack.
// No production implementation changes or global/destructive fault fixtures.
describe.skipIf(!process.env.STAFFING_EDGE_TEST_URL)('campaign characterization on isolated historical Edge Runtime', () => {
  let h: ReturnType<typeof localCampaignHarness>;
  let manager: { id: string; token: string };
  let tech: { id: string; token: string };
  let alternate: { id: string; token: string };
  let baseline: string[];

  beforeAll(async () => {
    h = localCampaignHarness();
    await h.prepare();
    const health = await fetch(`${h.localUrl}/functions/v1/_local-health`);
    expect(await health.json()).toMatchObject({ runtime: 'isolated-local' });
    baseline = h.fingerprint();
    manager = await h.user('management');
    tech = await h.user();
    alternate = await h.user();
  }, 60_000);
  beforeEach(() => { h?.assertCleanupSafe(); });
  afterEach(async () => { await h?.cleanJobs(); }, 100_000);
  afterAll(async () => {
    if (!h) return;
    h.assertCleanupSafe();
    const failures: unknown[] = [];
    for (const cleanup of [h.cleanJobs, h.cleanUsers]) {
      try { await cleanup(); } catch (error) { failures.push(error); }
    }
    try { if (baseline) expect(h.fingerprint()).toEqual(baseline); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'Local fixture cleanup or preservation failed');
  }, 200_000);

  it('requires real management auth for start and the service key for tick', async () => {
    const job = await h.job();
    const body = { job_id: job, department: 'sound', mode: 'assisted', policy: {} };
    expect((await h.api('start', body, tech.token)).status).toBe(403);
    expect((await h.api('start', body, '')).status).toBe(401);
    const started = await h.start(job, manager.token);
    expect((await h.api('tick', { campaign_id: started.campaign.id }, manager.token)).status).toBe(401);
  });

  it.each(['assisted', 'auto'])('%s creation preserves its initial-tick boundary', async mode => {
    const job = await h.job();
    const started = await h.start(job, manager.token, mode);
    expect(started.roles_created).toBe(1);
    expect(started.campaign.last_run_at).toBeNull(); // Returned pre-tick snapshot.
    const saved = await h.campaign(started.campaign.id);
    const roles = await h.roles(saved.id);
    expect(saved.status).toBe('active');
    expect(saved.run_lock).toBeNull();
    expect(roles[0].wave_number).toBe(0);
    expect((await h.client.from('staffing_requests').select('id').eq('job_id', job)).data).toEqual([]);
    if (mode === 'assisted') {
      expect(started.auto_tick).toBeNull();
      expect(saved.last_run_at).toBeNull();
      expect(roles[0].stage).toBe('idle');
    } else {
      expect(started.auto_tick).toMatchObject({ tick_completed: true, auto_actions: [] });
      expect(saved.last_run_at).not.toBeNull();
      expect(roles[0].stage).toBe('availability');
    }
  });

  it.each(['invited', 'declined'])('counts %s membership independently of active schedules (P0.20)', async status => {
    const job = await h.job();
    await h.assignment(job, tech.id, status);
    expect((await h.client.from('timesheets').select('id').eq('job_id', job)).data).toEqual([]);
    const started = await h.start(job, manager.token);
    const result = await h.api('tick', { campaign_id: started.campaign.id });
    expect(result.status).toBe(200);
    const filled = status === 'invited';
    expect((await h.roles(started.campaign.id))[0]).toMatchObject({ assigned_count: filled ? 1 : 0, stage: filled ? 'filled' : 'availability' });
    expect(await h.campaign(started.campaign.id)).toMatchObject({ status: filled ? 'completed' : 'active', run_lock: null });
    if (filled) {
      expect(result.body.next_run_at).toBeNull();
      expect((await h.api('tick', { campaign_id: started.campaign.id })).status).toBe(400);
    }
  });

  it('paused nudge schedules without ticking; resume and active nudge tick', async () => {
    const job = await h.job();
    const { campaign } = await h.start(job, manager.token);
    expect((await h.api('pause', { campaign_id: campaign.id }, manager.token)).status).toBe(200);
    expect((await h.api('nudge', { campaign_id: campaign.id }, manager.token)).body.message).toBe('Campaign nudged');
    expect(await h.campaign(campaign.id)).toMatchObject({ status: 'paused', last_run_at: null, run_lock: null });
    expect((await h.roles(campaign.id))[0].stage).toBe('idle');
    expect((await h.api('tick', { campaign_id: campaign.id })).status).toBe(400);
    const resumed = await h.api('resume', { campaign_id: campaign.id }, manager.token);
    expect(resumed.status).toBe(200);
    expect(resumed.body.tick_result.tick_completed).toBe(true);
    const nudged = await h.api('nudge', { campaign_id: campaign.id }, manager.token);
    expect(nudged.status).toBe(200);
    expect(nudged.body.tick_result.tick_completed).toBe(true);
    expect((await h.roles(campaign.id))[0].stage).toBe('availability');
  });

  it.each(['paused', 'stopped', 'completed'])('resumes %s campaigns and synchronizes a new required role', async status => {
    const job = await h.job();
    const { campaign } = await h.start(job, manager.token);
    if (status === 'stopped') expect((await h.api('stop', { campaign_id: campaign.id }, manager.token)).status).toBe(200);
    else expect((await h.client.from('staffing_campaigns').update({ status }).eq('id', campaign.id)).error).toBeNull();
    expect((await h.client.from('job_required_roles').insert({ job_id: job, department: 'sound', role_code: 'SND-MON-T', quantity: 1 })).error).toBeNull();
    const resumed = await h.api('resume', { campaign_id: campaign.id }, manager.token);
    expect(resumed.status).toBe(200);
    expect(resumed.body.tick_result).toMatchObject({ tick_completed: true, roles_processed: 2 });
    expect((await h.roles(campaign.id)).map(r => r.role_code)).toEqual(['SND-FOH-T', 'SND-MON-T']);
    expect(await h.campaign(campaign.id)).toMatchObject({ status: 'active', run_lock: null });
  });

  it.each(['active', 'failed'])('rejects resume from %s', async status => {
    const job = await h.job();
    const { campaign } = await h.start(job, manager.token);
    expect((await h.client.from('staffing_campaigns').update({ status }).eq('id', campaign.id)).error).toBeNull();
    expect((await h.api('resume', { campaign_id: campaign.id }, manager.token)).status).toBe(400);
    expect((await h.campaign(campaign.id)).status).toBe(status);
  });

  it.each([1, 16, null])('characterizes a held lock with age %s minutes', async age => {
    const job = await h.job();
    const { campaign } = await h.start(job, manager.token);
    const lock = randomUUID();
    const timestamp = age === null ? null : new Date(Date.now() - age * 60_000).toISOString();
    expect((await h.client.from('staffing_campaigns').update({ run_lock: lock, last_run_at: timestamp }).eq('id', campaign.id)).error).toBeNull();
    const result = await h.api('tick', { campaign_id: campaign.id });
    expect(result.status).toBe(age === 1 ? 429 : 200);
    const saved = await h.campaign(campaign.id);
    if (age === 1) {
      expect(saved.run_lock).toBe(lock);
      expect(new Date(saved.last_run_at).getTime()).toBe(new Date(timestamp!).getTime());
    }
    else {
      expect(result.body.tick_completed).toBe(true);
      expect(saved.run_lock).toBeNull();
      expect(saved.last_run_at).not.toBeNull();
      if (timestamp) expect(new Date(saved.last_run_at).getTime()).toBeGreaterThan(new Date(timestamp).getTime());
    }
  });

  it('the sweeper RPC omits stale held locks even though direct tick recovers them (A3)', async () => {
    const job = await h.job();
    const { campaign } = await h.start(job, manager.token);
    expect((await h.client.from('staffing_campaigns').update({ run_lock: randomUUID(), last_run_at: new Date(Date.now() - 16 * 60_000).toISOString(),
      next_run_at: '2020-01-01T00:00:00Z' }).eq('id', campaign.id)).error).toBeNull();
    const selected = await h.client.rpc('get_campaigns_to_tick', { p_limit: 10000 });
    expect(selected.error).toBeNull();
    expect(selected.data.some((r: { id: string }) => r.id === campaign.id)).toBe(false);
    expect((await h.client.from('staffing_campaigns').update({ run_lock: null }).eq('id', campaign.id)).error).toBeNull();
    const control = await h.client.rpc('get_campaigns_to_tick', { p_limit: 10000 });
    expect(control.error).toBeNull();
    expect(control.data.some((r: { id: string }) => r.id === campaign.id)).toBe(true);
    expect((await h.client.from('staffing_campaigns').update({ run_lock: randomUUID() }).eq('id', campaign.id)).error).toBeNull();
    expect((await h.api('tick', { campaign_id: campaign.id })).status).toBe(200);
    expect((await h.campaign(campaign.id)).run_lock).toBeNull();
  });

  it('rejects a concurrent tick while the winner holds its real database run lock', async () => {
    const job = await h.job();
    const { campaign } = await h.start(job, manager.token);
    const role = (await h.roles(campaign.id))[0];
    const release = await holdCampaignRole(role.id);
    const winner = h.api('tick', { campaign_id: campaign.id }).catch(() => ({ status: 0, body: {} }));
    let winnerResult: Awaited<typeof winner>;
    try {
      const deadline = Date.now() + 10_000;
      while (!(await h.campaign(campaign.id)).run_lock) {
        if (Date.now() > deadline) throw new Error('Winner never acquired the campaign run lock');
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      const loser = await h.api('tick', { campaign_id: campaign.id });
      expect(loser.status).toBe(429);
      expect(loser.body.error).toBe('Campaign already running, please wait');
    } finally { await release(); winnerResult = await winner; }
    expect(winnerResult.status).toBe(200);
    expect(await h.campaign(campaign.id)).toMatchObject({ run_lock: null, status: 'active' });
    expect((await h.roles(campaign.id))[0]).toMatchObject({ stage: 'availability', wave_number: 0 });
  }, 40_000);

  it.each([null, 'SND-FOH-T'])('offer role resolution uses direct role %s before send metadata', async directRole => {
    const job = await h.job();
    const { campaign } = await h.start(job, manager.token);
    expect((await h.client.from('job_required_roles').insert({ job_id: job, department: 'sound', role_code: 'SND-MON-T', quantity: 1 })).error).toBeNull();
    const rid = await h.request(job, tech.id, 'offer', 'confirmed', directRole);
    expect((await h.client.from('staffing_events').insert({ staffing_request_id: rid, event: 'whatsapp_sent',
      meta: { role: 'SND-MON-T' }, created_at: '2026-10-02T08:00:00Z' })).error).toBeNull();
    expect((await h.api('tick', { campaign_id: campaign.id })).status).toBe(200);
    const roles = await h.roles(campaign.id);
    expect(roles.map(r => r.accepted_offers)).toEqual(directRole ? [1, 0] : [0, 1]);
    expect((await h.campaign(campaign.id)).status).toBe('active');
  });

  it('availability uses latest role-bearing event and deduplicates profile dates', async () => {
    const job = await h.job();
    const { campaign } = await h.start(job, manager.token);
    expect((await h.client.from('job_required_roles').insert({ job_id: job, department: 'sound', role_code: 'SND-MON-T', quantity: 1 })).error).toBeNull();
    for (const date of ['2027-10-20', '2027-10-21']) {
      const rid = await h.request(job, tech.id, 'availability', 'confirmed', 'SND-FOH-T', date);
      expect((await h.client.from('staffing_events').insert({ staffing_request_id: rid, event: 'whatsapp_sent',
        meta: { role: 'SND-MON-T' }, created_at: '2026-10-02T08:00:00Z' })).error).toBeNull();
    }
    await h.request(job, alternate.id, 'availability', 'confirmed', null);
    expect((await h.api('tick', { campaign_id: campaign.id })).status).toBe(200);
    expect((await h.roles(campaign.id)).map(r => r.confirmed_availability)).toEqual([0, 1]);
  });

  it('hands job-scoped availability to the latest requested role through the real sender', async () => {
    const job = await h.job();
    const { campaign } = await h.start(job, manager.token);
    expect((await h.client.from('job_required_roles').insert({ job_id: job, department: 'sound', role_code: 'SND-MON-T', quantity: 1 })).error).toBeNull();
    const rid = await h.request(job, tech.id, 'availability', 'confirmed');
    expect((await h.client.from('staffing_events').insert({ staffing_request_id: rid, event: 'whatsapp_sent',
      meta: { role: 'SND-MON-T' }, created_at: '2026-10-02T08:00:00Z' })).error).toBeNull();
    expect((await h.client.from('staffing_campaigns').update({ mode: 'auto' }).eq('id', campaign.id)).error).toBeNull();
    const result = await h.api('tick', { campaign_id: campaign.id });
    expect(result.status).toBe(200);
    expect(result.body.auto_actions).toEqual([expect.objectContaining({ profile_id: tech.id, phase: 'offer', role_code: 'SND-MON-T', status: 'sent' })]);
    const offers = await h.client.from('staffing_requests').select('role_code,target_date').eq('job_id', job).eq('phase', 'offer');
    expect(offers.error).toBeNull();
    expect(offers.data!.map(r => r.role_code)).toEqual(['SND-MON-T', 'SND-MON-T']);
  });

  it.each(['declined', 'expired'])('same-job %s offer in another role controls automatic handoff', async status => {
    const job = await h.job();
    const { campaign } = await h.start(job, manager.token);
    await h.request(job, tech.id, 'availability', 'confirmed');
    await h.request(job, tech.id, 'offer', status, 'SND-MON-T');
    expect((await h.client.from('staffing_campaigns').update({ mode: 'auto' }).eq('id', campaign.id)).error).toBeNull();
    const result = await h.api('tick', { campaign_id: campaign.id });
    expect(result.status).toBe(200);
    if (status === 'declined') expect(result.body.auto_actions).toEqual([]);
    else expect(result.body.auto_actions).toEqual([expect.objectContaining({ profile_id: tech.id, role_code: 'SND-FOH-T', status: 'sent' })]);
  });

  it('offers only remaining capacity in response order, counting profiles rather than date rows', async () => {
    const job = await h.job(2);
    const assigned = await h.user();
    await h.assignment(job, assigned.id, 'invited');
    const { campaign } = await h.start(job, manager.token);
    await h.request(job, tech.id, 'availability', 'confirmed', 'SND-FOH-T', '2027-10-20', '2026-10-02T08:00:00Z');
    await h.request(job, tech.id, 'availability', 'confirmed', 'SND-FOH-T', '2027-10-21', '2026-10-02T08:00:00Z');
    await h.request(job, alternate.id, 'availability', 'confirmed', 'SND-FOH-T', '2027-10-20', '2026-10-01T08:00:00Z');
    expect((await h.client.from('staffing_campaigns').update({ mode: 'auto' }).eq('id', campaign.id)).error).toBeNull();
    const result = await h.api('tick', { campaign_id: campaign.id });
    expect(result.status).toBe(200);
    expect(result.body.auto_actions).toEqual([expect.objectContaining({ profile_id: alternate.id, phase: 'offer', status: 'sent' })]);
    expect((await h.roles(campaign.id))[0]).toMatchObject({ assigned_count: 1, confirmed_availability: 2, pending_offers: 1 });
    const replay = await h.api('tick', { campaign_id: campaign.id });
    expect(replay.status).toBe(200);
    expect(replay.body.auto_actions).toEqual([]);
  });

  it.each(['none', 'membership', 'expire', 'increase-demand'])('accepted-unassigned reservation and recovery: %s (P1.15)', async recovery => {
    const job = await h.job();
    const { campaign } = await h.start(job, manager.token);
    const rid = await h.request(job, tech.id, 'offer', 'confirmed');
    await h.request(job, alternate.id, 'availability', 'confirmed');
    expect((await h.client.from('staffing_events').insert(['auto_assign_upsert_error', 'auto_assign_error'].map(event => ({
      staffing_request_id: rid, event, meta: { message: 'Previously characterized atomic failure' } })))).error).toBeNull();
    for (let n = 0; n < 2; n++) {
      const result = await h.api('tick', { campaign_id: campaign.id });
      expect(result.status).toBe(200);
      expect(result.body.auto_actions).toEqual([]);
      expect((await h.roles(campaign.id))[0]).toMatchObject({ accepted_offers: 1, assigned_count: 0, stage: 'offer' });
    }
    // Enable only automatic handoff; no availability wave may contact history.
    expect((await h.client.from('staffing_campaigns').update({ mode: 'auto' }).eq('id', campaign.id)).error).toBeNull();
    if (recovery === 'membership') await h.assignment(job, tech.id, 'invited');
    if (recovery === 'expire') expect((await h.client.from('staffing_requests').update({ status: 'expired' }).eq('id', rid)).error).toBeNull();
    if (recovery === 'increase-demand') expect((await h.client.from('job_required_roles').update({ quantity: 2 }).eq('job_id', job)).error).toBeNull();
    const result = await h.api('tick', { campaign_id: campaign.id });
    expect(result.status).toBe(200);
    const role = (await h.roles(campaign.id))[0];
    if (recovery === 'membership') {
      expect(role).toMatchObject({ accepted_offers: 1, assigned_count: 1, stage: 'filled' });
      expect((await h.campaign(campaign.id)).status).toBe('completed');
    } else if (recovery === 'none') {
      expect(result.body.auto_actions).toEqual([]);
      expect((await h.campaign(campaign.id)).status).toBe('active');
    } else {
      expect(result.body.auto_actions).toEqual([expect.objectContaining({ profile_id: alternate.id, phase: 'offer', status: 'sent' })]);
      const pending = await h.client.from('staffing_requests').select('profile_id,role_code').eq('job_id', job).eq('phase', 'offer').eq('status', 'pending');
      expect(pending.error).toBeNull();
      expect(pending.data).toHaveLength(2); // Real sender freezes the two-date job.
      expect(pending.data!.every(r => r.profile_id === alternate.id && r.role_code === 'SND-FOH-T')).toBe(true);
      const replay = await h.api('tick', { campaign_id: campaign.id });
      expect(replay.status).toBe(200);
      expect(replay.body.auto_actions).toEqual([]);
      expect((await h.roles(campaign.id))[0].pending_offers).toBe(1);
    }
  });
});
