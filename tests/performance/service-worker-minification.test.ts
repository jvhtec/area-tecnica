import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { minify } from 'terser';
import { describe, expect, it, vi } from 'vitest';

const original = readFileSync('public/sw.js', 'utf8').replaceAll('__BUILD_TIMESTAMP__', 'audit-build');
const compact = (await minify(original, { ecma: 2020, compress: { passes: 2 }, mangle: true })).code!;

function load(code: string) {
  const listeners = new Map<string, (event: unknown) => void>();
  const cache = { put: vi.fn(async () => undefined), match: vi.fn(async () => undefined), keys: vi.fn(async () => []), addAll: vi.fn(async () => undefined) };
  const caches = { open: vi.fn(async () => cache), keys: vi.fn(async () => ['old-cache']), delete: vi.fn(async () => true), match: vi.fn(async () => undefined) };
  const fetch = vi.fn(async () => ({ status: 200, type: 'basic', headers: new Headers({ 'content-type': 'text/html' }) }));
  const self = {
    location: new URL('https://app.test/sw.js'),
    registration: { scope: 'https://app.test/', showNotification: vi.fn(async () => undefined), setAppBadge: vi.fn(async () => undefined) },
    addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined), matchAll: vi.fn(async () => []) },
  };
  runInNewContext(code, { self, caches, fetch, URL, Headers, Response, AbortController, setTimeout, clearTimeout, console: { log() {}, warn() {}, error() {} } });
  return { listeners, caches, fetch, self };
}

describe.each([['source', original], ['minified', compact]])('%s service worker', (_name, code) => {
  it('keeps all lifecycle and push handlers', () => {
    expect([...load(code).listeners.keys()].sort()).toEqual(['activate', 'fetch', 'install', 'message', 'notificationclick', 'push', 'pushsubscriptionchange']);
  });
  it('never intercepts cross-origin or mutation requests', () => {
    const { listeners, fetch } = load(code);
    const respondWith = vi.fn();
    listeners.get('fetch')!({ request: { url: 'https://api.test/private', method: 'GET' }, respondWith });
    listeners.get('fetch')!({ request: { url: 'https://app.test/private', method: 'POST' }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects stale HTML masquerading as a JavaScript asset', async () => {
    const { listeners } = load(code);
    let response: Promise<Response> | undefined;
    listeners.get('fetch')!({ request: { url: 'https://app.test/assets/old.js', method: 'GET' }, respondWith: (value: Promise<Response>) => { response = value; } });
    expect((await response)?.status).toBe(404);
  });
  it('retains deployment-specific cache names and activation cleanup', async () => {
    const { listeners, caches, self } = load(code);
    const pending: Promise<unknown>[] = [];
    const waitUntil = (promise: Promise<unknown>) => pending.push(promise);
    listeners.get('install')!({ waitUntil });
    await Promise.all(pending);
    expect(caches.open).toHaveBeenCalledWith('app-shell-v3-audit-build-https://app.test/');
    listeners.get('activate')!({ waitUntil });
    await Promise.all(pending);
    expect(caches.delete).toHaveBeenCalledWith('old-cache');
    expect(self.clients.claim).toHaveBeenCalledOnce();
  });
});
