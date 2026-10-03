import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import ts from 'typescript';

const checkoutDirectory = '../../';
const defaultCheckout = fileURLToPath(new URL(checkoutDirectory, import.meta.url));
export const STAFFING_EDGE_ROOTS = Object.freeze([
  'staffing-orchestrator', 'send-staffing-email', 'notify-staffing-cancellation', 'push', 'manage-flex-crew-assignments',
]);
const prelude = Buffer.from("import '../../outbound.ts';\n");
const runtimeAssets = [
  ['supervisor.ts', 'main/index.ts'], ['types.ts', 'types.ts'], ['types.ts', 'main/types.ts'],
  ['worker.ts', 'worker.ts'], ['outbound.ts', 'outbound.ts'],
  ['_ci-probe-modern/index.ts', '_ci-probe-modern/index.ts'], ['_ci-probe-legacy/index.ts', '_ci-probe-legacy/index.ts'],
];

/** @param {Buffer} bytes */
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
/** @param {string} parent @param {string} path */
function inside(parent, path) {
  const part = relative(parent, path);
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`));
}
/** @param {string} path @param {boolean} [allowMissing] */
function noLinks(path, allowMissing = false) {
  let current = parse(path).root;
  for (const component of path.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, component);
    let stat;
    try { stat = lstatSync(current); }
    catch (error) {
      if (allowMissing && /** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error('Staging paths cannot contain symlinks');
    if (current !== path && !stat.isDirectory()) throw new Error('Staging ancestor must be a directory');
  }
}
/** @param {string} path */
function destinationReady(path) {
  noLinks(path, true);
  try {
    if (!lstatSync(path).isDirectory() || readdirSync(path).length) throw new Error('Staging destination must be absent or empty; refusing overwrite');
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error;
  }
}

/** Read and validate the same open file, so a pathname swap cannot redirect a
 * checked read. Nonblocking open also avoids hanging on a substituted FIFO.
 * @param {string} path
 */
function sourceBytes(path) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile()) throw new Error('Staging source must be a regular file');
    noLinks(path);
    const bytes = readFileSync(fd);
    const after = fstatSync(fd, { bigint: true });
    const named = lstatSync(path, { bigint: true });
    if (!named.isFile() || before.dev !== named.dev || before.ino !== named.ino ||
        before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs ||
        after.size !== named.size || after.mtimeNs !== named.mtimeNs || after.ctimeNs !== named.ctimeNs) {
      throw new Error('Source changed during staging preflight');
    }
    noLinks(path);
    return bytes;
  } finally { closeSync(fd); }
}

/** @param {string} file @param {Buffer} bytes @param {(specifier: string) => void} visit */
function localImports(file, bytes, visit) {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  if (/** @type {ts.SourceFile & {parseDiagnostics: readonly ts.Diagnostic[]}} */ (ast).parseDiagnostics.length) {
    throw new Error(`Invalid TypeScript source: ${file}`);
  }
  /** @param {ts.Node | undefined} value */
  function literal(value) {
    if (!value || !ts.isStringLiteral(value)) throw new Error(`Unresolved dynamic/local import: ${file}`);
    const specifier = value.text;
    if (specifier.startsWith('/') || specifier.startsWith('\\') || /^file:|^[a-z]:/i.test(specifier)) throw new Error('Absolute local import is not permitted');
    if (specifier.startsWith('.')) {
      if (!/^\.\.?\//.test(specifier) || specifier.includes('\\')) throw new Error('Ambiguous local import');
      visit(specifier);
    }
  }
  /** @param {ts.Node} node */
  function walk(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) literal(node.moduleSpecifier);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) literal(node.arguments[0]);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) literal(node.moduleReference.expression);
    if (ts.isImportTypeNode(node)) literal(ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined);
    ts.forEachChild(node, walk);
  }
  walk(ast);
}

/** @param {string} importer @param {string} specifier @param {string} boundary */
function localPath(importer, specifier, boundary) {
  const url = new URL(specifier, pathToFileURL(importer));
  if (url.search || url.hash) throw new Error('Ambiguous local import query or fragment');
  const path = fileURLToPath(url);
  if (!inside(boundary, path) || !path.endsWith('.ts')) throw new Error('Local source import escapes its TypeScript tree');
  return path;
}

/** Match ciCampaignTarget's explicit boolean/default-true config policy.
 * @param {Buffer} bytes
 */
function jwtManifest(bytes) {
  const flags = new Map(STAFFING_EDGE_ROOTS.map(name => [name, true]));
  const tables = new Set(), declarations = new Set();
  let current = '';
  for (const raw of new TextDecoder('utf-8', { fatal: true }).decode(bytes).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    if (line.startsWith('[')) {
      const table = /^\[([\w-]+(?:\.[\w-]+)*)\]$/.exec(line)?.[1];
      if (!table || tables.has(table) || (table.startsWith('functions') && !/^functions\.[\w-]+$/.test(table))) throw new Error('Ambiguous or unsupported JWT config table');
      tables.add(table); current = table; continue;
    }
    const assignment = /^([\w-]+)\s*=\s*(.*)$/.exec(line);
    if (!assignment || assignment[2].includes('"""') || assignment[2].includes("'''")) throw new Error('Unsupported JWT config syntax');
    const name = current.slice('functions.'.length);
    if (!current.startsWith('functions.') || !flags.has(name) || assignment[1] !== 'verify_jwt') continue;
    if (declarations.has(name) || !/^(true|false)$/.test(assignment[2])) throw new Error('Ambiguous or invalid verify_jwt setting');
    declarations.add(name); flags.set(name, assignment[2] === 'true');
  }
  return Object.fromEntries([...flags].map(([name, flag]) => [name, { verify_jwt: flag }]));
}

/** Build a fresh, byte-preserving source projection, without environment or services.
 * @param {{outputDirectory: string, checkoutRoot?: string}} options
 */
export function stageStaffingEdge({ outputDirectory, checkoutRoot = defaultCheckout }) {
  if (typeof outputDirectory !== 'string' || typeof checkoutRoot !== 'string' || !isAbsolute(outputDirectory) || !isAbsolute(checkoutRoot)) throw new Error('Absolute checkout and output paths are required');
  const checkout = resolve(checkoutRoot), output = resolve(outputDirectory);
  if (output === parse(output).root || inside(checkout, output) || inside(output, checkout)) throw new Error('Staging output must be outside and separate from checkout');
  noLinks(checkout); destinationReady(output);
  const functions = join(checkout, 'supabase/functions');
  const runtime = join(checkout, 'tests/assignments/runtime');
  /** @type {Map<string, Buffer>} */
  const inputs = new Map();
  /** @type {Map<string, {bytes: Buffer, source: string | null, prelude: boolean}>} */
  const plan = new Map();
  /** @param {string} path */
  function read(path) {
    if (inputs.has(path)) return /** @type {Buffer} */ (inputs.get(path));
    if (!inside(checkout, path)) throw new Error('Source escapes checkout');
    const bytes = sourceBytes(path); inputs.set(path, bytes); return bytes;
  }
  const manifest = jwtManifest(read(join(checkout, 'supabase/config.toml')));
  const entrypoints = new Set(STAFFING_EDGE_ROOTS.map(name => join(functions, name, 'index.ts')));
  /** @param {string} path */
  function visit(path) {
    const name = `functions/${relative(functions, path).split(sep).join('/')}`;
    if (plan.has(name)) return;
    const bytes = read(path);
    plan.set(name, { bytes: entrypoints.has(path) ? Buffer.concat([prelude, bytes]) : bytes, source: path, prelude: entrypoints.has(path) });
    localImports(path, bytes, specifier => visit(localPath(path, specifier, functions)));
  }
  entrypoints.forEach(visit);
  for (const [source, target] of runtimeAssets) plan.set(target, { bytes: read(join(runtime, source)), source: join(runtime, source), prelude: false });
  // Resolve runtime imports against their staged locations, including the
  // supervisor's duplicated sibling types.ts, rather than changing any bytes.
  for (const [, target] of runtimeAssets) {
    const path = join(output, target);
    localImports(path, /** @type {{bytes: Buffer}} */ (plan.get(target)).bytes, specifier => {
      const dependency = relative(output, localPath(path, specifier, output)).split(sep).join('/');
      if (!plan.has(dependency) || dependency.startsWith('functions/')) throw new Error('Runtime dependency is not an approved staged asset');
    });
  }
  plan.set('manifest.json', { bytes: Buffer.from(JSON.stringify(manifest, null, 2) + '\n'), source: null, prelude: false });
  const portablePaths = new Set();
  for (const name of plan.keys()) {
    const key = name.toLowerCase();
    if (portablePaths.has(key)) throw new Error('Staged paths would overwrite each other on a case-insensitive filesystem');
    portablePaths.add(key);
  }
  // Recheck the entire read set and destination before creating directories or
  // files. Refuse a changed checkout instead of silently staging stale bytes.
  for (const [path, bytes] of inputs) {
    if (!sourceBytes(path).equals(bytes)) throw new Error('Source changed during staging preflight');
  }
  destinationReady(output);
  mkdirSync(dirname(output), { recursive: true });
  noLinks(dirname(output));
  if (!lstatExists(output)) mkdirSync(output);
  destinationReady(output);
  for (const [name, entry] of plan) {
    const path = join(output, name);
    mkdirSync(dirname(path), { recursive: true });
    noLinks(dirname(path));
    writeFileSync(path, entry.bytes, { flag: 'wx' });
  }
  const files = [...plan].sort(([a], [b]) => a.localeCompare(b)).map(([path, entry]) => ({
    path, bytes: entry.bytes.length, sha256: hash(entry.bytes),
    source: entry.source ? relative(checkout, entry.source).split(sep).join('/') : null,
    sourceSha256: entry.source ? hash(/** @type {Buffer} */ (inputs.get(entry.source))) : null,
    prelude: entry.prelude,
  }));
  return { protocol: 1, outputDirectory: output, roots: [...STAFFING_EDGE_ROOTS], manifest,
    counts: { entrypoints: 5, sourceFiles: [...plan.keys()].filter(name => name.startsWith('functions/')).length, runtimeFiles: runtimeAssets.length, stagedFiles: plan.size },
    configSha256: hash(/** @type {Buffer} */ (inputs.get(join(checkout, 'supabase/config.toml')))), files };
}

/** @param {string} path */
function lstatExists(path) {
  try { lstatSync(path); return true; }
  catch (error) { if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return false; throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--output') throw new Error('Usage: node scripts/ci/stage-staffing-edge.mjs --output <absolute-empty-directory>');
    console.log(JSON.stringify(stageStaffingEdge({ outputDirectory: process.argv[3] }), null, 2));
  } catch (error) { console.error(error instanceof Error ? error.message : 'Staging failed'); process.exitCode = 1; }
}
