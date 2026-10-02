import { describe, expect, it } from 'vitest';
import { createStaffingRequestToken } from '../persistRequests';
import { confirmRequest, loadStaffingHandler, sendRequest, staffingClickRequest, StaffingDatabase } from './staffingHandlerHarness';

describe('stored staffing link credentials', () => {
  it('still accepts a historical incorrect-ID signature when the supplied credential matches its stored hash', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db, { dates: ['2026-10-20'] });
    const row = db.tables.staffing_requests[0];
    const credentials = await createStaffingRequestToken('test-secret', 'historically-wrong-id', String(row.phase), String(row.token_expires_at));
    row.token_hash = credentials.token_hash;
    const url = new URL((await staffingClickRequest(row)).url);
    url.searchParams.set('t', credentials.token);
    await loadStaffingHandler('staffing-click', db)(new Request(url));
    expect(row.status).toBe('confirmed');
    expect(db.tables.timesheets.map(row => row.date)).toEqual(['2026-10-20']);
  });

  it('a query expiry cannot prolong a valid stored credential beyond the request expiry', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db, { dates: ['2026-10-20'] });
    const link = await staffingClickRequest(db.tables.staffing_requests[0]);
    db.tables.staffing_requests[0].token_expires_at = '2020-01-01T00:00:00Z';
    await loadStaffingHandler('staffing-click', db)(link);
    expect(db.tables.staffing_requests[0].status).toBe('pending');
    expect(db.tables.job_assignments).toHaveLength(0);
  });

  it('rejects a substituted token on path links even when the current row HMAC could be recomputed', async () => {
    const db = new StaffingDatabase();
    await sendRequest(db, { dates: ['2026-10-20'] });
    const row = db.tables.staffing_requests[0];
    await loadStaffingHandler('staffing-click', db)(new Request(`https://edge.example.test/staffing-click/confirm/${row.id}/aW52YWxpZA`));
    expect(row.status).toBe('pending');
    expect(db.tables.job_assignments).toHaveLength(0);
    await confirmRequest(db);
    expect(row.status).toBe('confirmed');
  });
});
