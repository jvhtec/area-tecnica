import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { URL } from 'node:url';

// Filesystem paths even under jsdom: avoid Vite's browser asset URL transform.
const runtimeDirectory = '../runtime/';
const configPath = '../../../supabase/config.toml';

type DockerRead = (...args: string[]) => string;
type Service = Readonly<{ name: string; id: string; image: string }>;
const suffixes = ['auth', 'rest', 'gateway', 'edge', 'capture'] as const;
const persistentPorts = [54321, 54322, 54323, 54324, 54325, 54441, 54442, 54443, 54444, 54445, 54512];

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid CI target object');
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) {
    throw new Error('Unexpected CI manifest keys');
  }
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid CI resource ID');
  return value;
}
function image(value: unknown): string {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error('Invalid CI image ID');
  return value;
}
function service(value: unknown, name: string, dbIngress = false): Service {
  const entry = record(value);
  exactKeys(entry, dbIngress ? ['name', 'id', 'image', 'port'] : ['name', 'id', 'image']);
  if (entry.name !== name || (dbIngress && entry.port !== 54512)) throw new Error('Invalid CI service identity');
  return Object.freeze({ name, id: id(entry.id), image: image(entry.image) });
}

export function parseCiCampaignTarget(value: unknown) {
  const manifest = record(value);
  exactKeys(manifest, ['identity', 'network', 'networkId', 'ingress', 'ingressId', 'url', 'database', 'databaseId', 'services', 'volumes'], ['dbIngress']);
  const identity = manifest.identity;
  if (typeof identity !== 'string' || !/^staffing-ci-[a-f0-9]{10}$/.test(identity)) throw new Error('Invalid CI identity');
  const network = `supabase_network_${identity}`;
  const ingress = `${identity}-ingress`;
  const database = `supabase_db_${identity}`;
  if (manifest.network !== network || manifest.ingress !== ingress || manifest.database !== database) throw new Error('Invalid CI resource identity');
  if (typeof manifest.url !== 'string' || !/^http:\/\/127\.0\.0\.1:[1-9]\d{3,4}$/.test(manifest.url)) throw new Error('CI gateway must use loopback');
  const port = Number(new URL(manifest.url).port);
  if (port < 1024 || port > 65535 || persistentPorts.includes(port)) throw new Error('CI gateway cannot reuse a persistent stack port');
  const entries = record(manifest.services);
  exactKeys(entries, [...suffixes]);
  const services = Object.freeze({
    auth: service(entries.auth, `${identity}-auth`), rest: service(entries.rest, `${identity}-rest`),
    gateway: service(entries.gateway, `${identity}-gateway`), edge: service(entries.edge, `${identity}-edge`),
    capture: service(entries.capture, `${identity}-capture`),
  });
  const dbIngress = Object.hasOwn(manifest, 'dbIngress')
    ? Object.freeze({ ...service(manifest.dbIngress, `${identity}-db-ingress`, true), port: 54512 as const }) : undefined;
  const volumes = record(manifest.volumes);
  exactKeys(volumes, ['database', 'code', 'cache']);
  if (volumes.database !== database || volumes.code !== `${identity}-code` || volumes.cache !== `${identity}-cache`) throw new Error('Invalid CI volume identity');
  const networkId = id(manifest.networkId), ingressId = id(manifest.ingressId), databaseId = id(manifest.databaseId);
  const ids = [networkId, ingressId, databaseId, ...Object.values(services).map(entry => entry.id), ...(dbIngress ? [dbIngress.id] : [])];
  if (new Set(ids).size !== ids.length) throw new Error('Ambiguous CI resource IDs');
  return Object.freeze({ identity, network, networkId, ingress, ingressId, database, databaseId, services, dbIngress,
    url: manifest.url, port: String(port), edge: services.edge.name, capture: services.capture.name,
    volumes: Object.freeze({ database, code: `${identity}-code`, cache: `${identity}-cache` }) });
}
export type CiCampaignTarget = ReturnType<typeof parseCiCampaignTarget>;

export function readCiCampaignTarget() {
  const path = process.env.STAFFING_CI_MANIFEST;
  if (!path || !isAbsolute(path)) throw new Error('Absolute private CI manifest path is required');
  return parseCiCampaignTarget(JSON.parse(readFileSync(path, 'utf8')) as unknown);
}

function inspect(docker: DockerRead, ...args: string[]) {
  const result: unknown = JSON.parse(docker(...args));
  if (!Array.isArray(result) || result.length !== 1) throw new Error('Ambiguous CI Docker inspection');
  return record(result[0]);
}
function sameKeys(actual: Record<string, unknown>, expected: string[], message: string) {
  if (Object.keys(actual).sort().join() !== [...expected].sort().join()) throw new Error(message);
}
function owned(value: unknown, label: string, identity: string) {
  const labels = record(value);
  if (labels[label] !== identity ||
      ['com.supabase.cli.project', 'local.staffing-ci', 'local.matrix-fault'].some(key => Object.hasOwn(labels, key) && labels[key] !== identity)) {
    throw new Error('CI resource ownership failed');
  }
}
function ports(value: unknown, port: string | undefined, hostPort: string) {
  const bindings = value == null ? {} : record(value);
  sameKeys(bindings, port ? [port] : [], 'Unexpected CI published ports');
  if (!port) return;
  const list = bindings[port];
  if (!Array.isArray(list) || list.length !== 1) throw new Error('CI binding must match loopback manifest');
  const binding = record(list[0]);
  sameKeys(binding, ['HostIp', 'HostPort'], 'Invalid CI port binding');
  if (binding.HostIp !== '127.0.0.1' || binding.HostPort !== hostPort) throw new Error('CI binding must match loopback manifest');
}

function verifyHandlerManifest(target: CiCampaignTarget, docker: DockerRead) {
  const handlers = ['staffing-orchestrator', 'send-staffing-email', 'notify-staffing-cancellation', 'push', 'manage-flex-crew-assignments'];
  // Match the repository gateway default: absent or unspecified verify_jwt is true.
  // This deliberately accepts only the current bare-table/bare-key config form;
  // alternative or duplicate exposure declarations require review, never guessing.
  const expected = new Map(handlers.map(name => [name, true]));
  const tables = new Set<string>(), declarations = new Set<string>();
  let current = '';
  const config = readFileSync(new URL(configPath, import.meta.url), 'utf8');
  for (const raw of config.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    if (line.startsWith('[')) {
      const table = /^\[([\w-]+(?:\.[\w-]+)*)\]$/.exec(line)?.[1];
      if (!table || tables.has(table) || (table.startsWith('functions') && !/^functions\.[\w-]+$/.test(table))) {
        throw new Error('Ambiguous or unsupported CI JWT config table');
      }
      tables.add(table); current = table;
      continue;
    }
    const assignment = /^([\w-]+)\s*=\s*(.*)$/.exec(line);
    if (!assignment || assignment[2].includes('"""') || assignment[2].includes("'''")) {
      throw new Error('Unsupported CI JWT config syntax');
    }
    const name = current.slice('functions.'.length);
    if (!current.startsWith('functions.') || !expected.has(name) || assignment[1] !== 'verify_jwt') continue;
    if (declarations.has(name) || !/^(true|false)$/.test(assignment[2])) throw new Error('Ambiguous or invalid CI verify_jwt setting');
    declarations.add(name); expected.set(name, assignment[2] === 'true');
  }
  const manifest = record(JSON.parse(docker('exec', target.edge, 'cat', '/local/manifest.json')) as unknown);
  sameKeys(manifest, handlers, 'CI handler manifest must contain exactly the five application handlers');
  for (const name of handlers) {
    const entry = record(manifest[name]);
    sameKeys(entry, ['verify_jwt'], 'Unexpected CI handler manifest fields');
    if (entry.verify_jwt !== expected.get(name)) throw new Error(`CI handler JWT exposure is stale: ${name}`);
  }
}

/** Admission uses Docker facts and public checkout bytes, never manifest hashes. */
export function verifyCiCampaignTarget(target: CiCampaignTarget, docker: DockerRead) {
  const cli = 'com.supabase.cli.project', local = 'local.staffing-ci';
  const containers: Array<{ name: string; id: string; image?: string }> = [
    { name: target.database, id: target.databaseId }, ...Object.values(target.services), ...(target.dbIngress ? [target.dbIngress] : []),
  ];
  for (const [name, expectedId, internal, label, members] of [
    [target.network, target.networkId, true, cli, containers],
    [target.ingress, target.ingressId, false, local, [target.services.gateway, ...(target.dbIngress ? [target.dbIngress] : [])]],
  ] as const) {
    const network = inspect(docker, 'network', 'inspect', expectedId);
    if (network.Id !== expectedId || network.Name !== name || network.Internal !== internal || network.Driver !== 'bridge' || network.Scope !== 'local') {
      throw new Error('CI network identity or routing failed');
    }
    owned(network.Labels, label, target.identity);
    const membership = record(network.Containers);
    sameKeys(membership, members.map(entry => entry.id), 'Unexpected CI network membership');
    for (const entry of members) if (record(membership[entry.id]).Name !== entry.name) throw new Error('CI network member identity failed');
  }
  for (const [role, name] of Object.entries(target.volumes)) {
    const volume = inspect(docker, 'volume', 'inspect', name);
    owned(volume.Labels, role === 'database' ? cli : local, target.identity);
    if (volume.Name !== name || volume.Driver !== 'local' || volume.Scope !== 'local' ||
        (volume.Options != null && Object.keys(record(volume.Options)).length)) throw new Error('CI volumes must use owned plain local storage');
  }
  for (const entry of containers) {
    const container = inspect(docker, 'inspect', '--type', 'container', entry.id);
    if (container.Id !== entry.id || container.Name !== `/${entry.name}` || record(container.State).Running !== true ||
        (entry.image ? container.Image !== entry.image : image(container.Image) !== container.Image)) throw new Error('CI container ID, image or running state failed');
    owned(record(container.Config).Labels, entry.name === target.database ? cli : local, target.identity);
    const isGateway = entry.name === target.services.gateway.name, isDbIngress = entry.name === target.dbIngress?.name;
    const networks = record(record(container.NetworkSettings).Networks);
    sameKeys(networks, [target.network, ...(isGateway || isDbIngress ? [target.ingress] : [])], 'Unexpected CI container network');
    for (const [name, attachment] of Object.entries(networks)) {
      if (record(attachment).NetworkID !== (name === target.network ? target.networkId : target.ingressId)) throw new Error('CI network ID mismatch');
    }
    const host = record(container.HostConfig);
    if (host.NetworkMode === 'host' || host.PublishAllPorts === true || (host.VolumesFrom != null &&
        (!Array.isArray(host.VolumesFrom) || host.VolumesFrom.length))) throw new Error('Unexpected CI external routing or inherited mounts');
    const published = isGateway ? '8000/tcp' : isDbIngress ? '5432/tcp' : undefined;
    const hostPort = isDbIngress ? '54512' : target.port;
    ports(host.PortBindings, published, hostPort);
    // Docker lists unbound EXPOSE ports as null; any actual binding must also match.
    const livePorts = record(container.NetworkSettings).Ports;
    if (livePorts != null) ports(Object.fromEntries(Object.entries(record(livePorts)).filter(([, value]) => value != null)), published, hostPort);
    const mounts = container.Mounts;
    if (!Array.isArray(mounts)) throw new Error('Invalid CI mounts');
    const required = entry.name === target.database ? [{ name: target.volumes.database, destination: '/var/lib/postgresql/data', rw: true }]
      : entry.name === target.edge ? [{ name: target.volumes.code, destination: '/local', rw: false }, { name: target.volumes.cache, destination: '/cache', rw: true }] : [];
    const seen = new Set<string>();
    for (const value of mounts) {
      const mount = record(value);
      if (typeof mount.Destination !== 'string' || seen.has(mount.Destination)) throw new Error('Ambiguous CI mount');
      seen.add(mount.Destination);
      if (mount.Type === 'volume') {
        const expected = required.find(item => item.destination === mount.Destination);
        if (!expected || mount.Name !== expected.name || mount.RW !== expected.rw || mount.Driver !== 'local') throw new Error('Unexpected or unowned CI volume mount');
      } else if (mount.Type !== 'bind' || mount.RW !== false ||
          !((isGateway && mount.Destination === '/gateway.py') || (entry.name === target.capture && mount.Destination === '/capture.py') ||
            (isDbIngress && mount.Destination === '/tunnel.py'))) {
        throw new Error('Unknown or writable CI bind mount');
      }
    }
    if (required.some(mount => !seen.has(mount.destination))) throw new Error('Missing required CI volume mount');
  }
  const assets = [
    [target.edge, '/local/main/index.ts', 'supervisor.ts'], [target.edge, '/local/worker.ts', 'worker.ts'],
    [target.edge, '/local/outbound.ts', 'outbound.ts'], [target.capture, '/capture.py', 'capture.py'],
    [target.services.gateway.name, '/gateway.py', 'gateway.py'],
    [target.edge, '/local/types.ts', 'types.ts'], [target.edge, '/local/main/types.ts', 'types.ts'],
    [target.edge, '/local/_ci-probe-modern/index.ts', '_ci-probe-modern/index.ts'],
    [target.edge, '/local/_ci-probe-legacy/index.ts', '_ci-probe-legacy/index.ts'],
    ...(target.dbIngress ? [[target.dbIngress.name, '/tunnel.py', 'database-tunnel.py']] : []),
  ];
  for (const [container, path, file] of assets) {
    const expected = readFileSync(new URL(runtimeDirectory + file, import.meta.url), 'utf8');
    if (docker('exec', container, 'cat', path) !== expected) throw new Error(`CI runtime asset is stale: ${file}`);
  }
  verifyHandlerManifest(target, docker);
}
