import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stageStaffingEdge, STAFFING_EDGE_ROOTS } from '../../scripts/ci/stage-staffing-edge.mjs';
import { edgeSnapshot } from './helpers/edgeSnapshot';

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, openSync: vi.fn(actual.openSync), readFileSync: vi.fn(actual.readFileSync) };
});
const actualRead = (await vi.importActual<typeof import('node:fs')>('node:fs')).readFileSync;
const actualOpen = (await vi.importActual<typeof import('node:fs')>('node:fs')).openSync;
const repositoryDirectory = '../../';
const repository = fileURLToPath(new URL(repositoryDirectory, import.meta.url));
const prefix = 'staffing-edge-stage-test-';
const temporaryRoots: string[] = [];
const prelude = Buffer.from("import '../../outbound.ts';\n");
function temporary() {
  const path = mkdtempSync(join(tmpdir(), prefix)); temporaryRoots.push(path); return path;
}
function put(root: string, path: string, content: string | Buffer) {
  const target = join(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content);
}
function fixture() {
  const root = temporary(), checkout = join(root, 'checkout'), output = join(root, 'staged');
  mkdirSync(checkout);
  put(checkout, 'supabase/config.toml', '[functions.staffing-orchestrator]\nverify_jwt = false\n[functions.send-staffing-email]\nverify_jwt = false\n[functions.push]\n# verify_jwt = false\n');
  for (const name of STAFFING_EDGE_ROOTS) put(checkout, `supabase/functions/${name}/index.ts`, Buffer.from('// source with CRLF\r\nexport const value = 1;\r\n'));
  put(checkout, 'tests/assignments/runtime/supervisor.ts', "import { type Value } from './types.ts';\n");
  put(checkout, 'tests/assignments/runtime/types.ts', 'export type Value = string;\r\n');
  put(checkout, 'tests/assignments/runtime/worker.ts', "import type { Value } from './types.ts';\n");
  put(checkout, 'tests/assignments/runtime/outbound.ts', "import './worker.ts';\n");
  for (const kind of ['modern', 'legacy']) put(checkout, `tests/assignments/runtime/_ci-probe-${kind}/index.ts`, "import '../outbound.ts';\nimport type { Value } from '../types.ts';\n");
  return { checkoutRoot: checkout, outputDirectory: output, root };
}
afterEach(() => {
  vi.mocked(readFileSync).mockImplementation(actualRead);
  vi.mocked(openSync).mockImplementation(actualOpen);
  for (const root of temporaryRoots.splice(0)) {
    // Only remove this test's explicit absolute temp roots; never follow a root link.
    if (!isAbsolute(root) || dirname(root) !== resolve(tmpdir()) || !basename(root).startsWith(prefix) || lstatSync(root).isSymbolicLink()) throw new Error('Unsafe test cleanup target');
    rmSync(root, { recursive: true, force: true });
  }
});

describe('staffing Edge source staging', () => {
  it('stages the complete local AST closure and preserves exact source bytes', () => {
    const options = fixture();
    put(options.checkoutRoot, 'supabase/functions/staffing-orchestrator/index.ts',
      "import '../_shared/side.ts';\nexport * from '../_shared/reexport.ts';\nconst loaded = import('../_shared/dynamic.ts');\ntype Value = import('../_shared/types.ts').Value;\nimport remote from 'https://example.invalid/remote.ts';\n");
    put(options.checkoutRoot, 'supabase/functions/_shared/side.ts', "import './nested.ts';\n// import('./not-a-dependency.ts')\n");
    put(options.checkoutRoot, 'supabase/functions/_shared/nested.ts', "export * from './side.ts';\n");
    put(options.checkoutRoot, 'supabase/functions/_shared/reexport.ts', 'export const exported = 1;\r\n');
    put(options.checkoutRoot, 'supabase/functions/_shared/dynamic.ts', 'export const dynamic = 1;\n');
    put(options.checkoutRoot, 'supabase/functions/_shared/types.ts', 'export type Value = number;\n');
    put(options.checkoutRoot, 'supabase/functions/unrelated/index.ts', 'throw new Error("not staged");');
    const result = stageStaffingEdge(options);
    expect(result.counts).toEqual({ entrypoints: 5, sourceFiles: 10, runtimeFiles: 7, stagedFiles: 18 });
    expect(result.files.filter(file => file.prelude).map(file => file.path).sort())
      .toEqual(STAFFING_EDGE_ROOTS.map(name => `functions/${name}/index.ts`).sort());
    for (const file of result.files) {
      const staged = readFileSync(join(options.outputDirectory, file.path));
      expect(createHash('sha256').update(staged).digest('hex')).toBe(file.sha256);
      if (!file.source) continue;
      const original = readFileSync(join(options.checkoutRoot, file.source));
      expect(staged.equals(file.prelude ? Buffer.concat([prelude, original]) : original)).toBe(true);
      expect(createHash('sha256').update(original).digest('hex')).toBe(file.sourceSha256);
    }
    expect(existsSync(join(options.outputDirectory, 'functions/unrelated'))).toBe(false);
    expect(readFileSync(join(options.outputDirectory, 'main/types.ts')).equals(readFileSync(join(options.outputDirectory, 'types.ts')))).toBe(true);
    expect(result.manifest).toEqual({
      'staffing-orchestrator': { verify_jwt: false }, 'send-staffing-email': { verify_jwt: false },
      'notify-staffing-cancellation': { verify_jwt: true }, push: { verify_jwt: true }, 'manage-flex-crew-assignments': { verify_jwt: true },
    });
    expect(JSON.parse(readFileSync(join(options.outputDirectory, 'manifest.json'), 'utf8'))).toEqual(result.manifest);
  });

  it('projects the actual public checkout and matches the existing AST source walk', () => {
    const outputDirectory = join(temporary(), 'public-projection');
    const result = stageStaffingEdge({ outputDirectory });
    const sources = edgeSnapshot(STAFFING_EDGE_ROOTS.map(name => `${name}/index.ts`));
    expect(result.counts.sourceFiles).toBe(sources.size);
    for (const [file, source] of sources) {
      const staged = readFileSync(join(outputDirectory, 'functions', file));
      const entrypoint = STAFFING_EDGE_ROOTS.some(name => file === `${name}/index.ts`);
      expect(staged.equals(Buffer.concat([entrypoint ? prelude : Buffer.alloc(0), Buffer.from(source)]))).toBe(true);
    }
    expect(result.roots).toEqual(['staffing-orchestrator', 'send-staffing-email', 'notify-staffing-cancellation', 'push', 'manage-flex-crew-assignments']);
    expect(result.manifest['notify-staffing-cancellation'].verify_jwt).toBe(true);
    expect(result.manifest['manage-flex-crew-assignments'].verify_jwt).toBe(true);
  });

  it('accepts an existing empty destination and creates nested outside-checkout destinations', () => {
    const options = fixture(); mkdirSync(options.outputDirectory);
    expect(stageStaffingEdge(options).counts.entrypoints).toBe(5);
    const nested = { ...options, outputDirectory: join(options.root, 'new-parent', 'nested', 'stage') };
    expect(stageStaffingEdge(nested).counts.entrypoints).toBe(5);
  });

  it.each(['import(dynamic);', "import(`../_shared/template.ts`);", "export * from '../_shared/missing.ts';",
    "import '../../../outside.ts';", "import '/absolute.ts';", "import 'file:///outside.ts';",
    "import '../%2e%2e/%2e%2e/outside.ts';", "import '../_shared/value.ts?query';",
    "import '../../outbound.ts';\n", 'export const broken = ;',
  ])('refuses unresolved, escaping, pre-staged, or invalid source before writes: %s', source => {
    const options = fixture(); put(options.checkoutRoot, 'supabase/functions/push/index.ts', source);
    expect(() => stageStaffingEdge(options)).toThrow(); expect(existsSync(options.outputDirectory)).toBe(false);
  });

  it('refuses unknown or unresolved runtime dependencies before writes', () => {
    for (const source of ["import './missing.ts';", 'const loaded = import(name);']) {
      const options = fixture(); put(options.checkoutRoot, 'tests/assignments/runtime/worker.ts', source);
      expect(() => stageStaffingEdge(options)).toThrow(); expect(existsSync(options.outputDirectory)).toBe(false);
    }
  });

  it('refuses source changes detected during preflight instead of copying stale bytes', () => {
    const options = fixture(), changing = join(options.checkoutRoot, 'supabase/functions/push/index.ts');
    let reads = 0;
    vi.mocked(openSync).mockImplementation((path, flags, mode) => {
      if (path === changing && ++reads === 2) writeFileSync(changing, 'export const changed = true;');
      return actualOpen(path, flags, mode);
    });
    expect(() => stageStaffingEdge(options)).toThrow('Source changed during staging preflight');
    expect(existsSync(options.outputDirectory)).toBe(false);
  });

  it('refuses a source replaced by a symlink at open without staging its target', () => {
    const options = fixture(), changing = join(options.checkoutRoot, 'supabase/functions/push/index.ts');
    const external = join(options.root, 'external.ts');
    writeFileSync(external, 'export const external = true;');
    let replaced = false;
    vi.mocked(openSync).mockImplementation((path, flags, mode) => {
      if (path === changing && !replaced) {
        replaced = true;
        rmSync(changing);
        symlinkSync(external, changing, 'file');
      }
      return actualOpen(path, flags, mode);
    });
    expect(() => stageStaffingEdge(options)).toThrow();
    expect(replaced).toBe(true);
    expect(existsSync(options.outputDirectory)).toBe(false);
    expect(actualRead(external, 'utf8')).toBe('export const external = true;');
  });

  it('refuses a source changed while its descriptor is being read', () => {
    const options = fixture(), changing = join(options.checkoutRoot, 'supabase/functions/push/index.ts');
    let changingFd: number | undefined;
    vi.mocked(openSync).mockImplementation((path, flags, mode) => {
      const fd = actualOpen(path, flags, mode);
      if (path === changing) changingFd = fd;
      return fd;
    });
    vi.mocked(readFileSync).mockImplementation((path, encoding) => {
      if (typeof path === 'number' && path === changingFd) writeFileSync(changing, 'export const changedDuringRead = true;');
      return actualRead(path, encoding);
    });
    expect(() => stageStaffingEdge(options)).toThrow('Source changed during staging preflight');
    expect(existsSync(options.outputDirectory)).toBe(false);
  });

  it('refuses stale/nonempty destinations and files without overwriting them', () => {
    const options = fixture(); put(options.outputDirectory, 'stale.ts', 'retained');
    expect(() => stageStaffingEdge(options)).toThrow('refusing overwrite');
    expect(readdirSync(options.outputDirectory)).toEqual(['stale.ts']);
    expect(readFileSync(join(options.outputDirectory, 'stale.ts'), 'utf8')).toBe('retained');
    const file = join(options.root, 'output-file'); writeFileSync(file, 'retained');
    expect(() => stageStaffingEdge({ ...options, outputDirectory: file })).toThrow('refusing overwrite');
    expect(readFileSync(file, 'utf8')).toBe('retained');
  });

  it('refuses case-colliding staged paths before writes on every platform', () => {
    const options = fixture();
    put(options.checkoutRoot, 'supabase/functions/push/index.ts', "import '../_shared/value.ts';\nimport '../_shared/VALUE.ts';\n");
    put(options.checkoutRoot, 'supabase/functions/_shared/value.ts', 'export const value = 1;');
    put(options.checkoutRoot, 'supabase/functions/_shared/VALUE.ts', 'export const value = 1;');
    expect(() => stageStaffingEdge(options)).toThrow('overwrite each other');
    expect(existsSync(options.outputDirectory)).toBe(false);
  });

  it('refuses source and destination directory symlinks/junctions', () => {
    const options = fixture(), external = join(options.root, 'external'); mkdirSync(external);
    put(external, 'helper.ts', 'export const value = 1;');
    symlinkSync(external, join(options.checkoutRoot, 'supabase/functions/_linked'), 'junction');
    put(options.checkoutRoot, 'supabase/functions/push/index.ts', "import '../_linked/helper.ts';");
    expect(() => stageStaffingEdge(options)).toThrow('symlinks'); expect(existsSync(options.outputDirectory)).toBe(false);
    const linkedOutput = join(options.root, 'linked-output'); symlinkSync(external, linkedOutput, 'junction');
    expect(() => stageStaffingEdge({ ...options, outputDirectory: linkedOutput })).toThrow('symlinks');
    expect(readFileSync(join(external, 'helper.ts'), 'utf8')).toBe('export const value = 1;');
  });

  it('refuses relative, checkout-contained, checkout-ancestor, and symlink-ancestor outputs', () => {
    const options = fixture();
    for (const outputDirectory of ['relative-output', options.checkoutRoot, join(options.checkoutRoot, 'stage'), options.root]) {
      expect(() => stageStaffingEdge({ ...options, outputDirectory })).toThrow();
    }
    const external = join(options.root, 'external'); mkdirSync(external);
    const alias = join(options.root, 'alias'); symlinkSync(external, alias, 'junction');
    expect(() => stageStaffingEdge({ ...options, outputDirectory: join(alias, 'new-stage') })).toThrow('symlinks');
    expect(readdirSync(external)).toEqual([]);
  });

  it.each(['[functions.push]\nverify_jwt = "false"', '[functions.push]\nverify_jwt = false\nverify_jwt = true',
    '[functions.push]\nverify_jwt = true\n[functions.push]\nverify_jwt = false', '[functions."push"]\nverify_jwt = false'])('refuses ambiguous config before writes %#', config => {
    const options = fixture(); put(options.checkoutRoot, 'supabase/config.toml', config);
    expect(() => stageStaffingEdge(options)).toThrow(); expect(existsSync(options.outputDirectory)).toBe(false);
  });

  it('honors explicit booleans for previously defaulted handlers and no extra manifest roots', () => {
    const options = fixture(); put(options.checkoutRoot, 'supabase/config.toml',
      '[functions.notify-staffing-cancellation]\nverify_jwt = false\n[functions.manage-flex-crew-assignments]\nverify_jwt = false\n[functions.staffing-click]\nverify_jwt = false');
    const result = stageStaffingEdge(options);
    expect(result.manifest['notify-staffing-cancellation'].verify_jwt).toBe(false);
    expect(result.manifest['manage-flex-crew-assignments'].verify_jwt).toBe(false);
    expect(result.manifest.push.verify_jwt).toBe(true);
    expect(Object.keys(result.manifest)).toHaveLength(5);
    expect(result.manifest).not.toHaveProperty('staffing-click');
  });

  it('CLI refuses relative output and unsupported arguments without staging', () => {
    const script = join(repository, 'scripts/ci/stage-staffing-edge.mjs');
    expect(() => execFileSync(process.execPath, [script, '--output', 'relative-output'], { stdio: 'pipe' })).toThrow();
    expect(() => execFileSync(process.execPath, [script, '--unknown'], { stdio: 'pipe' })).toThrow();
    expect(existsSync(join(repository, 'relative-output'))).toBe(false);
  });

  it('CLI stages public sources and returns only hashes, counts and path evidence', () => {
    const script = join(repository, 'scripts/ci/stage-staffing-edge.mjs');
    const outputDirectory = join(temporary(), 'cli-stage');
    const report = JSON.parse(execFileSync(process.execPath, [script, '--output', outputDirectory], { encoding: 'utf8' })) as ReturnType<typeof stageStaffingEdge>;
    expect(report.outputDirectory).toBe(outputDirectory);
    expect(report.counts.entrypoints).toBe(5);
    expect(report.files).toHaveLength(report.counts.stagedFiles);
    for (const file of report.files) {
      expect(Object.keys(file).sort()).toEqual(['bytes', 'path', 'prelude', 'sha256', 'source', 'sourceSha256'].sort());
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(createHash('sha256').update(readFileSync(join(outputDirectory, file.path))).digest('hex')).toBe(file.sha256);
    }
  });
});
