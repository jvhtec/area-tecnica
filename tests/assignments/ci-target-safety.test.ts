// @vitest-environment jsdom
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { parseCiCampaignTarget, readCiCampaignTarget, verifyCiCampaignTarget } from './helpers/ciCampaignTarget';
import { localCampaignHarness } from './helpers/localCampaignHarness';
import { disposableCampaignHarness } from './helpers/disposableCampaignHarness';
import { holdCampaignRole } from './helpers/campaignRowLock';

vi.mock('node:child_process', () => {
  const mock = { execFileSync: vi.fn(), spawn: vi.fn() }; return { ...mock, default: mock };
});
vi.mock('node:fs', async importOriginal => {
  const mock = { ...await importOriginal<typeof import('node:fs')>(), readFileSync: vi.fn() }; return { ...mock, default: mock };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));
vi.mock('./helpers/edgeSnapshot', () => ({ edgeSnapshot: () => new Map([['staffing-orchestrator/index.ts', 'handler']]) }));
vi.mock('./helpers/withLocalRuntimeFence', () => ({
  withLocalRuntimeFence: (_runtime: unknown, action: (check: () => void) => Promise<unknown>) => action(() => undefined),
}));

const identity = 'staffing-ci-0123456789';
const cid = (n: number) => n.toString(16).padStart(64, '0');
const digest = `sha256:${cid(10)}`;
const suffixes = ['auth', 'rest', 'gateway', 'edge', 'capture'] as const;
const configPath = '../../supabase/config.toml';
const configUrl = new URL(configPath, import.meta.url);
const runtimeDirectory = './runtime/';
const privateManifestPath = './private-manifest.json';
const checkoutConfig = (await vi.importActual<typeof import('node:fs')>('node:fs')).readFileSync(configUrl, 'utf8');
function handlerManifest() {
  return { 'staffing-orchestrator': { verify_jwt: false }, 'send-staffing-email': { verify_jwt: false },
    'notify-staffing-cancellation': { verify_jwt: true }, push: { verify_jwt: true }, 'manage-flex-crew-assignments': { verify_jwt: true } };
}
const assets = new Map([
  ['/local/main/index.ts', 'supervisor.ts'], ['/local/worker.ts', 'worker.ts'], ['/local/outbound.ts', 'outbound.ts'],
  ['/capture.py', 'capture.py'], ['/gateway.py', 'gateway.py'],
  ['/local/types.ts', 'types.ts'], ['/local/main/types.ts', 'types.ts'],
  ['/local/_ci-probe-modern/index.ts', '_ci-probe-modern/index.ts'], ['/local/_ci-probe-legacy/index.ts', '_ci-probe-legacy/index.ts'],
]);
function manifest(withDbIngress = false) {
  return {
    identity, network: `supabase_network_${identity}`, networkId: cid(1), ingress: `${identity}-ingress`, ingressId: cid(2),
    database: `supabase_db_${identity}`, databaseId: cid(3), url: 'http://127.0.0.1:54481',
    services: Object.fromEntries(suffixes.map((suffix, i) => [suffix, { name: `${identity}-${suffix}`, id: cid(i + 4), image: digest }])),
    volumes: { database: `supabase_db_${identity}`, code: `${identity}-code`, cache: `${identity}-cache` },
    ...(withDbIngress ? { dbIngress: { name: `${identity}-db-ingress`, id: cid(9), image: digest, port: 54512 } } : {}),
  };
}
type Mount = { Type: string; Name?: string; Destination: string; Driver?: string; RW: boolean };
type Container = { Id: string; Name: string; Image: string; State: { Running: boolean }; Config: { Labels: Record<string, string> };
  NetworkSettings: { Networks: Record<string, { NetworkID: string }>; Ports: Record<string, unknown> };
  HostConfig: { PortBindings: Record<string, unknown>; NetworkMode: string; PublishAllPorts: boolean }; Mounts: Mount[] };
type Network = { Id: string; Name: string; Internal: boolean; Driver: string; Scope: string; Labels: Record<string, string>;
  Containers: Record<string, { Name: string }> };
type Volume = { Name: string; Driver: string; Scope: string; Options: Record<string, string> | null; Labels: Record<string, string> };
function reader(withDbIngress = false, change?: {
  container?: (name: string, value: Container) => void;
  network?: (value: Network) => void;
  volume?: (value: Volume) => void;
  asset?: (path: string, content: string) => string;
  handlerManifest?: string;
}) {
  const target = parseCiCampaignTarget(manifest(withDbIngress));
  const cliLabels = { 'com.supabase.cli.project': identity }, labels = { 'local.staffing-ci': identity };
  const entries = [{ name: target.database, id: target.databaseId }, ...Object.values(target.services), ...(target.dbIngress ? [target.dbIngress] : [])];
  return vi.fn((...args: string[]) => {
    if (args[0] === 'network') {
      const internal = args.at(-1) === target.networkId;
      const members = internal ? entries : [target.services.gateway, ...(target.dbIngress ? [target.dbIngress] : [])];
      const value: Network = { Id: internal ? target.networkId : target.ingressId, Name: internal ? target.network : target.ingress,
        Internal: internal, Driver: 'bridge', Scope: 'local', Labels: internal ? cliLabels : labels,
        Containers: Object.fromEntries(members.map(entry => [entry.id, { Name: entry.name }])) };
      change?.network?.(value); return JSON.stringify([value]);
    }
    if (args[0] === 'volume') {
      const name = args.at(-1)!;
      const value: Volume = { Name: name, Driver: 'local', Scope: 'local', Options: null, Labels: name === target.database ? cliLabels : labels };
      change?.volume?.(value); return JSON.stringify([value]);
    }
    if (args[0] === 'inspect') {
      const entry = entries.find(item => item.id === args.at(-1));
      if (!entry) throw new Error('Unknown inspected CID');
      const ingress = entry.name === target.services.gateway.name || entry.name === target.dbIngress?.name;
      const port = entry.name === target.services.gateway.name ? '8000/tcp' : entry.name === target.dbIngress?.name ? '5432/tcp' : undefined;
      const bindings = port ? { [port]: [{ HostIp: '127.0.0.1', HostPort: port === '8000/tcp' ? target.port : '54512' }] } : {};
      const mounts: Mount[] = entry.name === target.database ? [{ Type: 'volume', Name: target.database, Destination: '/var/lib/postgresql/data', Driver: 'local', RW: true }]
        : entry.name === target.edge ? [{ Type: 'volume', Name: target.volumes.code, Destination: '/local', Driver: 'local', RW: false },
          { Type: 'volume', Name: target.volumes.cache, Destination: '/cache', Driver: 'local', RW: true }]
          : entry.name === target.services.gateway.name ? [{ Type: 'bind', Destination: '/gateway.py', RW: false }]
            : entry.name === target.capture ? [{ Type: 'bind', Destination: '/capture.py', RW: false }]
              : entry.name === target.dbIngress?.name ? [{ Type: 'bind', Destination: '/tunnel.py', RW: false }] : [];
      const value: Container = { Id: entry.id, Name: `/${entry.name}`, Image: digest, State: { Running: true },
        Config: { Labels: entry.name === target.database ? cliLabels : labels },
        NetworkSettings: { Networks: { [target.network]: { NetworkID: target.networkId }, ...(ingress ? { [target.ingress]: { NetworkID: target.ingressId } } : {}) }, Ports: bindings },
        HostConfig: { PortBindings: bindings, NetworkMode: target.network, PublishAllPorts: false }, Mounts: mounts };
      change?.container?.(entry.name, value); return JSON.stringify([value]);
    }
    if (args[0] === 'exec' && args[2] === 'cat') {
      if (args[3] === '/local/manifest.json') return change?.handlerManifest ?? JSON.stringify(handlerManifest());
      const path = args[3], file = path === '/tunnel.py' && withDbIngress ? 'database-tunnel.py' : assets.get(path);
      if (!file) throw new Error('Unknown runtime path');
      return change?.asset?.(path, `checkout:${file}\n`) ?? `checkout:${file}\n`;
    }
    if (args.includes('sh')) return '/local/functions/staffing-orchestrator/index.ts\0handler\0';
    if (args.includes('psql')) return '0';
    throw new Error('Unexpected Docker operation');
  });
}
const jwt = (role: string, iss = 'supabase-demo') => `header.${Buffer.from(JSON.stringify({ iss, role })).toString('base64url')}.signature`;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STAFFING_CI_MANIFEST', undefined); vi.stubEnv('STAFFING_DISPOSABLE_MANIFEST', undefined);
  vi.stubEnv('STAFFING_EDGE_TEST_URL', 'http://127.0.0.1:54481');
  vi.stubEnv('STAFFING_EDGE_TEST_ANON_KEY', jwt('anon')); vi.stubEnv('STAFFING_EDGE_TEST_SERVICE_KEY', jwt('service_role'));
  vi.mocked(readFileSync).mockImplementation(path => {
    if (path instanceof URL && path.href === configUrl.href) return checkoutConfig;
    if (path instanceof URL) return `checkout:${fileURLToPath(path).replace(/\\/g, '/').split('/runtime/')[1]}\n`;
    return JSON.stringify(manifest());
  });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('synthetic CI manifest admission', () => {
  it('freezes a complete, unambiguous target including optional DB ingress', () => {
    const target = parseCiCampaignTarget(manifest(true));
    for (const value of [target, target.services, ...Object.values(target.services), target.volumes, target.dbIngress]) expect(Object.isFrozen(value)).toBe(true);
  });
  it.each([null, [], {}, { ...manifest(), surprise: true }, { ...manifest(), identity: 'dev-history' },
    { ...manifest(), network: identity }, { ...manifest(), database: 'supabase_db_dev-history' },
    { ...manifest(), databaseId: cid(1) }, { ...manifest(), networkId: 'short-id' },
    { ...manifest(), services: { ...manifest().services, auth: { name: `${identity}-auth`, id: cid(4), image: 'latest' } } },
    { ...manifest(), services: { ...manifest().services, mail: {} } },
    { ...manifest(), volumes: { ...manifest().volumes, cache: 'history-cache' } },
    { ...manifest(true), dbIngress: { ...manifest(true).dbIngress, port: 54322 } },
    { ...manifest(), dbIngress: null },
  ])('rejects invalid manifest %#', value => { expect(() => parseCiCampaignTarget(value)).toThrow(); });
  it.each(['https://example.supabase.co', 'http://localhost:54481', 'http://127.0.0.1:54481@evil.invalid',
    'http://127.0.0.1:54481/', 'http://127.0.0.1:054481', 'http://127.0.0.1:65536',
    ...[54321,54322,54323,54324,54325,54441,54442,54443,54444,54445,54512].map(port => `http://127.0.0.1:${port}`),
  ])('rejects hosted, ambiguous, or persistent URL %s', url => { expect(() => parseCiCampaignTarget({ ...manifest(), url })).toThrow(); });
  it.each(['relative.json', ''])('requires an absolute manifest path %s', path => {
    vi.stubEnv('STAFFING_CI_MANIFEST', path); expect(() => readCiCampaignTarget()).toThrow('Absolute'); expect(readFileSync).not.toHaveBeenCalled();
  });
});

describe('CI Docker facts and checkout asset parity', () => {
  it.each([false, true])('admits the exact isolated target (db ingress %s)', dbIngress => {
    const docker = reader(dbIngress); verifyCiCampaignTarget(parseCiCampaignTarget(manifest(dbIngress)), docker);
    expect(docker.mock.calls.filter(args => args[2] === 'cat').map(args => args.slice(1))).toEqual([
      [`${identity}-edge`, 'cat', '/local/main/index.ts'], [`${identity}-edge`, 'cat', '/local/worker.ts'],
      [`${identity}-edge`, 'cat', '/local/outbound.ts'], [`${identity}-capture`, 'cat', '/capture.py'], [`${identity}-gateway`, 'cat', '/gateway.py'],
      [`${identity}-edge`, 'cat', '/local/types.ts'], [`${identity}-edge`, 'cat', '/local/main/types.ts'],
      [`${identity}-edge`, 'cat', '/local/_ci-probe-modern/index.ts'], [`${identity}-edge`, 'cat', '/local/_ci-probe-legacy/index.ts'],
      ...(dbIngress ? [[`${identity}-db-ingress`, 'cat', '/tunnel.py']] : []),
      [`${identity}-edge`, 'cat', '/local/manifest.json'],
    ]);
    expect(vi.mocked(readFileSync).mock.calls.map(([path]) => fileURLToPath(path as URL).replace(/\\/g, '/')))
      .toEqual([...assets.values()].map(file => fileURLToPath(new URL(runtimeDirectory + file, import.meta.url)).replace(/\\/g, '/'))
        .concat(dbIngress ? [fileURLToPath(new URL(runtimeDirectory + 'database-tunnel.py', import.meta.url)).replace(/\\/g, '/')] : [])
        .concat(fileURLToPath(configUrl).replace(/\\/g, '/')));
  });
  it.each([
    (c: Container) => { c.Id = cid(50); }, (c: Container) => { c.Name = '/foreign'; },
    (c: Container) => { c.Image = `sha256:${cid(99)}`; }, (c: Container) => { c.State.Running = false; },
    (c: Container) => { c.Config.Labels = {}; },
    (c: Container) => { c.NetworkSettings.Networks.bridge = { NetworkID: cid(20) }; },
    (c: Container) => { Object.values(c.NetworkSettings.Networks)[0].NetworkID = cid(99); },
    (c: Container) => { c.HostConfig.NetworkMode = 'host'; }, (c: Container) => { c.HostConfig.PublishAllPorts = true; },
    (c: Container) => { c.HostConfig.PortBindings = { '8000/tcp': [{ HostIp: '0.0.0.0', HostPort: '54481' }] }; },
    (c: Container) => { c.NetworkSettings.Ports = { '9000/tcp': [{ HostIp: '127.0.0.1', HostPort: '55555' }] }; },
    (c: Container) => { c.Mounts.push({ Type: 'volume', Name: 'historical', Destination: '/foreign', RW: true }); },
    (c: Container) => { c.Mounts.push({ Type: 'bind', Destination: '/foreign', RW: false }); },
    (c: Container) => { c.Mounts.push({ Type: 'bind', Destination: '/gateway.py', RW: true }); },
  ])('rejects substituted or unsafe service %#', change => {
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader(false, {
      container(name, value) { if (name.endsWith('-gateway')) change(value); },
    }))).toThrow();
  });
  it.each([
    (n: Network) => { n.Internal = false; }, (n: Network) => { n.Id = cid(99); }, (n: Network) => { n.Labels = {}; },
    (n: Network) => { n.Containers[cid(99)] = { Name: 'foreign' }; }, (n: Network) => { delete n.Containers[cid(4)]; },
  ])('rejects foreign or externally routed core network %#', change => {
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader(false, {
      network(n) { if (n.Name.startsWith('supabase_network_')) change(n); },
    }))).toThrow();
  });
  it('rejects extra ingress membership', () => {
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader(false, {
      network(n) { if (n.Name.endsWith('-ingress')) n.Containers[cid(99)] = { Name: 'foreign' }; },
    }))).toThrow('membership');
  });
  it.each([
    (v: Volume) => { v.Labels = {}; }, (v: Volume) => { v.Driver = 'remote'; },
    (v: Volume) => { v.Options = { type: 'none', device: '/history', o: 'bind' }; },
  ])('rejects unowned or backed storage %#', change => {
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader(false, { volume: change }))).toThrow();
  });
  it.each(['code-writable', 'cache-readonly', 'capture-volume', 'missing-code', 'db-published', 'ingress-external'])('rejects %s', fault => {
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest(true)), reader(true, { container(name, c) {
      if (fault === 'code-writable' && name.endsWith('-edge')) c.Mounts[0].RW = true;
      if (fault === 'cache-readonly' && name.endsWith('-edge')) c.Mounts[1].RW = false;
      if (fault === 'capture-volume' && name.endsWith('-capture')) c.Mounts = [{ Type: 'volume', Name: `${identity}-cache`, Destination: '/captures', RW: true }];
      if (fault === 'missing-code' && name.endsWith('-edge')) c.Mounts.shift();
      if (fault === 'db-published' && name.startsWith('supabase_db_')) c.HostConfig.PortBindings = { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '54512' }] };
      if (fault === 'ingress-external' && name.endsWith('-db-ingress')) c.HostConfig.PortBindings = { '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '54512' }] };
    } }))).toThrow();
  });
  it.each([...assets.keys()])('rejects stale runtime bytes at %s', stale => {
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader(false, {
      asset: (path, content) => path === stale ? `${content}stale` : content,
    }))).toThrow('asset is stale');
  });
  it('rejects ambiguous or malformed Docker inspection', () => {
    for (const output of ['null', '[{},{}]', '[null]', '{}']) {
      expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), () => output)).toThrow();
    }
  });
  it('rejects stale DB ingress tunnel bytes', () => {
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest(true)), reader(true, {
      asset: (path, content) => path === '/tunnel.py' ? `${content}stale` : content,
    }))).toThrow('asset is stale: database-tunnel.py');
  });
  it.each(['writable', 'unknown', 'other-container'])('rejects %s tunnel binds', fault => {
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest(true)), reader(true, { container(name, container) {
      if (name.endsWith('-db-ingress')) {
        if (fault === 'writable') container.Mounts[0].RW = true;
        if (fault === 'unknown') container.Mounts[0].Destination = '/other.py';
      }
      if (fault === 'other-container' && name.endsWith('-auth')) container.Mounts.push({ Type: 'bind', Destination: '/tunnel.py', RW: false });
    } }))).toThrow('CI bind mount');
  });
});

describe('CI handler JWT exposure admission', () => {
  function withConfig(config: string) {
    const previous = vi.mocked(readFileSync).getMockImplementation()!;
    vi.mocked(readFileSync).mockImplementation((path, options) => path instanceof URL && path.href === configUrl.href
      ? config : previous(path, options));
  }
  it.each(Object.keys(handlerManifest()) as Array<keyof ReturnType<typeof handlerManifest>>)('rejects stale JWT exposure for %s', name => {
    const entries = handlerManifest(); entries[name].verify_jwt = !entries[name].verify_jwt;
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader(false, {
      handlerManifest: JSON.stringify(entries),
    }))).toThrow(`JWT exposure is stale: ${name}`);
  });
  it.each(['null', '[]', '{', JSON.stringify({ ...handlerManifest(), '_ci-probe-modern': { verify_jwt: true } }),
    JSON.stringify({ ...handlerManifest(), 'staffing-click': { verify_jwt: false } }),
    JSON.stringify({ ...handlerManifest(), push: { verify_jwt: 'true' } }),
    JSON.stringify({ ...handlerManifest(), push: { verify_jwt: null } }),
    JSON.stringify({ ...handlerManifest(), push: { verify_jwt: true, enabled: true } }),
    JSON.stringify({ ...handlerManifest(), push: {} }),
  ])('rejects malformed or unexpected handler manifest %#', value => {
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader(false, { handlerManifest: value }))).toThrow();
  });
  it.each(Object.keys(handlerManifest()))('rejects missing required handler %s', name => {
    const entries = Object.fromEntries(Object.entries(handlerManifest()).filter(([key]) => key !== name));
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader(false, { handlerManifest: JSON.stringify(entries) }))).toThrow('exactly the five');
  });
  it('rejects staffing-click substituted for manage-flex-crew-assignments despite five entries', () => {
    const { 'manage-flex-crew-assignments': _crew, ...required } = handlerManifest();
    const entries = { ...required, 'staffing-click': { verify_jwt: false } };
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader(false, { handlerManifest: JSON.stringify(entries) }))).toThrow('exactly the five');
  });
  it.each(['push', 'staffing-orchestrator'] as const)('derives updated %s exposure from current config rather than fixed flags', name => {
    const entries = handlerManifest(), before = entries[name].verify_jwt;
    const changed = checkoutConfig.replace(/\r\n/g, '\n').replace(`[functions.${name}]\nverify_jwt = ${before}`, `[functions.${name}]\nverify_jwt = ${!before}`);
    expect(changed).not.toBe(checkoutConfig.replace(/\r\n/g, '\n'));
    withConfig(changed);
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader())).toThrow(`JWT exposure is stale: ${name}`);
    entries[name].verify_jwt = !before;
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader(false, { handlerManifest: JSON.stringify(entries) }))).not.toThrow();
  });
  it('uses true for an absent flag and ignores comments and neighboring sections', () => {
    withConfig(checkoutConfig.replace(/\r\n/g, '\n').replace('[functions.push]\nverify_jwt = true',
      '[functions.push] # comment\n# verify_jwt = false\n[functions.unrelated]\nverify_jwt = false'));
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader())).not.toThrow();
  });
  it.each(['notify-staffing-cancellation', 'manage-flex-crew-assignments'] as const)('honors an explicit setting for previously absent %s', name => {
    withConfig(`${checkoutConfig}\n[functions.${name}]\nverify_jwt = false # reviewed exposure\n`);
    const entries = handlerManifest(); entries[name].verify_jwt = false;
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader(false, { handlerManifest: JSON.stringify(entries) }))).not.toThrow();
  });
  it.each([
    '\n[functions.push]\nverify_jwt = true',
    '\n[functions.push.child]\nverify_jwt = false',
    '\n[functions."push"]\nverify_jwt = false',
    '\n[functions]\npush = { verify_jwt = false }',
    '\nfunctions.push.verify_jwt = false',
  ])('rejects ambiguous or unsupported config declarations %#', extra => {
    withConfig(checkoutConfig + extra);
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader())).toThrow();
  });
  it.each(['true\nverify_jwt = true', '"true"', 'true trailing', '1', 'falseish'])('rejects duplicate or non-boolean verify_jwt %s', value => {
    withConfig(checkoutConfig.replace(/\r\n/g, '\n').replace('[functions.push]\nverify_jwt = true', `[functions.push]\nverify_jwt = ${value}`));
    expect(() => verifyCiCampaignTarget(parseCiCampaignTarget(manifest()), reader())).toThrow('verify_jwt setting');
  });
  it.each([localCampaignHarness, disposableCampaignHarness])('refuses stale exposure before clients, fixtures or bootstrap', harness => {
    vi.stubEnv('STAFFING_CI_MANIFEST', fileURLToPath(new URL(privateManifestPath, import.meta.url)));
    const entries = handlerManifest(); entries.push.verify_jwt = false;
    vi.mocked(execFileSync).mockImplementation((_command, args) => reader(false, { handlerManifest: JSON.stringify(entries) })(...args as string[]));
    expect(() => harness()).toThrow('JWT exposure is stale: push');
    expect(createClient).not.toHaveBeenCalled();
    expect(vi.mocked(execFileSync).mock.calls.every(([, args]) => !(args as string[]).includes('psql'))).toBe(true);
  });
});

describe('CI harness boundary', () => {
  beforeEach(() => {
    vi.stubEnv('STAFFING_CI_MANIFEST', fileURLToPath(new URL(privateManifestPath, import.meta.url)));
    vi.mocked(execFileSync).mockImplementation((_command, args) => reader()(...args as string[]));
  });
  it.each([localCampaignHarness, disposableCampaignHarness])('rejects simultaneous manifests before Docker or clients', harness => {
    vi.stubEnv('STAFFING_DISPOSABLE_MANIFEST', 'private-clone.json');
    expect(() => harness()).toThrow('cannot be combined'); expect(execFileSync).not.toHaveBeenCalled(); expect(createClient).not.toHaveBeenCalled();
  });
  it.each([localCampaignHarness, disposableCampaignHarness])('keeps URL and demo credential refusals', harness => {
    vi.stubEnv('STAFFING_EDGE_TEST_SERVICE_KEY', jwt('service_role', 'supabase'));
    expect(() => harness()).toThrow('not local demo keys'); expect(execFileSync).not.toHaveBeenCalled();
    vi.stubEnv('STAFFING_EDGE_TEST_SERVICE_KEY', jwt('service_role')); vi.stubEnv('STAFFING_EDGE_TEST_URL', 'https://hosted.supabase.co');
    expect(() => harness()).toThrow('owned ci localhost'); expect(createClient).not.toHaveBeenCalled();
  });
  it('does not create a client when Docker or asset admission fails', () => {
    vi.mocked(execFileSync).mockImplementation((_command, args) => reader(false, { asset: () => 'stale' })(...args as string[]));
    expect(() => localCampaignHarness()).toThrow('asset is stale'); expect(createClient).not.toHaveBeenCalled();
  });
  it('selects CI and performs zero historical access when fingerprinting', () => {
    const h = disposableCampaignHarness();
    expect(h.target.database).toBe(`supabase_db_${identity}`);
    vi.mocked(execFileSync).mockClear();
    expect(h.historicalFingerprint()).toEqual(Array(8).fill('0'));
    expect(vi.mocked(execFileSync).mock.calls).toHaveLength(8);
    expect(vi.mocked(execFileSync).mock.calls.every(([, args]) => (args as string[])[1] === h.target.database)).toBe(true);
  });
  it('revalidates the CI target before fault SQL and latches driver uncertainty', async () => {
    const h = disposableCampaignHarness(); vi.mocked(execFileSync).mockClear();
    vi.mocked(execFileSync).mockImplementation((_command, args) => {
      const parts = args as string[];
      if (parts.includes('psql')) throw new Error('SQL driver interrupted');
      return reader()(...parts);
    });
    await expect(h.prepare()).rejects.toThrow('SQL driver interrupted');
    expect(vi.mocked(execFileSync).mock.calls.some(([, args]) => (args as string[])[0] === 'network')).toBe(true);
    expect(h.cleanupSafe).toBe(false); await expect(h.job()).rejects.toThrow('Owned fixtures retained');
    await expect(h.cleanUsers()).rejects.toThrow('Owned fixtures retained');
  });
  it('rejects a forged lock target and a missing CI target without spawning', async () => {
    await expect(holdCampaignRole('01234567-0123-0123-0123-012345678901', { database: 'supabase_db_dev-history' })).rejects.toThrow('validated');
    await expect(holdCampaignRole('01234567-0123-0123-0123-012345678901')).rejects.toThrow('validated');
    expect(spawn).not.toHaveBeenCalled();
  });
  it('revalidates live CI ownership before row-lock SQL spawn', async () => {
    const h = localCampaignHarness();
    vi.mocked(execFileSync).mockClear();
    vi.mocked(execFileSync).mockImplementation((_command, args) => reader(false, { container(name, value) {
      if (name.startsWith('supabase_db_')) value.Id = cid(99);
    } })(...args as string[]));
    await expect(holdCampaignRole('01234567-0123-0123-0123-012345678901', h.target)).rejects.toThrow('CI container ID');
    expect(execFileSync).toHaveBeenCalled(); expect(spawn).not.toHaveBeenCalled();
  });
  it('locks only the validated CI database and preserves the historical default', async () => {
    const stdout = new EventEmitter(), stderr = new EventEmitter(), process = new EventEmitter();
    const stdin = { write: vi.fn(() => stdout.emit('data', Buffer.from('CAMPAIGN_ROLE_LOCKED'))),
      end: vi.fn(() => process.emit('exit', 0)) };
    vi.mocked(spawn).mockReturnValue(Object.assign(process, { stdout, stderr, stdin }) as unknown as ReturnType<typeof spawn>);
    const h = localCampaignHarness();
    const release = await holdCampaignRole('01234567-0123-0123-0123-012345678901', h.target);
    expect(vi.mocked(spawn).mock.calls[0][1]).toContain(h.target.database); await release();
    vi.stubEnv('STAFFING_CI_MANIFEST', undefined);
    vi.stubEnv('STAFFING_EDGE_TEST_DATABASE', 'arbitrary-foreign-db');
    const historicalRelease = await holdCampaignRole('01234567-0123-0123-0123-012345678901');
    expect(vi.mocked(spawn).mock.calls[1][1]).toContain('supabase_db_dev-history'); await historicalRelease();
  });
});
