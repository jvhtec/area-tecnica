import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localCampaignHarness } from './helpers/localCampaignHarness';
import * as historical from './helpers/historicalCampaignTarget';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));
vi.mock('./helpers/edgeSnapshot', () => ({ edgeSnapshot: () => new Map([['staffing-orchestrator/index.ts', 'handler']]) }));

const t = historical.historicalCampaignTarget;
const cid = (n: number) => n.toString(16).padStart(64, '0');
const jwt = (role: string) => `header.${Buffer.from(JSON.stringify({ role, iss: 'supabase-demo' })).toString('base64url')}.signature`;
type Endpoint = { NetworkID: string; Aliases: string[]; DNSNames?: string[] };
type Container = { Id: string; Name: string; State: { Running: boolean }; Config: { Labels: Record<string, string> };
  HostConfig: { NetworkMode: string; PublishAllPorts: boolean; PortBindings: Record<string, unknown> };
  NetworkSettings: { Networks: Record<string, Endpoint>; Ports: Record<string, unknown> } };
type Network = { Id: string; Name: string; Driver: string; Scope: string; Internal: boolean; Containers: Record<string, { Name: string }> };
type Service = { id: string; name: string; host: string; port: number; protocol: string; path: string; enabled: boolean };
type Route = { id: string; name: string; paths: string[] | null; service: { id: string }; strip_path: boolean;
  hosts: string[] | null; methods: string[] | null; regex_priority: number; headers: null; snis: null;
  sources: null; destinations: null; path_handling: string; preserve_host: boolean; protocols: string[] };

function fixture() {
  const names = [t.database, t.edge, t.capture, t.gateway, t.auth, t.rest,
    'supabase_studio_dev-history', 'supabase_realtime_dev-history', 'supabase_storage_dev-history', 'supabase_inbucket_dev-history'];
  const containers: Record<string, Container> = Object.fromEntries(names.map((name, i) => {
    const ingress = name === t.gateway || name === names[6];
    const ports = name === t.gateway ? { '8000/tcp': [{ HostIp: '127.0.0.1', HostPort: '54441' }] }
      : name === t.database ? { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '54442' }] } : {};
    return [name, { Id: cid(i + 1), Name: `/${name}`, State: { Running: true },
      Config: { Labels: { 'com.supabase.cli.project': 'dev-history' } },
      HostConfig: { NetworkMode: t.network, PublishAllPorts: false, PortBindings: ports },
      NetworkSettings: { Ports: ports, Networks: { [t.network]: { NetworkID: cid(20), Aliases: [name] },
        ...(ingress ? { [t.ingress]: { NetworkID: cid(21), Aliases: [name] } } : {}) } } }];
  }));
  const networks: Record<string, Network> = Object.fromEntries([t.network, t.ingress].map((name, i) => [name,
    { Id: cid(20 + i), Name: name, Driver: 'bridge', Scope: 'local', Internal: i === 0,
      Containers: Object.fromEntries(Object.entries(containers).filter(([, c]) => c.NetworkSettings.Networks[name])
        .map(([name, c]) => [c.Id, { Name: name }])) }]));
  const specs: Array<[string, string, number, string, string]> = [
    ['auth-v1', t.auth, 9999, '/', '/auth/v1/'], ['rest-v1', t.rest, 3000, '/', '/rest/v1/'],
    ['functions-v1', t.edge, 8081, '/', '/functions/v1/'],
    ['auth-v1-open', t.auth, 9999, '/verify', '/auth/v1/verify'],
    ['auth-v1-open-callback', t.auth, 9999, '/callback', '/auth/v1/callback'],
    ['auth-v1-open-authorize', t.auth, 9999, '/authorize', '/auth/v1/authorize'],
    ['well-known-oauth', t.auth, 9999, '/.well-known/oauth-authorization-server', '/.well-known/oauth-authorization-server'],
    ['storage-v1', 'supabase_storage_dev-history', 5000, '/', '/storage/v1/'],
    ['realtime-v1', 'realtime-dev', 4000, '/socket', '/realtime/v1/'],
  ];
  const services: Service[] = specs.map(([name, host, port, path], i) =>
    ({ id: `service-${i}`, name, host, port, path, protocol: 'http', enabled: true }));
  const routes: Route[] = specs.map(([name, , , , path], i) => ({ id: `route-${i}`, name, paths: [path],
    service: { id: `service-${i}` }, strip_path: true, hosts: null, methods: null, regex_priority: 0,
    headers: null, snis: null, sources: null, destinations: null, path_handling: 'v0', preserve_host: false, protocols: ['http', 'https'] }));
  return { containers, networks, services, routes, upstreams: [] as Array<{ id: string; name: string }>,
    next: null as string | null, override: undefined as ((parts: string[]) => string | undefined) | undefined };
}
type Fixture = ReturnType<typeof fixture>;
function reader(f: Fixture) {
  return (...parts: string[]): string => {
    const override = f.override?.(parts);
    if (override !== undefined) return override;
    if (parts[0] === 'network') return JSON.stringify([f.networks[parts.at(-1)!]]);
    if (parts[0] === 'inspect') {
      const identity = parts.at(-1)!;
      const container = f.containers[identity] ?? Object.values(f.containers).find(c => c.Id === identity);
      if (!container) throw new Error('Unknown historical mock CID');
      return JSON.stringify(container);
    }
    if (parts[0] === 'exec' && parts[2] === 'wget') {
      const endpoint = parts.at(-1)!.split('/').at(-1)!.split('?')[0] as 'services' | 'routes' | 'upstreams';
      return JSON.stringify({ data: f[endpoint], next: f.next });
    }
    if (parts[0] === 'exec' && parts[2] === 'sh') return '/local/functions/staffing-orchestrator/index.ts\0handler\0';
    throw new Error('Unexpected command in read-only admission');
  };
}
function install(f: Fixture) {
  vi.mocked(execFileSync).mockImplementation((_command, args) => reader(f)(...args as string[]));
}
function refuse(change: (f: Fixture) => void, error?: string) {
  const f = fixture(); change(f); install(f);
  expect(() => localCampaignHarness()).toThrow(error);
  expect(createClient).not.toHaveBeenCalled();
  expect(vi.mocked(execFileSync).mock.calls.every(([, args]) => !(args as string[]).includes('psql'))).toBe(true);
}

describe('historical API target admission', () => {
  beforeEach(() => {
    vi.stubEnv('STAFFING_CI_MANIFEST', undefined); vi.stubEnv('STAFFING_DISPOSABLE_MANIFEST', undefined);
    vi.stubEnv('STAFFING_EDGE_TEST_URL', t.url); vi.stubEnv('STAFFING_EDGE_TEST_ANON_KEY', jwt('anon'));
    vi.stubEnv('STAFFING_EDGE_TEST_SERVICE_KEY', jwt('service_role'));
    vi.mocked(execFileSync).mockReset(); vi.mocked(createClient).mockClear();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('admits the accepted topology with extra historical members and reads admin JSON by gateway CID', () => {
    const f = fixture(); install(f);
    const target = localCampaignHarness().target;
    expect(target).toEqual(t); expect(target).not.toBe(t); expect(createClient).toHaveBeenCalledOnce();
    const calls = vi.mocked(execFileSync).mock.calls.map(([, args]) => args as string[]);
    expect(calls.filter(parts => parts[2] === 'wget')).toEqual(['services', 'routes', 'upstreams'].map(endpoint =>
      ['exec', f.containers[t.gateway].Id, 'wget', '-qO-', `http://127.0.0.1:8001/${endpoint}?size=1000`]));
    expect(calls.filter(parts => parts[0] === 'inspect').every(parts => parts.includes('--format') &&
      !parts.join().includes('.Config.Env') && !parts.join().includes('declarative'))).toBe(true);
    expect(calls.every(parts => parts[0] === 'inspect' || parts[0] === 'network' ||
      (parts[0] === 'exec' && ['wget', 'sh'].includes(parts[2])))).toBe(true);
  });
  it('accepts unpublished exposed ports represented by null', () => {
    const f = fixture(); f.containers[t.gateway].NetworkSettings.Ports['8443/tcp'] = null;
    f.containers[t.auth].NetworkSettings.Ports['9999/tcp'] = null;
    install(f); expect(() => localCampaignHarness()).not.toThrow();
  });
  it('uses live attachments when Docker retains the original creation network mode', () => {
    const f = fixture(); f.containers[t.database].HostConfig.NetworkMode = t.ingress;
    install(f); expect(() => localCampaignHarness()).not.toThrow();
  });
  it.each([undefined, null, {}, { '5432/tcp': null }, { '5432/tcp': [] }])('accepts unpublished live DB ports %# with configured loopback intact', ports => {
    const f = fixture();
    // Docker versions/reconnects use missing, null, or empty live publication.
    f.override = parts => parts[0] === 'inspect' && parts.at(-1) === t.database ? JSON.stringify({
      ...f.containers[t.database], NetworkSettings: { ...f.containers[t.database].NetworkSettings, Ports: ports },
    }) : undefined;
    install(f); expect(() => localCampaignHarness()).not.toThrow();
  });
  it.each(['configured-absent', 'configured-empty', 'configured-external', 'live-external', 'live-wrong-port'])('rejects DB %s while live publication is optional', fault => {
    refuse(f => {
      const c = f.containers[t.database]; c.NetworkSettings.Ports = { '5432/tcp': [] };
      if (fault === 'configured-absent') c.HostConfig.PortBindings = {};
      if (fault === 'configured-empty') c.HostConfig.PortBindings = { '5432/tcp': [] };
      if (fault === 'configured-external') c.HostConfig.PortBindings = { '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '54442' }] };
      if (fault.startsWith('live-')) c.NetworkSettings.Ports = { '5432/tcp': [{ HostIp: fault === 'live-external' ? '0.0.0.0' : '127.0.0.1',
        HostPort: fault === 'live-wrong-port' ? '55555' : '54442' }] };
    });
  });
  it.each([{}, { '8000/tcp': null }, { '8000/tcp': [] }])('requires actual gateway publication %#', ports => {
    refuse(f => { f.containers[t.gateway].NetworkSettings.Ports = ports; });
  });
  it.each([t.gateway, t.auth, t.rest, t.database, t.edge, t.capture])('rejects %s identity/running/membership substitutions', name => {
    for (const change of [(c: Container) => { c.Name = '/foreign'; }, (c: Container) => { c.State.Running = false; },
      (c: Container) => { c.Id = cid(99); }, (c: Container) => { c.NetworkSettings.Networks[t.network].NetworkID = cid(99); }]) {
      refuse(f => change(f.containers[name]));
    }
  });
  it.each([t.gateway, t.auth, t.rest, t.database, t.edge, t.capture])('rejects foreign project labels on %s', name => {
    refuse(f => { f.containers[name].Config.Labels = { 'com.supabase.cli.project': 'foreign' }; });
  });
  it.each(['wrong-port', 'wildcard', 'ipv6', 'duplicate', 'extra-port', 'wrong-private-port', 'live-only', 'publish-all', 'host-mode'])('rejects gateway %s', fault => {
    refuse(f => {
      const c = f.containers[t.gateway];
      const bindings = [{ HostIp: fault === 'wildcard' ? '0.0.0.0' : fault === 'ipv6' ? '::1' : '127.0.0.1',
        HostPort: fault === 'wrong-port' ? '54321' : '54441' }];
      if (fault === 'duplicate') bindings.push({ ...bindings[0] });
      const ports: Record<string, unknown> = { [fault === 'wrong-private-port' ? '8001/tcp' : '8000/tcp']: bindings };
      if (fault === 'extra-port') ports['8001/tcp'] = [{ HostIp: '127.0.0.1', HostPort: '54446' }];
      if (fault !== 'live-only') c.HostConfig.PortBindings = ports;
      c.NetworkSettings.Ports = fault === 'live-only' ? { '8000/tcp': [{ HostIp: '0.0.0.0', HostPort: '54441' }] } : ports;
      if (fault === 'publish-all') c.HostConfig.PublishAllPorts = true;
      if (fault === 'host-mode') c.HostConfig.NetworkMode = 'host';
    });
  });
  it.each([t.auth, t.rest, t.database, t.edge, t.capture])('rejects extra network on %s', name => {
    refuse(f => { f.containers[name].NetworkSettings.Networks.bridge = { NetworkID: cid(99), Aliases: [] }; }, 'only the isolated network');
  });
  it.each([t.auth, t.rest, t.edge, t.capture])('rejects published ports on %s', name => {
    refuse(f => { f.containers[name].NetworkSettings.Ports['9999/tcp'] = [{ HostIp: '127.0.0.1', HostPort: '55555' }]; });
  });
  it.each(['name', 'driver', 'scope', 'external', 'missing-member', 'forged-name', 'duplicate-name', 'wrong-ingress-id', 'wrong-ingress-member'])('rejects network %s', fault => {
    refuse(f => {
      const n = f.networks[t.network];
      if (fault === 'name') n.Name = 'foreign'; if (fault === 'driver') n.Driver = 'overlay';
      if (fault === 'scope') n.Scope = 'swarm'; if (fault === 'external') n.Internal = false;
      if (fault === 'missing-member') delete n.Containers[f.containers[t.auth].Id];
      if (fault === 'forged-name') n.Containers[f.containers[t.auth].Id].Name = 'foreign';
      if (fault === 'duplicate-name') n.Containers[cid(99)] = { Name: t.auth };
      if (fault === 'wrong-ingress-id') f.networks[t.ingress].Id = cid(99);
      if (fault === 'wrong-ingress-member') f.networks[t.ingress].Containers[f.containers[t.gateway].Id].Name = 'foreign';
    });
  });
  it.each(['Aliases', 'DNSNames'] as const)('rejects extra-member %s shadowing checked hosts', field => {
    refuse(f => { f.containers['supabase_studio_dev-history'].NetworkSettings.Networks[t.ingress][field] = [t.auth.toUpperCase() + '.']; }, 'DNS alias');
  });
  it('rejects forged extra live attachment without a whole-network member allowlist', () => {
    refuse(f => { f.containers['supabase_studio_dev-history'].NetworkSettings.Networks[t.network].NetworkID = cid(99); }, 'live membership');
  });
  it.each(['auth-v1', 'rest-v1', 'functions-v1', 'auth-v1-open', 'auth-v1-open-callback', 'auth-v1-open-authorize', 'well-known-oauth'])('rejects wrong service destination or missing route for %s', name => {
    for (const change of [(s: Service) => { s.host = 'unrelated-stack'; }, (s: Service) => { s.port++; },
      (s: Service) => { s.protocol = 'https'; }, (s: Service) => { s.path = '/foreign'; },
      (s: Service) => { s.enabled = false; }]) {
      refuse(f => change(f.services.find(s => s.name === name)!), 'service mismatch');
    }
    refuse(f => { f.routes = f.routes.filter(r => r.name !== name); }, 'Missing required');
    refuse(f => { f.services = f.services.filter(s => s.name !== name); }, 'service mismatch');
  });
  it.each(['hosts', 'methods', 'strip', 'priority', 'service', 'protocols', 'handling', 'preserve', 'path'])('rejects checked route %s mismatch', fault => {
    refuse(f => {
      const r = f.routes[0];
      if (fault === 'hosts') r.hosts = ['foreign']; if (fault === 'methods') r.methods = ['GET'];
      if (fault === 'strip') r.strip_path = false; if (fault === 'priority') r.regex_priority = 1;
      if (fault === 'service') r.service.id = f.services[7].id;
      if (fault === 'protocols') r.protocols = ['https']; if (fault === 'handling') r.path_handling = 'v1';
      if (fault === 'preserve') r.preserve_host = true; if (fault === 'path') r.paths = ['/auth/v1/admin/users'];
    });
  });
  it.each(['/auth/v1/admin', '/rest/v1/jobs', '/functions/v1/push', '/auth/', '/', '~^/auth/.*', '/.well-known/oauth-authorization-server/foreign'])('rejects shadow route %s even when required routes remain', path => {
    refuse(f => { f.routes.push({ ...f.routes[7], id: 'shadow-id', name: 'shadow', paths: [path] }); });
  });
  it('rejects a second Auth route to the correct service as ambiguous', () => {
    refuse(f => { f.routes.push({ ...f.routes[0], id: 'shadow-id', name: 'shadow' }); }, 'route shadow');
  });
  it('rejects pathless and multi-path checked routes', () => {
    refuse(f => { f.routes[7].paths = null; }, 'route paths');
    refuse(f => { f.routes[0].paths!.push('/storage/v1/'); }, 'route shadow');
  });
  it.each(['services', 'routes', 'upstreams'] as const)('rejects incomplete, malformed, or duplicate %s admin lists', endpoint => {
    for (const output of ['null', '[]', '{', '{"data":null,"next":null}', '{"data":[],"next":"/next"}', '{"data":[]}']) {
      refuse(f => { f.override = parts => parts.at(-1)?.includes(`/${endpoint}?`) ? output : undefined; });
    }
    for (const same of ['id', 'name'] as const) {
      refuse(f => {
        const first = endpoint === 'upstreams' ? { id: 'upstream', name: 'unrelated' } : f[endpoint][0];
        const duplicate = { ...first, id: same === 'id' ? first.id : 'duplicate-id', name: same === 'name' ? first.name : 'duplicate-name' };
        f.override = parts => parts.at(-1)?.includes(`/${endpoint}?`) ? JSON.stringify({ data: [first, duplicate], next: null }) : undefined;
      }, 'Ambiguous');
    }
  });
  it.each([t.auth, t.rest, t.edge])('rejects upstream resolution overriding %s', name => {
    refuse(f => { f.upstreams.push({ id: 'upstream', name }); }, 'upstream shadows');
  });
  it.each(['null', '[{},{}]', '[]', '[null]', '{}'])('rejects ambiguous Docker network response %s', output => {
    refuse(f => { f.override = parts => parts[0] === 'network' ? output : undefined; });
  });
  it('refuses a failed admin read before source comparison and clients', () => {
    const f = fixture(); f.override = parts => { if (parts[2] === 'wget') throw new Error('Admin unavailable'); return undefined; };
    install(f); expect(() => localCampaignHarness()).toThrow('Admin unavailable'); expect(createClient).not.toHaveBeenCalled();
    expect(vi.mocked(execFileSync).mock.calls.some(([, args]) => (args as string[])[2] === 'sh')).toBe(false);
  });
  it('demonstrates the prior three-container network gate admits a foreign API destination', () => {
    const f = fixture(); f.services[0].host = 'unrelated-stack'; install(f);
    expect(() => localCampaignHarness()).toThrow('service mismatch'); expect(createClient).not.toHaveBeenCalled();
    // Reproduce the old admission branch without editing shared files. This
    // negative control must allow client creation despite the same bad route.
    vi.spyOn(historical, 'verifyHistoricalCampaignTarget').mockImplementation(docker => {
      const n = JSON.parse(docker('network', 'inspect', t.network))[0] as Network;
      if (!n.Internal) throw new Error('Historical network must have no external route');
      for (const name of [t.database, t.edge, t.capture]) {
        const c = JSON.parse(docker('inspect', '--type', 'container', name)) as Container;
        if (Object.keys(c.NetworkSettings.Networks).join() !== t.network) throw new Error('only the isolated network');
      }
    });
    expect(() => localCampaignHarness()).not.toThrow(); expect(createClient).toHaveBeenCalledOnce();
  });
});
