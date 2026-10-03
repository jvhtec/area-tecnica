import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { campaignHarnessCore } from './campaignHarnessCore';
import { readDisposableCampaignTarget, verifyDisposableCampaignTarget } from './disposableCampaignTarget';
import { observeLocalAssignmentWrites } from './observeLocalAssignmentWrites';

const tables = ['jobs','staffing_requests','job_assignments','timesheets','profiles','activity_log','notification_inbox','push_delivery_attempts'];
const docker = (...args: string[]) => execFileSync('docker', args, { encoding:'utf8', timeout:15_000, maxBuffer:64 * 1024 * 1024 });

/** Faults require a separately labelled disposable clone, never the historical entry point. */
export function disposableCampaignHarness(extraHandlers: string[] = []) {
  let installed = false;
  let transport: ReturnType<typeof observeLocalAssignmentWrites>;
  const h = campaignHarnessCore(extraHandlers, { mode:'disposable',
    wrapFetch(fetch) { transport = observeLocalAssignmentWrites(fetch); return transport.fetch; },
    async beforeJobDelete(marker, assertFresh) {
      if (!installed) return;
      assertFresh();
      await sql(`DELETE FROM local_matrix_fault.owned_dates WHERE marker='${marker}';`, assertFresh);
    },
  });
  const target = h.target as ReturnType<typeof readDisposableCampaignTarget>;
  const ownedMarker = h.marker;
  async function sql(query: string, assertFresh: () => void) {
    // Docker CLI interruption cannot prove remote psql completion. Preserve
    // fixtures and latch uncertainty on any driver failure, independently of
    // the completed callback classification in the runtime fence.
    await h.runGuardedMutation(async () => { verifyDisposableCampaignTarget(target, docker); });
    // Inspections are synchronous but individually bounded; their cumulative
    // time can exceed the fence. A known deadline refusal stays retryable.
    assertFresh();
    return h.runGuardedMutation(async () => {
      return docker('exec', target.database, 'psql', '-h','/var/run/postgresql', '-XqAt', '-v','ON_ERROR_STOP=1', '-U','postgres','-d','postgres','-c', query).trim();
    });
  }
  async function prepare() {
    await h.prepare();
    await h.withCleanupFence(async assertFresh => {
      if (await sql("SELECT count(*) FROM pg_namespace WHERE nspname='local_matrix_fault';", assertFresh) !== '0') {
        throw new Error('Existing disposable fault guard requires manual owned-fixture recovery');
      }
    });
  }
  async function armFault(jobId: string, technicianId: string, callerId: string, date: string) {
    h.assertFixtureSafe();
    for (const id of [jobId, technicianId, callerId]) if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid owned fault UUID');
    if (!h.ownsJob(jobId) || !h.ownsUser(technicianId) || !h.ownsUser(callerId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Fault must target this run’s owned tuple');
    }
    await h.withCleanupFence(async assertFresh => {
      if (!installed) {
        assertFresh();
        const fixture = readFileSync(resolve('tests/assignments/fixtures/matrix-disposable-fault.sql'), 'utf8');
        await sql(fixture.replace('__OWNED_MARKER__', ownedMarker), assertFresh);
        installed = true;
        // Prove the temporary privileged lookup has no API-role entry point.
        expect(await sql(`SELECT bool_or(
          has_schema_privilege(name,'local_matrix_fault','USAGE') OR
          has_table_privilege(name,'local_matrix_fault.owned_dates','SELECT') OR
          has_function_privilege(name,'local_matrix_fault.reject_owned_date()','EXECUTE'))
          FROM unnest(ARRAY['anon','authenticated','service_role']) AS api_role(name);`, assertFresh)).toBe('f');
      }
      assertFresh();
      expect(await sql(`INSERT INTO local_matrix_fault.owned_dates(job_id,technician_id,caller_id,fail_date,marker)
        SELECT id,'${technicianId}','${callerId}','${date}',title FROM public.jobs
        WHERE id='${jobId}' AND title='${ownedMarker}' RETURNING job_id;`, assertFresh)).toBe(jobId);
    });
  }
  async function finish() {
    if (!installed) return;
    h.assertFixtureSafe();
    await h.withCleanupFence(async assertFresh => {
      expect(await sql(`SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='local_matrix_fault';`, assertFresh)).toBe(ownedMarker);
      expect(await sql('SELECT count(*) FROM local_matrix_fault.owned_dates;', assertFresh)).toBe('0');
      assertFresh();
      await sql('BEGIN; DROP TRIGGER local_matrix_owned_date_failure ON public.timesheets; DROP SCHEMA local_matrix_fault CASCADE; COMMIT;', assertFresh);
      installed = false;
    });
  }
  // Read-only preservation of the original stack; mutation uses only target.database.
  function historicalFingerprint() {
    return tables.map(table => docker('exec','supabase_db_dev-history','psql','-h','/var/run/postgresql','-XqAt','-U','postgres','-d','postgres','-c',
      `SELECT count(*) || ':' || md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY t.id),'')) FROM public.${table} t;`).trim());
  }
  return { ...h, prepare, armFault, finish, historicalFingerprint,
    get cleanupSafe() { return h.cleanupSafe; }, get transportEvents() { return transport.events; } };
}
