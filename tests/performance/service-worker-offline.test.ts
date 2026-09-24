import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('public/sw.js', 'utf8').replaceAll('__BUILD_TIMESTAMP__', 'offline-build');
const SCOPE = 'https://app.test/';
const ASSET_CACHE = `assets-v1-${SCOPE}`;

type Stored = Map<string, Response>;

function makeCaches(initial: Record<string, Record<string, string>> = {}) {
  const stores = new Map<string, Stored>();
  const keyOf = (request: unknown) => {
    const raw = typeof request === 'string' ? request : (request as { url: string }).url;
    return new URL(raw, SCOPE).pathname;
  };
  const open = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: vi.fn(async (request: unknown) => store.get(keyOf(request))?.clone()),
      put: vi.fn(async (request: unknown, response: Response) => { store.delete(keyOf(request)); store.set(keyOf(request), response); }),
      keys: vi.fn(async () => [...store.keys()].map((path) => ({ url: `${SCOPE.slice(0, -1)}${path}` }))),
      delete: vi.fn(async (request: unknown) => store.delete(keyOf(request))),
      addAll: vi.fn(async (paths: string[]) => { paths.forEach((path) => store.set(path, new Response(`shell:${path}`))); }),
    };
  };
  for (const [name, entries] of Object.entries(initial)) {
    const store = new Map<string, Response>();
    Object.entries(entries).forEach(([path, body]) => store.set(path, new Response(body)));
    stores.set(name, store);
  }
  const caches = {
    open: vi.fn(async (name: string) => open(name)),
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(async (name: string) => stores.delete(name)),
    match: vi.fn(async (request: unknown) => {
      for (const store of stores.values()) {
        const hit = store.get(keyOf(request));
        if (hit) return hit.clone();
      }
      return undefined;
    }),
  };
  return { caches, stores };
}

function load(options: {
  precache?: string[];
  fetch: (input: unknown) => Promise<Response>;
  caches: ReturnType<typeof makeCaches>['caches'];
  immediateTimeout?: boolean;
}) {
  const code = source.replace('[] /* __PRECACHE_ASSETS__ */', JSON.stringify(options.precache ?? []));
  const listeners = new Map<string, (event: unknown) => void>();
  const self = {
    location: new URL(`${SCOPE}sw.js`),
    registration: { scope: SCOPE, showNotification: vi.fn(), setAppBadge: vi.fn() },
    addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined), matchAll: vi.fn(async () => []) },
  };
  const fakeSetTimeout = options.immediateTimeout
    ? (fn: () => void) => { queueMicrotask(fn); return 0; }
    : setTimeout;
  runInNewContext(code, {
    self, caches: options.caches, fetch: options.fetch, URL, Headers, Response, AbortController,
    setTimeout: fakeSetTimeout, clearTimeout, queueMicrotask, console: { log() {}, warn() {}, error() {} },
  });
  const run = async (name: string, event: Record<string, unknown> = {}, awaitBackground = true) => {
    const pending: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    listeners.get(name)!({
      ...event,
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
      respondWith: (value: Promise<Response>) => { response = value; },
    });
    const result = response ? await response : undefined;
    if (awaitBackground) await Promise.all(pending);
    return result;
  };
  return { run };
}

const js = (body: string) => new Response(body, { headers: { 'content-type': 'text/javascript' } });
const basic = (response: Response) => Object.defineProperty(response, 'type', { value: 'basic' });

describe('service worker offline behaviour', () => {
  it('precaches the offline pages, reusing unchanged assets instead of downloading them', async () => {
    const { caches, stores } = makeCaches({ [ASSET_CACHE]: { '/assets/vendor-same.js': 'old-but-identical' } });
    const fetch = vi.fn(async (input: unknown) => {
      if (String(input) === '/assets/page-new.js') return basic(js('new'));
      if (String(input) === '/assets/broken.js') throw new TypeError('Failed to fetch');
      return basic(new Response('ok'));
    });
    const { run } = load({ caches, fetch, precache: ['/assets/vendor-same.js', '/assets/page-new.js', '/assets/broken.js'] });

    await run('install');

    const assets = stores.get(ASSET_CACHE)!;
    expect(fetch).not.toHaveBeenCalledWith('/assets/vendor-same.js', expect.anything());
    expect(await assets.get('/assets/page-new.js')?.text()).toBe('new');
    // A failed asset does not abort the update; it is fetched again on demand.
    expect(assets.has('/assets/broken.js')).toBe(false);
  });

  it('keeps downloaded code across deploys while dropping old versioned caches', async () => {
    const { caches, stores } = makeCaches({
      [ASSET_CACHE]: { '/assets/route-chunk.js': 'chunk' },
      'runtime-v3-previous-build': { '/festival-management/1': 'old html' },
    });
    const { run } = load({ caches, fetch: vi.fn() });

    await run('activate');

    expect(stores.has(ASSET_CACHE)).toBe(true);
    expect(stores.has('runtime-v3-previous-build')).toBe(false);
  });

  it('serves the cached shell when a "connected" network never answers', async () => {
    const { caches } = makeCaches({ [`app-shell-v3-offline-build-${SCOPE}`]: { '/': '<html>shell</html>' } });
    const hanging = vi.fn(() => new Promise<Response>(() => {}));
    const { run } = load({ caches, fetch: hanging, immediateTimeout: true });

    const response = await Promise.race([
      // The hung request keeps running in the background; only the response matters.
      run('fetch', { request: { url: `${SCOPE}festival-management/1`, method: 'GET', mode: 'navigate' } }, false),
      new Promise((resolve) => setTimeout(() => resolve('hung'), 200)),
    ]);

    expect(response).not.toBe('hung');
    expect(await (response as Response).text()).toBe('<html>shell</html>');
    expect(hanging).toHaveBeenCalledOnce();
  });

  it('serves the cached shell straight away when the network is down', async () => {
    const { caches } = makeCaches({ [`app-shell-v3-offline-build-${SCOPE}`]: { '/': '<html>shell</html>' } });
    const { run } = load({ caches, fetch: vi.fn(async () => { throw new TypeError('Failed to fetch'); }) });

    const response = await run('fetch', { request: { url: `${SCOPE}tech-app`, method: 'GET', mode: 'navigate' } });

    expect(await response?.text()).toBe('<html>shell</html>');
  });

  it('stores hashed assets fetched at runtime in the long-lived asset cache', async () => {
    const { caches, stores } = makeCaches();
    const fetch = vi.fn(async () => basic(js('lazy tab')));
    const { run } = load({ caches, fetch });

    await run('fetch', { request: { url: `${SCOPE}assets/LazyTab-abc.js`, method: 'GET', destination: 'script' } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stores.get(ASSET_CACHE)?.has('/assets/LazyTab-abc.js')).toBe(true);
  });
});
