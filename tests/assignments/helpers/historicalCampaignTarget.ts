type DockerRead = (...args: string[]) => string;
type Metadata = Record<string, unknown>;

export const historicalCampaignTarget = Object.freeze({
  database: 'supabase_db_dev-history', url: 'http://127.0.0.1:54441',
  edge: 'supabase_edge_runtime_dev-history', capture: 'history-delivery-capture',
  gateway: 'supabase_kong_dev-history', auth: 'supabase_auth_dev-history', rest: 'supabase_rest_dev-history',
  network: 'area-tecnica-history', ingress: 'supabase_network_dev-history',
});

// Never inspect Config.Env or Kong's declarative file: both contain keys.
const containerFormat = '{"Id":{{json .Id}},"Name":{{json .Name}},"State":{"Running":{{json .State.Running}}},' +
  '"Config":{"Labels":{{json .Config.Labels}}},"HostConfig":{"NetworkMode":{{json .HostConfig.NetworkMode}},' +
  '"PublishAllPorts":{{json .HostConfig.PublishAllPorts}},"PortBindings":{{json .HostConfig.PortBindings}}},' +
  '"NetworkSettings":{"Networks":{{json .NetworkSettings.Networks}},"Ports":{{json .NetworkSettings.Ports}}}}';

function record(value: unknown): Metadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid historical target metadata');
  return value as Metadata;
}
function resourceId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid historical resource ID');
  return value;
}
function inspectNetwork(docker: DockerRead, name: string, internal: boolean) {
  const result: unknown = JSON.parse(docker('network', 'inspect', name));
  if (!Array.isArray(result) || result.length !== 1) throw new Error('Ambiguous historical network inspection');
  const network = record(result[0]);
  // Keep the existing refusal diagnostic, including for minimal unsafe responses.
  if (internal && network.Internal !== true) throw new Error('Historical network must have no external route');
  if (network.Name !== name || network.Internal !== internal || network.Driver !== 'bridge' || network.Scope !== 'local') {
    throw new Error('Historical network identity or driver mismatch');
  }
  return { id: resourceId(network.Id), name, members: record(network.Containers) };
}
function inspectContainer(docker: DockerRead, identity: string) {
  return record(JSON.parse(docker('inspect', '--type', 'container', '--format', containerFormat, identity)) as unknown);
}
function verifyPorts(value: unknown, port?: string, hostPort?: string, unpublishedDatabase = false) {
  const ports = value == null ? {} : record(value);
  // Docker includes unpublished exposed ports as null in NetworkSettings.Ports.
  const published = Object.entries(ports).filter(([, bindings]) => bindings !== null &&
    !(unpublishedDatabase && Array.isArray(bindings) && bindings.length === 0));
  // Reconnecting the DB to the internal network can remove live publication
  // while preserving the configured loopback binding. Gateway publication is
  // mandatory; this exception is exclusively for the DB's live port map.
  if (unpublishedDatabase && published.length === 0) return;
  if (published.length !== (port ? 1 : 0) || (port && published[0][0] !== port)) {
    throw new Error('Unexpected historical published ports');
  }
  if (!port) return;
  const bindings = published[0][1];
  if (!Array.isArray(bindings) || bindings.length !== 1) throw new Error('Historical port must use loopback binding');
  const binding = record(bindings[0]);
  if (binding.HostIp !== '127.0.0.1' || binding.HostPort !== hostPort) throw new Error('Historical port must use loopback binding');
}

const t = historicalCampaignTarget;
const routeSpecs = [
  { name: 'auth-v1', host: t.auth, port: 9999, path: '/', route: '/auth/v1/' },
  { name: 'rest-v1', host: t.rest, port: 3000, path: '/', route: '/rest/v1/' },
  { name: 'functions-v1', host: t.edge, port: 8081, path: '/', route: '/functions/v1/' },
  { name: 'auth-v1-open', host: t.auth, port: 9999, path: '/verify', route: '/auth/v1/verify' },
  { name: 'auth-v1-open-callback', host: t.auth, port: 9999, path: '/callback', route: '/auth/v1/callback' },
  { name: 'auth-v1-open-authorize', host: t.auth, port: 9999, path: '/authorize', route: '/auth/v1/authorize' },
  { name: 'well-known-oauth', host: t.auth, port: 9999, path: '/.well-known/oauth-authorization-server', route: '/.well-known/oauth-authorization-server' },
];
const dnsHost = (host: string) => host.toLowerCase().replace(/\.$/, '');
const checkedHosts = new Set<string>([t.auth, t.rest, t.edge]);

function adminList(docker: DockerRead, gatewayId: string, endpoint: 'services' | 'routes' | 'upstreams') {
  const urls = { services: 'http://127.0.0.1:8001/services?size=1000',
    routes: 'http://127.0.0.1:8001/routes?size=1000', upstreams: 'http://127.0.0.1:8001/upstreams?size=1000' };
  const response = record(JSON.parse(docker('exec', gatewayId, 'wget', '-qO-', urls[endpoint])) as unknown);
  if (response.next !== null || !Array.isArray(response.data)) throw new Error('Incomplete historical Kong admin list');
  const ids = new Set<string>(), names = new Set<string>();
  return response.data.map((value: unknown) => {
    const entry = record(value);
    if (typeof entry.id !== 'string' || !entry.id || typeof entry.name !== 'string' || !entry.name ||
        ids.has(entry.id) || names.has(entry.name)) throw new Error('Ambiguous historical Kong admin entries');
    ids.add(entry.id); names.add(entry.name);
    return entry;
  });
}

function verifyRouting(docker: DockerRead, gatewayId: string) {
  const services = adminList(docker, gatewayId, 'services');
  const routes = adminList(docker, gatewayId, 'routes');
  const upstreams = adminList(docker, gatewayId, 'upstreams');
  if (upstreams.some(entry => checkedHosts.has(dnsHost(String(entry.name))))) {
    throw new Error('Historical Kong upstream shadows a checked host');
  }
  const expectedServices = new Map(routeSpecs.map(spec => {
    const service = services.find(entry => entry.name === spec.name);
    if (!service || service.host !== spec.host || service.port !== spec.port || service.protocol !== 'http' ||
        service.path !== spec.path || service.enabled !== true) throw new Error(`Historical Kong service mismatch: ${spec.name}`);
    return [spec.route, service.id];
  }));
  const seen = new Set<string>();
  for (const route of routes) {
    // A pathless/regex route could shadow any API. Refuse rather than guess
    // Kong's ordering or evaluate an untrusted regex inside this admission gate.
    if (!Array.isArray(route.paths) || !route.paths.length || route.paths.some(path =>
      typeof path !== 'string' || !/^\/[a-zA-Z0-9/_.-]*$/.test(path))) throw new Error('Ambiguous historical Kong route paths');
    const paths = route.paths as string[];
    const overlaps = paths.some(path => routeSpecs.some(spec => path.startsWith(spec.route) || spec.route.startsWith(path)));
    if (!overlaps) continue;
    const path = paths[0];
    if (paths.length !== 1 || !expectedServices.has(path) || seen.has(path) ||
        record(route.service).id !== expectedServices.get(path) || route.strip_path !== true ||
        route.hosts !== null || route.methods !== null || route.regex_priority !== 0 ||
        route.headers !== null || route.snis !== null || route.sources !== null || route.destinations !== null ||
        route.path_handling !== 'v0' || route.preserve_host !== false ||
        !Array.isArray(route.protocols) || [...route.protocols].sort().join() !== 'http,https') {
      throw new Error('Historical Kong route shadow or mismatch');
    }
    seen.add(path);
  }
  if (seen.size !== routeSpecs.length) throw new Error('Missing required historical Kong route');
}

/** Read-only admission must finish before creating any SDK client or fixture. */
export function verifyHistoricalCampaignTarget(docker: DockerRead) {
  const network = inspectNetwork(docker, t.network, true);
  const names = [t.database, t.edge, t.capture, t.gateway, t.auth, t.rest];
  const containers = new Map<string, Metadata>();
  const ids = new Set<string>();
  for (const name of names) {
    const container = inspectContainer(docker, name);
    const settings = record(container.NetworkSettings), networks = record(settings.Networks);
    const expected = name === t.gateway ? [t.network, t.ingress] : [t.network];
    if (Object.keys(networks).sort().join() !== [...expected].sort().join()) {
      throw new Error('Database, runtime, capture, Auth and REST must use only the isolated network; gateway must use its two owned networks');
    }
    const id = resourceId(container.Id);
    if (container.Name !== `/${name}` || record(container.State).Running !== true || ids.has(id)) {
      throw new Error('Historical container identity or running state mismatch');
    }
    ids.add(id);
    if (record(networks[t.network]).NetworkID !== network.id || record(network.members[id]).Name !== name ||
        Object.entries(network.members).some(([memberId, member]) => memberId !== id && record(member).Name === name)) {
      throw new Error('Historical network membership mismatch');
    }
    if (record(record(container.Config).Labels)['com.supabase.cli.project'] !== 'dev-history') {
      throw new Error('Historical container project label mismatch');
    }
    const host = record(container.HostConfig);
    // Docker retains the creation NetworkMode after network disconnect/connect.
    // The live attachments above prove isolation; reject modes that bypass it.
    if (host.PublishAllPorts !== false || typeof host.NetworkMode !== 'string' || !host.NetworkMode ||
        ['host', 'none'].includes(host.NetworkMode) || host.NetworkMode.startsWith('container:')) {
      throw new Error('Unsafe historical container network mode or publication');
    }
    const port = name === t.gateway ? '8000/tcp' : name === t.database ? '5432/tcp' : undefined;
    const hostPort = name === t.gateway ? '54441' : name === t.database ? '54442' : undefined;
    verifyPorts(host.PortBindings, port, hostPort);
    verifyPorts(settings.Ports, port, hostPort, name === t.database);
    containers.set(name, container);
  }
  const ingress = inspectNetwork(docker, t.ingress, false);
  if (ingress.id === network.id) throw new Error('Ambiguous historical network IDs');
  const gatewayId = resourceId(containers.get(t.gateway)!.Id);
  const gatewayNetworks = record(record(containers.get(t.gateway)!.NetworkSettings).Networks);
  if (record(gatewayNetworks[t.ingress]).NetworkID !== ingress.id || record(ingress.members[gatewayId]).Name !== t.gateway) {
    throw new Error('Historical gateway ingress membership mismatch');
  }
  // Other historical services legitimately share these networks. Inspect their
  // live CIDs without imposing a six-member allowlist, and refuse DNS aliases
  // that could resolve a checked service host to a different container.
  for (const inspectedNetwork of [network, ingress]) {
    for (const [memberId, member] of Object.entries(inspectedNetwork.members)) {
      resourceId(memberId);
      const name = record(member).Name;
      if (typeof name !== 'string' || !name) throw new Error('Invalid historical network member name');
      const container = containers.get(name) ?? inspectContainer(docker, memberId);
      if (container.Id !== memberId || container.Name !== `/${name}`) throw new Error('Historical live membership identity mismatch');
      const endpoint = record(record(record(container.NetworkSettings).Networks)[inspectedNetwork.name]);
      if (endpoint.NetworkID !== inspectedNetwork.id) throw new Error('Historical live membership network mismatch');
      const aliases: string[] = [name];
      for (const field of ['Aliases', 'DNSNames']) {
        if (endpoint[field] == null) continue;
        const values = endpoint[field];
        if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) throw new Error('Invalid historical DNS aliases');
        aliases.push(...values as string[]);
      }
      if (aliases.some(alias => checkedHosts.has(dnsHost(alias)) && dnsHost(alias) !== name)) {
        throw new Error('Historical DNS alias shadows a checked host');
      }
    }
  }
  verifyRouting(docker, gatewayId);
}
