import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Read-only preflight. Both migrations must precede the new staffing-click.
export const staffingPrerequisiteQuery = `SELECT
  pg_catalog.to_regprocedure('public.assign_staffing_offer(uuid,date[],boolean,text)') IS NOT NULL
  AND pg_catalog.to_regprocedure('public.remove_assignment_with_timesheets(uuid,uuid)') IS NOT NULL
  AND EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261002082653')
  AND EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261002105500')
  AS ready`;

export async function checkStaffingDeployment({ projectRef, slugs, source, accessToken, fetchImpl = fetch }) {
  if (!slugs.split(/\s+/).includes('staffing-click')) return;
  // A deliberate rollback to a handler predating the RPC has no new dependency.
  if (!/\.rpc\(\s*['"]assign_staffing_offer['"]/.test(source)) return;
  if (!/^[a-z]{20}$/.test(projectRef)) throw new Error('Invalid deployment project ref');
  if (!accessToken) throw new Error('SUPABASE_ACCESS_TOKEN is required for the staffing preflight');
  const response = await fetchImpl(`https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: staffingPrerequisiteQuery }),
    signal: AbortSignal.timeout(30_000),
  });
  // Do not log response bodies: management API errors may contain project details.
  if (!response.ok) throw new Error(`Staffing database preflight failed (HTTP ${response.status})`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.ready !== true) {
    throw new Error('Refusing staffing-click deployment: apply and verify both PR990 migrations first');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const slugs = process.env.SLUGS ?? '';
    const source = slugs.split(/\s+/).includes('staffing-click')
      ? await readFile('supabase/functions/staffing-click/index.ts', 'utf8') : '';
    await checkStaffingDeployment({ projectRef: process.env.PROJECT_REF ?? '', slugs, source,
      accessToken: process.env.SUPABASE_ACCESS_TOKEN });
    console.log('Staffing database deployment prerequisites checked');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Staffing database preflight failed');
    process.exitCode = 1;
  }
}
