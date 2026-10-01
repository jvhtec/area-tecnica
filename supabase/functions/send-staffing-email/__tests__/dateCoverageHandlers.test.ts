import { describe, expect, it } from 'vitest';
import { confirmRequest, sendRequest, StaffingDatabase } from './staffingHandlerHarness';

const dates = (db: StaffingDatabase) => db.tables.timesheets.filter(row => row.job_id === 'job' && row.is_active).map(row => row.date).sort();

describe('staffing date coverage through the send and click handlers', () => {
  it('freezes a new full-job request before the job is extended', async () => {
    const db = new StaffingDatabase();
    expect((await sendRequest(db)).status).toBe(200);
    db.tables.jobs[0].end_time = '2026-10-23T18:00:00Z';
    await confirmRequest(db);
    expect(dates(db)).toEqual(['2026-10-20', '2026-10-21']);
    expect(db.tables.job_assignments[0]).toMatchObject({ single_day: false, assignment_date: null });
  });

  it('persists a one-date full job as an explicit date snapshot', async () => {
    const db = new StaffingDatabase();
    db.tables.jobs[0].end_time = '2026-10-20T18:00:00Z';
    expect((await sendRequest(db)).status).toBe(200);
    expect(db.tables.staffing_requests).toHaveLength(1);
    expect(db.tables.staffing_requests[0]).toMatchObject({ single_day: true, target_date: '2026-10-20' });
    db.tables.jobs[0].end_time = '2026-10-22T18:00:00Z';
    await confirmRequest(db);
    expect(dates(db)).toEqual(['2026-10-20']);
  });

  it('snapshots Madrid calendar dates across the autumn DST transition', async () => {
    const db = new StaffingDatabase();
    Object.assign(db.tables.jobs[0], { start_time: '2026-10-23T22:30:00Z', end_time: '2026-10-25T23:30:00Z' });
    expect((await sendRequest(db)).status).toBe(200);
    expect(db.tables.staffing_requests.map(row => row.target_date)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });

  it('uses canonical typed work dates, including prep and tour dates but excluding off/travel', async () => {
    const db = new StaffingDatabase();
    db.tables.jobs[0].job_date_types = [
      { date: '2026-10-18', type: 'prep_day' }, { date: '2026-10-20', type: 'off' },
      { date: '2026-10-21', type: 'show' }, { date: '2026-10-22', type: 'travel' },
      { date: '2026-10-23', type: 'setup' },
    ];
    db.tables.jobs[0].tour_date = { date: '2026-10-21', start_date: '2026-10-20', end_date: '2026-10-21', tour_date_type: 'show' };
    expect((await sendRequest(db)).status).toBe(200);
    expect(db.tables.staffing_requests.map(row => row.target_date)).toEqual(['2026-10-18', '2026-10-21', '2026-10-23']);
  });

  it('full-job sends subtract only confirmed active scheduled dates', async () => {
    const db = new StaffingDatabase();
    db.tables.jobs[0].end_time = '2026-10-23T18:00:00Z';
    db.tables.job_assignments.push({ job_id: 'job', technician_id: 'tech', status: 'confirmed', single_day: false, assignment_date: null });
    db.tables.timesheets.push(
      { job_id: 'job', technician_id: 'tech', date: '2026-10-20', is_active: true },
      { job_id: 'job', technician_id: 'tech', date: '2026-10-21', is_active: false },
      { job_id: 'job', technician_id: 'someone-else', date: '2026-10-22', is_active: true },
    );
    expect((await sendRequest(db)).status).toBe(200);
    expect(db.tables.staffing_requests.map(row => row.target_date)).toEqual(['2026-10-21', '2026-10-22', '2026-10-23']);
  });

  it('does not treat invited membership dates as confirmed coverage', async () => {
    const db = new StaffingDatabase();
    db.tables.job_assignments.push({ job_id: 'job', technician_id: 'tech', status: 'invited' });
    db.tables.timesheets.push({ job_id: 'job', technician_id: 'tech', date: '2026-10-20', is_active: true });
    expect((await sendRequest(db)).status).toBe(200);
    expect(db.tables.staffing_requests.map(row => row.target_date)).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('keeps an explicit subset unchanged for an already assigned technician', async () => {
    const db = new StaffingDatabase();
    db.tables.job_assignments.push({ job_id: 'job', technician_id: 'tech', status: 'confirmed', single_day: false, assignment_date: null });
    db.tables.timesheets.push({ job_id: 'job', technician_id: 'tech', date: '2026-10-20', is_active: true });
    expect((await sendRequest(db, { dates: ['2026-10-20', '2026-10-22'] })).status).toBe(200);
    expect(db.tables.staffing_requests.map(row => row.target_date)).toEqual(['2026-10-20', '2026-10-22']);
  });

  it('rejects overlapping pending coverage without rebatching or refreshing unrelated rows', async () => {
    const db = new StaffingDatabase();
    expect((await sendRequest(db, { dates: ['2026-10-20', '2026-10-23'] })).status).toBe(200);
    const original = structuredClone(db.tables.staffing_requests);
    const response = await sendRequest(db, { dates: ['2026-10-20', '2026-10-21'] });
    expect(response.status).toBe(409);
    expect(db.tables.staffing_requests).toEqual(original);
    expect(db.deliveries).toHaveLength(1);
  });

  it('does not silently drop pending dates when calculating uncovered full-job dates', async () => {
    const db = new StaffingDatabase();
    expect((await sendRequest(db, { single_day: true, target_date: '2026-10-20' })).status).toBe(200);
    const response = await sendRequest(db);
    expect(response.status).toBe(409);
    expect(db.deliveries).toHaveLength(1);
  });

  it('checks every accepted batch date for conflicts before creating a membership', async () => {
    const db = new StaffingDatabase();
    expect((await sendRequest(db, { dates: ['2026-10-20', '2026-10-21'] })).status).toBe(200);
    db.tables.timesheets.push({ job_id: 'other-job', technician_id: 'tech', date: '2026-10-21', is_active: true });
    await confirmRequest(db);
    expect(db.tables.job_assignments).toEqual([]);
    expect(dates(db)).toEqual([]);
    expect(db.tables.staffing_events.some(row => row.event === 'auto_assign_skipped_conflict')).toBe(true);
  });

  it('appends and reactivates only added subset dates while preserving old membership and timesheet data', async () => {
    const db = new StaffingDatabase();
    db.tables.job_assignments.push({ job_id: 'job', technician_id: 'tech', status: 'confirmed', single_day: true, assignment_date: '2026-10-18' });
    const original = { job_id: 'job', technician_id: 'tech', date: '2026-10-18', is_active: true, source: 'staffing', notes: 'Existing prep work', status: 'approved', start_time: '08:00' };
    db.tables.timesheets.push(original, { job_id: 'job', technician_id: 'tech', date: '2026-10-22', is_active: false, notes: 'Retain this note' });
    expect((await sendRequest(db, { dates: ['2026-10-22', '2026-10-23'] })).status).toBe(200);
    await confirmRequest(db);
    expect(db.tables.job_assignments[0]).toMatchObject({ single_day: true, assignment_date: '2026-10-18' });
    expect(dates(db)).toEqual(['2026-10-18', '2026-10-22', '2026-10-23']);
    expect(db.tables.timesheets.find(row => row.date === '2026-10-18')).toEqual(original);
    expect(db.tables.timesheets.find(row => row.date === '2026-10-22')).toMatchObject({ is_active: true, notes: 'Retain this note' });
  });

  it('marks a new multi-date membership as multi-day', async () => {
    const db = new StaffingDatabase();
    expect((await sendRequest(db, { dates: ['2026-10-20', '2026-10-22'] })).status).toBe(200);
    await confirmRequest(db);
    expect(db.tables.job_assignments[0]).toMatchObject({ single_day: false, assignment_date: null });
    expect(dates(db)).toEqual(['2026-10-20', '2026-10-22']);
  });

  it.each([
    { dates: ['2026-10-20'] },
    { dates: ['2026-10-20', '2026-10-22'] },
  ])('refreshes only an identical pending cycle and signs its existing request ID: %j', async body => {
    const db = new StaffingDatabase();
    expect((await sendRequest(db, body)).status).toBe(200);
    const original = structuredClone(db.tables.staffing_requests);
    db.tables.staffing_requests[0].token_expires_at = '2020-01-01T00:00:00Z';
    expect((await sendRequest(db, body)).status).toBe(200);
    expect(db.tables.staffing_requests.map(row => [row.id, row.target_date, row.batch_id])).toEqual(original.map(row => [row.id, row.target_date, row.batch_id]));
    expect(db.tables.staffing_requests.map(row => row.token_expires_at)).toEqual(body.dates.map(() => db.tables.staffing_requests[0].token_expires_at));
    expect(db.tables.staffing_requests.every(row => row.token_hash === db.tables.staffing_requests[0].token_hash)).toBe(true);
    expect(db.tables.staffing_requests.slice(1).map(row => row.idempotency_key)).toEqual(original.slice(1).map(row => row.idempotency_key));
    await confirmRequest(db);
    expect(dates(db)).toEqual(body.dates);
  });

  it('does not merge separate pending singles into a batch', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db, { dates: ['2026-10-20'] });
    await sendRequest(db, { dates: ['2026-10-21'] });
    const original = structuredClone(db.tables.staffing_requests);
    expect((await sendRequest(db, { dates: ['2026-10-20', '2026-10-21'] })).status).toBe(409);
    expect(db.tables.staffing_requests).toEqual(original);
  });

  it('does not reuse matching dates from a different pending offer role', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db, { dates: ['2026-10-20'] });
    const original = structuredClone(db.tables.staffing_requests);
    expect((await sendRequest(db, { dates: ['2026-10-20'], role: 'SND-MON-R' })).status).toBe(409);
    expect(db.tables.staffing_requests).toEqual(original);
  });

  it('returns non-overridable Spanish reasons when all dates are covered or pending elsewhere', async () => {
    const db = new StaffingDatabase();
    db.tables.job_assignments.push({ job_id: 'job', technician_id: 'tech', status: 'confirmed' });
    db.tables.timesheets.push(...['2026-10-20', '2026-10-21'].map(date => ({ job_id: 'job', technician_id: 'tech', date, is_active: true })));
    const covered = await sendRequest(db);
    expect(covered.status).toBe(409);
    expect(await covered.json()).toEqual({ error: 'No hay fechas de trabajo pendientes de solicitar.', details: { reason: 'no_uncovered_dates' } });
    await sendRequest(db, { dates: ['2026-10-22'] });
    const collision = await sendRequest(db, { dates: ['2026-10-22', '2026-10-23'] });
    expect(collision.status).toBe(409);
    expect(await collision.json()).toEqual({ error: 'Ya existe una solicitud pendiente para algunas de las fechas seleccionadas.', details: { reason: 'pending_request' } });
  });

  it('explicit single-day confirmation reactivates a voided row without touching other dates', async () => {
    const db = new StaffingDatabase();
    db.tables.job_assignments.push({ job_id: 'job', technician_id: 'tech', status: 'confirmed', single_day: false, assignment_date: null });
    db.tables.timesheets.push(
      { job_id: 'job', technician_id: 'tech', date: '2026-10-20', is_active: false, notes: 'Retain note' },
      { job_id: 'job', technician_id: 'tech', date: '2026-10-21', is_active: false },
    );
    await sendRequest(db, { single_day: true, target_date: '2026-10-20' });
    await confirmRequest(db);
    expect(dates(db)).toEqual(['2026-10-20']);
    expect(db.tables.timesheets[0]).toMatchObject({ is_active: true, notes: 'Retain note' });
    expect(db.tables.timesheets[1].is_active).toBe(false);
    const membershipWrite = db.writes.find(write => write.table === 'job_assignments');
    expect(membershipWrite).toBeDefined();
    expect(db.tables.job_assignments[0]).toMatchObject({ single_day: false, assignment_date: null });
  });

  it('pins legacy requests to their earliest successful explicit delivery snapshot', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db);
    const head = db.tables.staffing_requests[0];
    Object.assign(head, { single_day: false, target_date: null, batch_id: null });
    db.tables.staffing_requests = [head];
    db.tables.jobs[0].end_time = '2026-10-23T18:00:00Z';
    db.tables.staffing_events.push(
      { staffing_request_id: head.id, event: 'email_sent', meta: { phase: 'offer', status: 200, role: 'SND-FOH-R', dates: ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'] } },
      { staffing_request_id: head.id, event: 'email_sent', meta: { phase: 'offer', status: 200, role: 'SND-FOH-R', dates: [] } },
    );
    await confirmRequest(db);
    expect(dates(db)).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('retains current-span compatibility for legacy pending requests with no snapshot', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db);
    const head = db.tables.staffing_requests[0];
    Object.assign(head, { single_day: false, target_date: null, batch_id: null });
    db.tables.staffing_requests = [head];
    db.tables.staffing_events.forEach(event => { if (event.meta) (event.meta as Record<string, unknown>).dates = []; });
    db.tables.jobs[0].end_time = '2026-10-23T18:00:00Z';
    await confirmRequest(db);
    expect(dates(db)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
  });

  it('avoids prep-trigger update columns while extending confirmed membership', async () => {
    const db = new StaffingDatabase();
    db.tables.jobs[0].job_date_types = [{ date: '2026-10-18', type: 'prep_day' }];
    db.tables.job_assignments.push({ job_id: 'job', technician_id: 'tech', status: 'confirmed', single_day: true, assignment_date: '2026-10-18' });
    db.tables.timesheets.push({ job_id: 'job', technician_id: 'tech', date: '2026-10-18', is_active: false, source: 'staffing' });
    await sendRequest(db, { dates: ['2026-10-22'] });
    await confirmRequest(db);
    const write = db.writes.find(item => item.table === 'job_assignments')!;
    expect(write.operation).toBe('update');
    for (const key of ['job_id', 'technician_id', 'status', 'single_day', 'assignment_date']) expect(write.input[0]).not.toHaveProperty(key);
    expect(dates(db)).toEqual(['2026-10-22']);
    expect(db.tables.timesheets[0].is_active).toBe(false);
  });

  it('availability snapshot resend does not require the optional role_code column', async () => {
    const db = new StaffingDatabase();
    db.supportsRoleCode = false;
    expect((await sendRequest(db, { phase: 'availability' })).status).toBe(200);
    expect((await sendRequest(db, { phase: 'availability' })).status).toBe(200);
    expect(db.tables.staffing_requests).toHaveLength(2);
    expect(db.tables.staffing_requests.every(row => row.phase === 'availability')).toBe(true);
  });

  it('scopes a previously declined prep membership to newly accepted dates', async () => {
    const db = new StaffingDatabase();
    db.tables.jobs[0].job_date_types = [{ date: '2026-10-18', type: 'prep_day' }];
    db.tables.job_assignments.push({ job_id: 'job', technician_id: 'tech', status: 'declined', single_day: true, assignment_date: '2026-10-18' });
    db.tables.timesheets.push({ job_id: 'job', technician_id: 'tech', date: '2026-10-18', is_active: false, source: 'staffing' });
    await sendRequest(db, { dates: ['2026-10-22'] });
    await confirmRequest(db);
    expect(db.tables.job_assignments[0]).toMatchObject({ status: 'confirmed', single_day: true, assignment_date: '2026-10-22' });
    expect(dates(db)).toEqual(['2026-10-22']);
    expect(db.tables.timesheets[0].is_active).toBe(false);
  });
});
