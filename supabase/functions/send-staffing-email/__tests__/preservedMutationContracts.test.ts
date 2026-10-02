import { describe, expect, it } from 'vitest';
import { confirmRequest, sendRequest, StaffingDatabase } from './staffingHandlerHarness';

// Phase 0's odd partial-commit outcomes are intentional characterization here.
// Date consent fixes must not silently introduce transactional or delivery redesign.
describe('preserved staffing mutation and failure contracts', () => {
  it.each(['confirm', 'decline'] as const)('availability %s records the response without assigning', async action => {
    const db = new StaffingDatabase();
    expect((await sendRequest(db, { phase: 'availability' })).status).toBe(200);
    await confirmRequest(db, db.tables.staffing_requests[0], action);
    expect(db.tables.staffing_requests.length).toBeGreaterThan(0);
    expect(db.tables.staffing_requests.every(row => row.status === (action === 'confirm' ? 'confirmed' : 'declined'))).toBe(true);
    expect(db.tables.job_assignments).toHaveLength(0);
    expect(db.tables.timesheets).toHaveLength(0);
  });

  it('retains persistence-before-delivery and cached identity after delivery failure', async () => {
    const db = new StaffingDatabase();
    db.deliveryStatus = 503;
    expect((await sendRequest(db, { idempotency_key: 'same-operation' })).status).toBe(503);
    expect(db.tables.staffing_requests.length).toBeGreaterThan(0);
    expect(db.tables.staffing_requests.every(row => row.status === 'pending')).toBe(true);
    expect(db.tables.job_assignments).toHaveLength(0);
    const persisted = structuredClone(db.tables.staffing_requests);
    db.deliveryStatus = 200;
    const retry = await sendRequest(db, { idempotency_key: 'same-operation' });
    expect(await retry.json()).toMatchObject({ success: true, cached: true });
    expect(db.deliveries).toHaveLength(1);
    expect(db.tables.staffing_requests).toEqual(persisted);
  });

  it('declined offers never create assignments and cannot be confirmed on a later click', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db);
    await confirmRequest(db, db.tables.staffing_requests[0], 'decline');
    const writes = db.writes.length;
    await confirmRequest(db);
    expect(db.tables.staffing_requests.every(row => row.status === 'declined')).toBe(true);
    expect(db.tables.job_assignments).toHaveLength(0);
    expect(db.tables.timesheets).toHaveLength(0);
    expect(db.writes).toHaveLength(writes);
  });

  it('a sequential duplicate confirmation performs no second mutation', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db);
    await confirmRequest(db);
    const writes = db.writes.length;
    await confirmRequest(db);
    expect(db.writes).toHaveLength(writes);
    expect(db.tables.job_assignments).toHaveLength(1);
    expect(db.tables.timesheets).toHaveLength(2);
  });

  it('assignment failure retains the confirmed response and creates no timesheets', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db);
    db.failures['job_assignments:upsert'] = 'assignment unavailable';
    await confirmRequest(db);
    expect(db.tables.staffing_requests.every(row => row.status === 'confirmed')).toBe(true);
    expect(db.tables.job_assignments).toHaveLength(0);
    expect(db.tables.timesheets).toHaveLength(0);
    expect(db.tables.staffing_events.some(row => row.event === 'auto_assign_upsert_error')).toBe(true);
  });

  it('timesheet failure retains the confirmed request and membership', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db);
    db.failures['timesheets:upsert'] = 'schedule unavailable';
    await confirmRequest(db);
    expect(db.tables.staffing_requests.every(row => row.status === 'confirmed')).toBe(true);
    expect(db.tables.job_assignments[0]).toMatchObject({ status: 'confirmed' });
    expect(db.tables.timesheets).toHaveLength(0);
  });

  it('external service failures after confirmation do not roll back the database writes', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db);
    db.externalStatus = 503;
    await confirmRequest(db);
    expect(db.tables.staffing_requests.every(row => row.status === 'confirmed')).toBe(true);
    expect(db.tables.job_assignments[0]).toMatchObject({ status: 'confirmed' });
    expect(db.tables.timesheets.map(row => row.date)).toEqual(['2026-10-20', '2026-10-21']);
  });
});
