import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

/**
 * A persistent psql connection inside the disposable Supabase DB container.
 * Each instance is one real backend, so tests control transaction boundaries
 * (BEGIN ... COMMIT) across sessions and observe genuine lock waits.
 */
export class PsqlSession {
  private process;
  private output = '';
  private errors = '';
  private pending?: { marker: string; resolve: (output: string) => void; reject: (error: Error) => void };

  constructor(container: string) {
    this.process = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-qAt',
      '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-U', 'postgres', '-d', 'postgres'], { stdio: 'pipe' });
    this.process.stdout.on('data', chunk => {
      this.output += String(chunk);
      if (this.pending && this.output.includes(this.pending.marker)) {
        const pending = this.pending;
        this.pending = undefined;
        pending.resolve(this.output.split(pending.marker)[0].trim());
      }
    });
    this.process.stderr.on('data', chunk => { this.errors += String(chunk); });
    this.process.on('error', error => { this.pending?.reject(error); this.pending = undefined; });
    this.process.on('exit', code => {
      this.pending?.reject(new Error(`psql exited ${code}: ${this.errors}`));
      this.pending = undefined;
    });
  }

  query(sql: string): Promise<string> {
    if (this.pending) throw new Error('Only one query per connection may be in flight');
    if (this.process.exitCode !== null) throw new Error(this.errors);
    this.output = '';
    const marker = `done_${randomUUID()}`;
    return new Promise((resolve, reject) => {
      this.pending = { marker, resolve, reject };
      this.process.stdin.write(`${sql}\n\\echo ${marker}\n`);
    });
  }

  async close() {
    if (this.process.exitCode !== null) return;
    const exited = new Promise<void>(resolve => this.process.once('exit', () => resolve()));
    this.process.stdin.end('\\q\n');
    await exited;
  }
}

/** Polls pg_stat_activity until `name` waits on a lock held by `blocker`. */
export async function waitUntilBlocked(observer: PsqlSession, name: string, blocker: string, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await observer.query(`SELECT EXISTS (
      SELECT 1 FROM pg_stat_activity a WHERE a.application_name = '${name}'
      AND EXISTS (SELECT 1 FROM pg_stat_activity b WHERE b.application_name = '${blocker}'
        AND b.pid = ANY(pg_blocking_pids(a.pid))));`);
    if (result === 't') return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Expected ${name} to wait on ${blocker}`);
}
