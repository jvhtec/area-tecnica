import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

// In-memory PostgREST boundary. The real handlers and their local helpers run below;
// remote services, authentication and rate limits are stubbed, with no network/DB IO.
export class StaffingDatabase {
  tables: Record<string, Row[]> = {
    jobs: [{ id: 'job', title: 'Bolo', start_time: '2026-10-20T08:00:00Z', end_time: '2026-10-21T18:00:00Z', job_type: 'single', job_date_types: [], tour_date: null }],
    profiles: [{ id: 'tech', first_name: 'Ana', email: 'ana@example.test', department: 'sound' }],
    staffing_requests: [], staffing_events: [], job_assignments: [], timesheets: [],
  };
  failures: Record<string, string> = {};
  deliveries: Row[] = [];
  writes: Array<{ table: string; operation: string; rows: Row[]; input: Row[] }> = [];
  supportsRoleCode = true;

  from(table: string) {
    this.tables[table] ??= [];
    let operation = 'select';
    let payload: Row[] = [];
    let keys: string[] = [];
    let single = false;
    let max = Infinity;
    let descending = false;
    let columns = '';
    const filters: Filter[] = [];
    const query = {
      select: (value?: string, _options?: unknown) => { columns = value ?? ''; return query; },
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
      neq: (key: string, value: unknown) => { filters.push(row => row[key] !== value); return query; },
      in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
      gte: (key: string, value: unknown) => { filters.push(row => String(row[key] ?? '') >= String(value ?? '')); return query; },
      contains: (key: string, value: Row) => { filters.push(row => Object.entries(value).every(([k, v]) => (row[key] as Row | null)?.[k] === v)); return query; },
      or: (_expression: string) => query,
      order: (_key: string, options?: { ascending?: boolean }) => { descending = options?.ascending === false; return query; },
      limit: (value: number) => { max = value; return query; },
      maybeSingle: () => { single = true; return query; },
      single: () => { single = true; return query; },
      insert: (value: Row | Row[], _options?: unknown) => { operation = 'insert'; payload = Array.isArray(value) ? value : [value]; return query; },
      update: (value: Row) => { operation = 'update'; payload = [value]; return query; },
      upsert: (value: Row | Row[], options: { onConflict: string }) => { operation = 'upsert'; payload = Array.isArray(value) ? value : [value]; keys = options.onConflict.split(','); return query; },
      then: (fulfilled: (result: Row) => unknown, rejected?: (reason: unknown) => unknown) => {
        const execute = () => {
          const failure = this.failures[`${table}:${operation}`];
          if (failure) return { data: null, error: { code: 'XX000', message: failure }, count: 0 };
          if (!this.supportsRoleCode && table === 'staffing_requests' && columns.includes('role_code')) return { data: null, error: { code: '42703', message: 'Missing role_code' }, count: 0 };
          let rows = this.tables[table].filter(row => filters.every(filter => filter(row)));
          if (operation === 'insert') {
            if (table === 'staffing_requests' && payload.some(incoming => this.tables[table].some(row =>
              row.status === 'pending' && incoming.status === 'pending' && row.job_id === incoming.job_id && row.profile_id === incoming.profile_id && row.phase === incoming.phase &&
              (row.single_day === true && incoming.single_day === true ? row.target_date === incoming.target_date : row.single_day === incoming.single_day)
            ))) return { data: null, error: { code: '23505', message: 'duplicate key' }, count: 0 };
            rows = payload.map(row => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), is_active: true, ...row }));
            this.tables[table].push(...rows);
          } else if (operation === 'update') {
            rows.forEach(row => Object.assign(row, payload[0]));
          } else if (operation === 'upsert') {
            rows = payload.map(incoming => {
              const existing = this.tables[table].find(row => keys.every(key => row[key] === incoming[key]));
              if (existing) { Object.assign(existing, incoming); return existing; }
              const row = { id: crypto.randomUUID(), is_active: true, ...incoming };
              this.tables[table].push(row);
              return row;
            });
          }
          if (operation !== 'select') this.writes.push({ table, operation, rows: structuredClone(rows), input: structuredClone(payload) });
          if (descending) rows = [...rows].reverse();
          rows = rows.slice(0, max);
          // Responses are snapshots, as with the real HTTP boundary.
          return { data: structuredClone(single ? rows[0] ?? null : rows), error: null, count: rows.length };
        };
        return Promise.resolve().then(execute).then(fulfilled, rejected);
      },
    };
    return query;
  }
  rpc = async (_name: string, _args?: Row) => ({ data: {}, error: null });
}

export function loadStaffingHandler(kind: 'send-staffing-email' | 'staffing-click', db: StaffingDatabase) {
  let handler: (request: Request) => Promise<Response>;
  const cache = new Map<string, Row>();
  const environment: Row = {
    SUPABASE_URL: 'https://supabase.example.test', SUPABASE_SERVICE_ROLE_KEY: 'service',
    STAFFING_TOKEN_SECRET: 'test-secret', BREVO_API_KEY: 'test', BREVO_FROM: 'ops@example.test',
  };
  const sharedMocks: Record<string, Row> = {
    'auth.ts': { isServiceRoleRequest: () => true, requireAdminOrManagement: async () => ({ userId: 'manager' }) },
    'structuredLogger.ts': { logEvent: () => undefined },
    'rateLimit.ts': { checkEdgeRateLimit: async () => ({ allowed: true }), rateLimitHeaders: () => ({}) },
    'brevo.ts': { sendBrevoEmail: async (_key: string, payload: Row) => { db.deliveries.push(payload); return new Response('{}', { status: 200 }); } },
  };
  const load = (path: string): Row => {
    if (cache.has(path)) return cache.get(path)!;
    const exports: Row = {};
    cache.set(path, exports);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: path,
    }).outputText;
    runInNewContext(code, {
      exports,
      require: (specifier: string) => {
        if (specifier.startsWith('https://deno.land/')) return { serve: (fn: typeof handler) => { handler = fn; } };
        if (specifier === 'npm:@supabase/supabase-js@2') return { createClient: () => db };
        if (specifier.startsWith('../_shared/')) {
          const mock = sharedMocks[specifier.split('/').at(-1)!];
          if (mock) return mock;
        }
        if (!specifier.startsWith('.')) throw new Error(`Unmocked dependency: ${specifier}`);
        return load(resolve(dirname(path), specifier));
      },
      Deno: { env: { get: (key: string) => environment[key] } },
      EdgeRuntime: { waitUntil: (_task: Promise<unknown>) => undefined },
      crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, URL, URLSearchParams, Request, Response, Headers,
      AbortController, setTimeout, clearTimeout, btoa, atob,
      fetch: async () => new Response('{}', { status: 200 }),
      console: { log: () => undefined, warn: () => undefined, error: () => undefined, info: () => undefined },
    });
    return exports;
  };
  load(resolve('supabase/functions', kind, 'index.ts'));
  return (request: Request) => handler(request);
}

export async function sendRequest(db: StaffingDatabase, body: Row = {}) {
  return loadStaffingHandler('send-staffing-email', db)(new Request('https://edge.example.test/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer service' },
    body: JSON.stringify({ job_id: 'job', profile_id: 'tech', phase: 'offer', role: 'SND-FOH-R', department: 'sound', ...body }),
  }));
}

export async function confirmRequest(db: StaffingDatabase, row = db.tables.staffing_requests[0]) {
  const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode('test-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await webcrypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${row.id}:${row.phase}:${row.token_expires_at}`)));
  const token = Buffer.from(signature).toString('base64url');
  return loadStaffingHandler('staffing-click', db)(new Request(`https://edge.example.test/click?rid=${row.id}&a=confirm&exp=${encodeURIComponent(String(row.token_expires_at))}&t=${token}`));
}
