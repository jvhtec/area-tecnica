import { describe, expect, it } from 'vitest';
import { createStaffingRequestToken } from '../persistRequests';
import { PendingStaffingScopeError, preserveLegacyResendScope } from '../resendScope';
import { confirmRequest, loadStaffingHandler, sendRequest, staffingClickRequest, StaffingDatabase } from './staffingHandlerHarness';

async function seedLegacyRequest(db: StaffingDatabase) {
  const row = { id: 'legacy', job_id: 'job', profile_id: 'tech', phase: 'offer', status: 'pending',
    single_day: false, target_date: null, batch_id: null, role_code: 'SND-FOH-R', created_at: new Date().toISOString(),
    token_expires_at: new Date(Date.now() + 60_000).toISOString(), token_hash: '' };
  row.token_hash = (await createStaffingRequestToken('test-secret', row.id, row.phase, row.token_expires_at)).token_hash;
  db.tables.staffing_requests.push(row);
  return row;
}

describe('staffing resend coverage', () => {
  it('cannot restore an earlier head credential after another resend rotates the whole batch', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db);
    const id = String(db.tables.staffing_requests[0].id);
    let competingStatus: number | undefined;
    db.afterQuery = async query => {
      if (query.table === 'staffing_requests' && query.operation === 'update' && query.rows.length === 2) {
        db.afterQuery = undefined;
        competingStatus = (await sendRequest(db, { resend_request_id: id })).status;
      }
    };
    expect((await sendRequest(db, { resend_request_id: id })).status).toBe(409);
    expect(competingStatus).toBe(200);
    expect(new Set(db.tables.staffing_requests.map(row => row.token_hash)).size).toBe(1);
    expect(db.deliveries).toHaveLength(2);
  });
  it('elects one immutable scope under competing writers, independent of timestamps', async () => {
    const db = new StaffingDatabase();
    const client = db as unknown as Parameters<typeof preserveLegacyResendScope>[0];
    await preserveLegacyResendScope(client, 'legacy', 'offer', ['2026-10-20'], 'SND-FOH-R');
    db.tables.staffing_events[0].created_at = '2099-01-01T00:00:00Z';
    await expect(preserveLegacyResendScope(client, 'legacy', 'offer', ['2026-10-20', '2026-10-21'], 'SND-FOH-R')).rejects.toBeInstanceOf(PendingStaffingScopeError);
    await expect(preserveLegacyResendScope(client, 'legacy', 'offer', ['2026-10-20'], 'SND-MON-R')).rejects.toBeInstanceOf(PendingStaffingScopeError);
    await preserveLegacyResendScope(client, 'legacy', 'offer', ['2026-10-20'], 'SND-FOH-R');
    expect(db.tables.staffing_events).toHaveLength(1);
    expect(db.tables.staffing_events[0].meta).toMatchObject({ dates: ['2026-10-20'], role: 'SND-FOH-R' });
  });

  it('does not freeze legacy scope when a timesheet conflict rejects the resend', async () => {
    const db = new StaffingDatabase();
    await seedLegacyRequest(db);
    const before = structuredClone(db.tables.staffing_requests);
    db.tables.timesheets.push({ job_id: 'other-job', technician_id: 'tech', date: '2026-10-20', is_active: true });
    expect((await sendRequest(db, { resend_request_id: 'legacy' })).status).toBe(409);
    expect(db.tables.staffing_events).toHaveLength(0);
    expect(db.tables.staffing_requests).toEqual(before);
    expect(db.deliveries).toHaveLength(0);
  });

  it('retires the old credential on every pending member, including path links', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db);
    const original = structuredClone(db.tables.staffing_requests);
    const oldLink = await staffingClickRequest(original[0]);
    const oldToken = new URL(oldLink.url).searchParams.get('t');
    expect((await sendRequest(db, { resend_request_id: original[1].id })).status).toBe(200);
    for (const member of original) {
      const query = new URL(oldLink.url);
      query.searchParams.set('rid', String(member.id));
      await loadStaffingHandler('staffing-click', db)(new Request(query));
      await loadStaffingHandler('staffing-click', db)(new Request(`https://edge.example.test/staffing-click/confirm/${member.id}/${oldToken}`));
    }
    expect(db.tables.staffing_requests.every(row => row.status === 'pending')).toBe(true);
    expect(db.tables.job_assignments).toHaveLength(0);
    await confirmRequest(db);
    expect(db.tables.staffing_requests.every(row => row.status === 'confirmed')).toBe(true);
  });
  it('never creates a second pending cycle alongside a legacy whole-job link', async () => {
    const db = new StaffingDatabase();
    await seedLegacyRequest(db);
    const before = structuredClone(db.tables.staffing_requests);
    expect((await sendRequest(db)).status).toBe(409);
    expect(db.tables.staffing_requests).toEqual(before);
    expect(db.deliveries).toHaveLength(0);
  });

  it.each(['email', 'whatsapp'])('refreshes legacy identity, invalidates its old %s link and pins the resent scope', async channel => {
    const db = new StaffingDatabase();
    const row = await seedLegacyRequest(db);
    const queryLink = await staffingClickRequest(row);
    const params = new URL(queryLink.url).searchParams;
    const oldLink = channel === 'email' ? queryLink : new Request(`https://edge.example.test/staffing-click/confirm/${row.id}/${params.get('t')}`);
    expect((await sendRequest(db, { resend_request_id: row.id })).status).toBe(200);
    expect(db.tables.staffing_requests).toHaveLength(1);
    expect(db.tables.staffing_requests[0]).toMatchObject({ id: 'legacy', single_day: false, batch_id: null });
    db.tables.jobs[0].end_time = '2026-10-23T18:00:00Z';
    await loadStaffingHandler('staffing-click', db)(oldLink);
    expect(db.tables.staffing_requests[0].status).toBe('pending');
    expect(db.tables.job_assignments).toHaveLength(0);
    await confirmRequest(db);
    expect(db.tables.timesheets.map(row => row.date)).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('resends the complete pending availability batch by any member identity after job extension', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db, { phase: 'availability' });
    const original = structuredClone(db.tables.staffing_requests);
    db.tables.jobs[0].end_time = '2026-10-23T18:00:00Z';
    expect((await sendRequest(db, { phase: 'availability', resend_request_id: original[1].id, target_date: '2026-10-21', single_day: true })).status).toBe(200);
    expect(db.deliveries).toHaveLength(2);
    expect(db.tables.staffing_requests.map(row => [row.id, row.target_date, row.batch_id])).toEqual(original.map(row => [row.id, row.target_date, row.batch_id]));
    await confirmRequest(db);
    expect(db.tables.staffing_requests.every(row => row.status === 'confirmed')).toBe(true);
    expect(db.tables.job_assignments).toHaveLength(0);
  });

  it.each([
    { job_id: 'other-job' }, { profile_id: 'other-tech' }, { phase: 'availability' },
  ])('does not reuse a request from a different scope: %j', async scope => {
    const db = new StaffingDatabase();
    await seedLegacyRequest(db);
    // The job/profile lookup precedes the identity check; supply valid fixtures.
    db.tables.jobs.push({ ...db.tables.jobs[0], id: 'other-job' });
    db.tables.profiles.push({ ...db.tables.profiles[0], id: 'other-tech' });
    expect((await sendRequest(db, { resend_request_id: 'legacy', ...scope })).status).toBe(409);
    expect(db.deliveries).toHaveLength(0);
    expect(db.tables.staffing_requests).toHaveLength(1);
  });

  it('does not revive a cancelled cycle through its old resend identity', async () => {
    const db = new StaffingDatabase();
    const row = await seedLegacyRequest(db);
    row.status = 'expired';
    expect((await sendRequest(db, { resend_request_id: row.id })).status).toBe(409);
    expect(db.deliveries).toHaveLength(0);
    expect(row.status).toBe('expired');
  });

  it('cannot recreate a batch cancelled between scope lookup and credential refresh', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db, { phase: 'availability' });
    const ids = db.tables.staffing_requests.map(row => row.id);
    db.afterQuery = query => {
      if (query.table === 'staffing_requests' && query.operation === 'select' && query.columns === 'id,target_date') {
        db.tables.staffing_requests.forEach(row => { row.status = 'expired'; });
        db.afterQuery = undefined;
      }
    };
    expect((await sendRequest(db, { phase: 'availability', resend_request_id: ids[0] })).status).toBe(409);
    expect(db.tables.staffing_requests.map(row => row.id)).toEqual(ids);
    expect(db.tables.staffing_requests.every(row => row.status === 'expired')).toBe(true);
    expect(db.deliveries).toHaveLength(1);
  });

  it('never publishes a legacy resend when its durable consent snapshot cannot be saved', async () => {
    const db = new StaffingDatabase();
    await seedLegacyRequest(db);
    const before = structuredClone(db.tables.staffing_requests);
    db.failures['staffing_events:insert'] = 'snapshot unavailable';
    expect((await sendRequest(db, { resend_request_id: 'legacy' })).status).toBe(500);
    expect(db.deliveries).toHaveLength(0);
    expect(db.tables.staffing_requests).toEqual(before);
  });

  it('retains durable legacy coverage even if the later delivery log write fails', async () => {
    const db = new StaffingDatabase();
    await seedLegacyRequest(db);
    db.afterQuery = query => {
      if (query.table === 'staffing_events' && query.operation === 'insert' && query.rows[0]?.event === 'request_scope') {
        db.failures['staffing_events:insert'] = 'delivery log unavailable';
        db.afterQuery = undefined;
      }
    };
    expect((await sendRequest(db, { resend_request_id: 'legacy' })).status).toBe(200);
    delete db.failures['staffing_events:insert'];
    db.tables.jobs[0].end_time = '2026-10-23T18:00:00Z';
    await confirmRequest(db);
    expect(db.tables.timesheets.map(row => row.date)).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('rejects a changed role without refreshing legacy credentials or delivering a new offer', async () => {
    const db = new StaffingDatabase();
    await seedLegacyRequest(db);
    const before = structuredClone(db.tables.staffing_requests);
    expect((await sendRequest(db, { resend_request_id: 'legacy', role: 'SND-MON-R' })).status).toBe(409);
    expect(db.tables.staffing_requests).toEqual(before);
    expect(db.deliveries).toHaveLength(0);
  });

  it('retains the original legacy offer role when the resend payload omits it', async () => {
    const db = new StaffingDatabase();
    await seedLegacyRequest(db);
    expect((await sendRequest(db, { resend_request_id: 'legacy', role: null })).status).toBe(200);
    await confirmRequest(db);
    expect(db.tables.job_assignments[0]).toMatchObject({ sound_role: 'SND-FOH-R' });
    expect(db.tables.staffing_requests[0]).toMatchObject({ role_code: 'SND-FOH-R' });
  });
});
