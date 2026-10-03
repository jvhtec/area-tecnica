import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

type DockerRead = (...args: string[]) => string;
const serviceSuffixes = {
  'supabase_db_dev-history': 'db', 'supabase_auth_dev-history': 'auth', 'supabase_rest_dev-history': 'rest',
  'supabase_kong_dev-history': 'gateway', 'supabase_edge_runtime_dev-history': 'edge',
  'history-delivery-capture': 'capture', 'supabase_inbucket_dev-history': 'mail',
};
const volumeSuffixes = {
  'supabase_db_dev-history': 'db', 'history_edge_code_dev-history': 'code', 'history_edge_src_dev-history': 'src',
  'history_edge_cache_dev-history': 'cache', 'history_edge_captures_dev-history': 'captures',
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid disposable clone manifest');
  return value as Record<string, unknown>;
}

export function parseDisposableCampaignTarget(value: unknown) {
  const manifest = record(value);
  const identity = manifest.identity;
  if (typeof identity !== 'string' || !/^matrix-fault-[a-f0-9]{10}$/.test(identity)) throw new Error('Invalid disposable clone identity');
  if (manifest.network !== identity || manifest.ingress !== `${identity}-ingress`) throw new Error('Invalid disposable clone networks');
  if (typeof manifest.url !== 'string' || !/^http:\/\/127\.0\.0\.1:\d{4,5}$/.test(manifest.url)) throw new Error('Disposable gateway must use loopback');
  const port = Number(new URL(manifest.url).port);
  if (port > 65535 || port < 1024 || [54321,54322,54323,54324,54325,54441,54442,54443,54444,54445].includes(port)) {
    throw new Error('Disposable gateway cannot reuse a persistent stack port');
  }
  const containers = record(manifest.containers);
  const volumes = record(manifest.volumes);
  for (const [source, suffix] of Object.entries(serviceSuffixes)) {
    if (containers[source] !== `${identity}-${suffix}`) throw new Error('Disposable container must belong to clone identity');
  }
  for (const [source, suffix] of Object.entries(volumeSuffixes)) {
    if (volumes[source] !== `${identity}-${suffix}`) throw new Error('Disposable volume must belong to clone identity');
  }
  return Object.freeze({ identity, network: identity, ingress: `${identity}-ingress`, url: manifest.url,
    port: String(port), database: `${identity}-db`, edge: `${identity}-edge`, capture: `${identity}-capture`,
    containers: Object.freeze(Object.values(serviceSuffixes).map(suffix => `${identity}-${suffix}`)),
    volumes: Object.freeze(Object.values(volumeSuffixes).map(suffix => `${identity}-${suffix}`)) });
}

export function readDisposableCampaignTarget() {
  const path = process.env.STAFFING_DISPOSABLE_MANIFEST;
  if (!path || !isAbsolute(path)) throw new Error('Absolute private disposable manifest path is required');
  return parseDisposableCampaignTarget(JSON.parse(readFileSync(path, 'utf8')));
}

export function verifyDisposableCampaignTarget(target: ReturnType<typeof parseDisposableCampaignTarget>, docker: DockerRead) {
  const owned = (labels: Record<string, string> | null | undefined) => labels?.['local.matrix-fault'] === target.identity;
  const network = JSON.parse(docker('network', 'inspect', target.network))[0];
  if (!network.Internal || !owned(network.Labels)) throw new Error('Disposable network must be owned and internal');
  for (const volume of target.volumes) {
    const inspected = JSON.parse(docker('volume', 'inspect', volume))[0];
    if (!owned(inspected.Labels)) throw new Error('Disposable volume ownership failed');
    const options = inspected.Options;
    if (inspected.Driver !== 'local' || (options != null &&
        (typeof options !== 'object' || Array.isArray(options) || Object.keys(options).length))) {
      throw new Error('Disposable volumes must use plain local storage without backing options');
    }
  }
  for (const name of target.containers) {
    const container = JSON.parse(docker('inspect', '--type', 'container', name))[0];
    if (!owned(container.Config?.Labels) || !container.State?.Running) throw new Error('Disposable container must be owned and running');
    const isGateway = name === `${target.identity}-gateway`;
    const networks = Object.keys(container.NetworkSettings.Networks).sort();
    const required = (isGateway ? [target.network, target.ingress] : [target.network]).sort();
    if (networks.join() !== required.join()) throw new Error('Disposable service has an unexpected network');
    const bindings = container.HostConfig.PortBindings ?? {};
    if (isGateway) {
      if (Object.keys(bindings).join() !== '8000/tcp' || JSON.stringify(bindings['8000/tcp']) !==
          JSON.stringify([{ HostIp: '127.0.0.1', HostPort: target.port }])) throw new Error('Disposable gateway binding must match loopback manifest');
    } else if (Object.keys(bindings).length) throw new Error('Disposable data services cannot publish ports');
    for (const mount of container.Mounts ?? []) {
      if (mount.Type === 'volume' && !target.volumes.includes(mount.Name)) throw new Error('Disposable service reuses an unowned volume');
      if (mount.Type === 'bind' && mount.RW) throw new Error('Disposable service cannot write a host bind mount');
    }
  }
}
