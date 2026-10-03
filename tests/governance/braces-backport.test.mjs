import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyBackport, backport, verifyInstalledBackport } from '../../scripts/governance/braces-backport.mjs';
import { verifiedBracesRemediation } from '../../scripts/governance/braces-audit-remediation.mjs';
import { validateAuditReport } from '../../scripts/governance/audit-report.mjs';

const require = createRequire(import.meta.url);
const source = dirname(require.resolve('braces/package.json'));
const roots = [];
const temp = realpathSync(tmpdir());
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(patched = true) {
  const root = realpathSync(mkdtempSync(join(temp, 'area-braces-')));
  roots.push(root);
  const directory = join(root, 'node_modules', 'braces');
  mkdirSync(join(directory, 'lib'), { recursive: true });
  for (const file of [...Object.keys(backport.files), ...Object.keys(backport.unchangedFiles)]) {
    let bytes = readFileSync(join(source, file));
    const specification = backport.files[file];
    if (specification && digest(bytes) === specification.patchedSha256) {
      let text = bytes.toString('utf8');
      for (const { before, after } of [...specification.edits].reverse()) {
        if (text.split(after).length !== 2) throw new Error('Ambiguous reconstruction of published source');
        text = text.replace(after, () => before);
      }
      bytes = Buffer.from(text);
      expect(digest(bytes)).toBe(specification.originalSha256);
    }
    writeFileSync(join(directory, file), bytes);
  }
  for (const dependency of ['fill-range', 'to-regex-range', 'is-number']) {
    cpSync(dirname(require.resolve(`${dependency}/package.json`)), join(root, 'node_modules', dependency), { recursive: true });
  }
  const packages = Object.fromEntries(['braces', 'chokidar', 'fast-glob', 'micromatch', 'tailwindcss'].map(name => [`node_modules/${name}`, { dev: true, version: name === 'braces' ? '3.0.3' : 'fixture' }]));
  for (const name of ['chokidar', 'micromatch']) packages[`node_modules/${name}`].dependencies = { braces: '^3.0.3' };
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ packages }));
  if (patched) applyBackport(root);
  return { root, directory, braces: () => require(directory) };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    // Never remove a computed, replaced, or broader Windows directory.
    if (dirname(root) !== temp || !basename(root).startsWith('area-braces-') || lstatSync(root).isSymbolicLink() || realpathSync(root) !== root) throw new Error('Temporary test root changed; refuse removal');
    rmSync(root, { recursive: true });
  }
});

function audit() {
  const vulnerabilities = {};
  for (const name of ['braces', 'chokidar', 'fast-glob', 'micromatch', 'tailwindcss']) {
    vulnerabilities[name] = { name, severity: 'high', nodes: [`node_modules/${name}`], via: name === 'braces'
      ? [{ source: 1240992, name: 'braces', url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }] : ['braces'] };
  }
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, critical: 0, high: 5, total: 5 } } };
}
const cleanAudit = () => ({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } });

describe('verified braces depth remediation', () => {
  it('installs exact reviewed bytes idempotently and refuses altered entrypoints', () => {
    const { root, directory } = fixture(false);
    expect(() => verifyInstalledBackport(root)).toThrow(/missing or changed/);
    expect(applyBackport(root)).toBe(true);
    expect(applyBackport(root)).toBe(true);
    expect(verifyInstalledBackport(root)).toBe(true);
    writeFileSync(join(directory, 'index.js'), 'module.exports = () => [];');
    expect(() => verifyInstalledBackport(root)).toThrow(/entrypoint/);
  });
  it('validates all originals before writing any security file', () => {
    const { root, directory } = fixture(false);
    const first = readFileSync(join(directory, 'lib/compile.js'));
    writeFileSync(join(directory, 'lib/stringify.js'), 'changed source');
    expect(() => applyBackport(root)).toThrow(/Unreviewed braces source/);
    expect(readFileSync(join(directory, 'lib/compile.js'))).toEqual(first);
  });
  it('allows a production-only install with no braces but refuses an incomplete package', () => {
    const root = realpathSync(mkdtempSync(join(temp, 'area-braces-'))); roots.push(root);
    expect(applyBackport(root)).toBe(false);
    mkdirSync(join(root, 'node_modules', 'braces'), { recursive: true });
    expect(() => applyBackport(root)).toThrow();
  });
  it('reproduces original exhaustion under a bounded stack and rejects hostile strings before walking', () => {
    const original = fixture(false);
    const patched = fixture().braces();
    const hostile = '{'.repeat(4990) + 'a,b' + '}'.repeat(4990);
    expect(hostile.length).toBeLessThan(10_000);
    // V8 frame size/JIT vary. Fix the child stack budget so CI and developer
    // runtimes share an observable original-failure control.
    const script = "const braces=require(process.argv[1]);try{braces.compile('{'.repeat(4990)+'a,b'+'}'.repeat(4990));process.stdout.write('accepted')}catch(error){process.stdout.write(error.name+':'+error.message)}";
    const result = spawnSync(process.execPath, ['--stack-size=256', '-e', script, original.directory], { encoding: 'utf8', timeout: 5000 });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/RangeError:.*call stack/i);
    for (const method of ['parse', 'compile', 'expand', 'stringify']) expect(() => patched[method](hostile)).toThrow(/Input depth/);
  });
  it.each(['{', '('])('accepts depth100 and rejects101 for %s across public methods', open => {
    const braces = fixture().braces(), close = open === '{' ? '}' : ')';
    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      expect(() => braces[method](open.repeat(100) + 'a' + close.repeat(100))).not.toThrow();
      expect(() => braces[method](open.repeat(101) + 'a' + close.repeat(101))).toThrow(/depth/);
      expect(() => braces[method](open.repeat(2) + 'a' + close.repeat(2), { maxDepth: 1.5 })).toThrow(/depth/);
      expect(() => braces[method](open.repeat(101) + 'a' + close.repeat(101), { maxDepth: Infinity })).toThrow(/depth/);
    }
  });
  it('bounds direct AST depth and cyclic expansion parent chains', () => {
    const braces = fixture().braces();
    let node = { type: 'text', value: 'a' };
    for (let index = 0; index < 101; index++) node = { type: 'brace', nodes: [node] };
    for (const method of ['compile', 'expand', 'stringify']) expect(() => braces[method]({ type: 'root', nodes: [node] })).toThrow(/depth/);
    const cyclic = { type: 'paren', nodes: [] }; cyclic.parent = cyclic;
    expect(() => braces.expand(cyclic)).toThrow(/parent chain contains a cycle/);
  });
  it('preserves shallow alternatives, ranges, escapes and stringify parent behavior', () => {
    const original = fixture(false).braces(), patched = fixture().braces();
    const patterns = ['src/**/*.{ts,tsx}', 'a/{b,c}/d', '{1..8}', '{01..08}', '{{a}}', '{a,{b,{c}}}', '{}{a}', '\\{a,b\\}', '[{a,b}]', '${a,b}', '{a,b', '(a)', 'file-{a,b}-{1..3}'];
    for (const pattern of patterns) for (const method of ['compile', 'expand', 'stringify']) for (const options of [{}, { escapeInvalid: true }]) {
      expect(patched[method](pattern, options)).toEqual(original[method](pattern, options));
    }
  });
  it('keeps raw findings immutable and recognizes only the exact installed development backport', () => {
    const { root } = fixture(), raw = audit(), saved = structuredClone(raw);
    const result = verifiedBracesRemediation(raw, cleanAudit(), root);
    expect(raw).toEqual(saved);
    expect(result.report.metadata.vulnerabilities.high).toBe(0);
    expect(result.report.metadata.vulnerabilities.total).toBe(0);
    expect(result.remediated[0].advisoryId).toBe(1240992);
  });
  it('refuses unpatched bytes even when the dependency version and graph match', () => {
    expect(() => verifiedBracesRemediation(audit(), cleanAudit(), fixture(false).root)).toThrow(/missing or changed/);
  });
  it.each(['production', 'extraInstance', 'notDev', 'newAdvisory', 'changedGuard'])('refuses %s exposure or drift', fault => {
    const { root, directory } = fixture(), raw = audit(), production = cleanAudit();
    const path = join(root, 'package-lock.json'), lock = JSON.parse(readFileSync(path));
    if (fault === 'production') { production.vulnerabilities.braces = raw.vulnerabilities.braces; production.metadata.vulnerabilities.high = 1; production.metadata.vulnerabilities.total = 1; }
    if (fault === 'extraInstance') lock.packages['node_modules/extra/node_modules/braces'] = { dev: true, version: '3.0.3' };
    if (fault === 'notDev') lock.packages['node_modules/tailwindcss'].dev = false;
    if (fault === 'newAdvisory') raw.vulnerabilities.braces.via.push({ source: 9999999, name: 'braces', url: 'other' });
    if (fault === 'changedGuard') writeFileSync(join(directory, 'lib/compile.js'), 'guard removed');
    writeFileSync(path, JSON.stringify(lock));
    expect(() => verifiedBracesRemediation(raw, production, root)).toThrow();
  });
  it('retains unrelated findings and severity debt', () => {
    const raw = audit();
    raw.vulnerabilities.other = { name: 'other', severity: 'high', via: [{ source: 9999999 }], nodes: ['node_modules/other'] };
    raw.metadata.vulnerabilities.high++; raw.metadata.vulnerabilities.total++;
    const result = verifiedBracesRemediation(raw, cleanAudit(), fixture().root);
    expect(result.report.vulnerabilities.other).toEqual(raw.vulnerabilities.other);
    expect(result.report.metadata.vulnerabilities.high).toBe(1);
    expect(result.report.metadata.vulnerabilities.total).toBe(1);
  });
  it('recognizes clean-install Tailwind plugin propagation without changing raw findings', () => {
    const { root } = fixture(), raw = audit(), path = join(root, 'package-lock.json'), lock = JSON.parse(readFileSync(path));
    for (const name of ['@tailwindcss/typography', 'tailwindcss-animate']) {
      raw.vulnerabilities[name] = { name, severity: 'high', via: ['tailwindcss'], nodes: [`node_modules/${name}`] };
      lock.packages[`node_modules/${name}`] = { dev: true };
      raw.metadata.vulnerabilities.high++; raw.metadata.vulnerabilities.total++;
    }
    writeFileSync(path, JSON.stringify(lock));
    const saved = structuredClone(raw), result = verifiedBracesRemediation(raw, cleanAudit(), root);
    expect(raw).toEqual(saved);
    expect(result.report.metadata.vulnerabilities.total).toBe(0);
    expect(result.remediated[0].packages).toHaveLength(7);
  });
  it.each(['unrelated', 'notDev', 'production'])('refuses Tailwind plugin %s exposure', fault => {
    const { root } = fixture(), raw = audit(), production = cleanAudit(), path = join(root, 'package-lock.json'), lock = JSON.parse(readFileSync(path));
    const name = 'tailwindcss-animate';
    raw.vulnerabilities[name] = { name, severity: 'high', via: fault === 'unrelated' ? ['tailwindcss', 'micromatch'] : ['tailwindcss'], nodes: [`node_modules/${name}`] };
    raw.metadata.vulnerabilities.high++; raw.metadata.vulnerabilities.total++;
    lock.packages[`node_modules/${name}`] = { dev: fault !== 'notDev' };
    if (fault === 'production') { production.vulnerabilities[name] = raw.vulnerabilities[name]; production.metadata.vulnerabilities.high++; production.metadata.vulnerabilities.total++; }
    writeFileSync(path, JSON.stringify(lock));
    expect(() => verifiedBracesRemediation(raw, production, root)).toThrow();
  });
  it.each(['dependencies', 'optionalDependencies', 'peerDependencies'])('checks new %s consumers through actual Node resolution', declaration => {
    const { root } = fixture(), original = fixture(false), path = join(root, 'package-lock.json'), lock = JSON.parse(readFileSync(path));
    lock.packages['node_modules/new-consumer'] = { dev: true, [declaration]: { braces: '^3.0.3' } };
    writeFileSync(path, JSON.stringify(lock));
    cpSync(original.directory, join(root, 'node_modules', 'new-consumer', 'node_modules', 'braces'), { recursive: true });
    expect(() => verifiedBracesRemediation(audit(), cleanAudit(), root)).toThrow(/unverified braces copy/);
  });
  it('refuses an installed nested copy that is absent from the lockfile', () => {
    const { root } = fixture(), original = fixture(false);
    cpSync(original.directory, join(root, 'node_modules', 'micromatch', 'node_modules', 'braces'), { recursive: true });
    expect(() => verifiedBracesRemediation(audit(), cleanAudit(), root)).toThrow(/unverified braces copy/);
  });
  it.each([{}, { error: { code: 'EAUDIT' } }, { vulnerabilities: {} }])('refuses malformed or failed production audit responses', report => {
    expect(() => validateAuditReport(report)).toThrow(/Invalid npm audit report/);
    expect(() => verifiedBracesRemediation(audit(), report, fixture().root)).toThrow(/Invalid npm audit report/);
  });
});
