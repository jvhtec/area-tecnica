// @vitest-environment jsdom
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { edgeSnapshot } from './helpers/edgeSnapshot';
import { trackLocalFunctions } from './helpers/trackLocalFunctions';

describe('local Edge test observation safety', () => {
  it('walks filesystem dependencies in a browser test environment', () => {
    const sources = edgeSnapshot(['notify-staffing-cancellation/index.ts', 'push/index.ts']);
    expect(sources.has('_shared/auth.ts')).toBe(true);
    expect(sources.has('_shared/cors.ts')).toBe(true);
    expect(sources.has('push/inbox.ts')).toBe(true);
  });

  it('rejects an entry outside the function source tree', () => {
    expect(() => edgeSnapshot(['../../package.json'])).toThrow('Edge import escapes');
  });

  it.each(['reject', 'http'] as const)('distinguishes %s outcomes before allowing cleanup', async outcome => {
    const fetch = outcome === 'reject'
      ? vi.fn().mockRejectedValue(new Error('local test transport failed'))
      : vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403,
        headers: { 'Content-Type': 'application/json' } }));
    const client = createClient('http://127.0.0.1:54441', 'local-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `tracker-${outcome}` },
      global: { fetch },
    });
    const observer = trackLocalFunctions(client);
    try {
      await client.functions.invoke('push', { body: { action: 'broadcast' } });
      expect(observer.calls).toHaveLength(1);
      if (outcome === 'reject') {
        await expect(observer.drain()).rejects.toThrow('Function transport did not complete');
        expect(observer.transportComplete).toBe(false);
      } else {
        await observer.drain();
        expect(observer.transportComplete).toBe(true);
        expect((await observer.calls[0].result).error?.context.status).toBe(403);
      }
    } finally { observer.restore(); }
  });

  it('keeps cleanup unsafe while a handler response remains pending', async () => {
    let respond!: (response: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(resolve => { respond = resolve; }));
    const client = createClient('http://127.0.0.1:54441', 'local-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'tracker-pending' },
      global: { fetch },
    });
    const observer = trackLocalFunctions(client);
    const invocation = client.functions.invoke('push', { body: { action: 'broadcast' } });
    const drain = observer.drain();
    try {
      expect(observer.transportComplete).toBe(false);
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
      expect(observer.transportComplete).toBe(false);
    } finally {
      respond(new Response(JSON.stringify({ status: 'skipped' }), { headers: { 'Content-Type': 'application/json' } }));
      await invocation; await drain; observer.restore();
    }
    expect(observer.transportComplete).toBe(true);
  });

  it('drains the claim, subsequent function invocation and ledger report without replaying RPCs', async () => {
    let respondToClaim!: (response: Response) => void;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/rpc/claim_assignment_side_effects')) {
        return new Promise<Response>(resolve => { respondToClaim = resolve; });
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      }));
    });
    const client = createClient('http://127.0.0.1:54441', 'local-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'tracker-claim' },
      global: { fetch },
    });
    const observer = trackLocalFunctions(client);
    const effects = (async () => {
      await client.rpc('claim_assignment_side_effects');
      await client.functions.invoke('push', { body: { action: 'broadcast' } });
      await client.rpc('record_assignment_side_effects');
    })();
    let drained = false;
    const drain = observer.drain().then(() => { drained = true; });
    try {
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
      await Promise.resolve();
      expect(drained).toBe(false);
      expect(observer.transportComplete).toBe(false);
    } finally {
      respondToClaim(new Response(JSON.stringify({ claim_token: 'local-claim' }), {
        headers: { 'Content-Type': 'application/json' },
      }));
      await effects;
      await drain;
      observer.restore();
    }
    expect(observer.calls).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(observer.transportComplete).toBe(true);
  });

  it.each(['reject', 'sql'] as const)('distinguishes RPC %s outcomes before allowing cleanup', async outcome => {
    const fetch = outcome === 'reject'
      ? vi.fn().mockRejectedValue(new Error('local RPC transport failed'))
      : vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: '42501', message: 'permission denied' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      }));
    const client = createClient('http://127.0.0.1:54441', 'local-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `tracker-rpc-${outcome}` },
      global: { fetch },
    });
    const observer = trackLocalFunctions(client);
    try {
      await client.rpc('claim_assignment_side_effects');
      if (outcome === 'reject') {
        await expect(observer.drain()).rejects.toThrow('Function transport did not complete');
        expect(observer.transportComplete).toBe(false);
      } else {
        await observer.drain();
        expect(observer.transportComplete).toBe(true);
      }
      expect(fetch).toHaveBeenCalledOnce();
    } finally { observer.restore(); }
  });
});
