import { spawn } from 'node:child_process';

/** Hold only a synthetic campaign-role row, so a real tick keeps its run lock. */
export async function holdCampaignRole(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Expected a fixture UUID');
  const process = spawn('docker', ['exec', '-i', 'supabase_db_dev-history', 'psql', '-XqAt',
    '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  let errors = '';
  process.stderr.on('data', data => { errors += String(data); });
  const exited = new Promise<void>((resolve, reject) => {
    process.once('error', reject);
    process.once('exit', code => code === 0 ? resolve() : reject(new Error(`Fixture lock process exited (${code}): ${errors}`)));
  });
  // Attach immediately, including failures while waiting for the lock marker.
  exited.catch(() => undefined);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out acquiring fixture row lock')), 10_000);
      const observe = (data: Buffer) => {
        output += data.toString();
        if (output.includes('CAMPAIGN_ROLE_LOCKED')) { clearTimeout(timer); resolve(); }
      };
      process.stdout.on('data', observe);
      exited.then(() => { clearTimeout(timer); reject(new Error('Lock session ended before marker')); }, error => { clearTimeout(timer); reject(error); });
      process.stdin.write(`BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL idle_in_transaction_session_timeout='15s'; SELECT id FROM public.staffing_campaign_roles WHERE id='${id}' FOR UPDATE;\n\\echo CAMPAIGN_ROLE_LOCKED\n`);
    });
  } catch (error) {
    process.stdin.end('ROLLBACK;\n\\q\n');
    await exited.catch(() => undefined);
    throw error;
  }
  return async () => {
    process.stdin.end('ROLLBACK;\n\\q\n');
    await exited;
  };
}
