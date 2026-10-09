import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { verifyInstalledBackport } from './braces-backport.mjs';
import { validateAuditReport } from './audit-report.mjs';

const advisoryId = 1240992;
const affected = ['braces', 'chokidar', 'fast-glob', 'micromatch', 'tailwindcss'];

/** Preserve raw findings; recognize this fix only for an exact verified dev graph. */
export function verifiedBracesRemediation(report, productionReport, root) {
  validateAuditReport(report);
  validateAuditReport(productionReport);
  const packages = report.vulnerabilities ?? {};
  const direct = packages.braces?.via;
  if (!Array.isArray(direct) || !direct.some(item => item?.source === advisoryId)) return { report, remediated: [] };
  verifyInstalledBackport(root);
  const expectedEntry = realpathSync(join(root, 'node_modules', 'braces', 'index.js'));
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  const bracePaths = Object.keys(lock.packages ?? {}).filter(path => path.endsWith('/braces'));
  if (bracePaths.length !== 1 || bracePaths[0] !== 'node_modules/braces' || lock.packages[bracePaths[0]].version !== '3.0.3') {
    throw new Error('Backport remediation refuses additional or unreviewed braces instances');
  }
  const consumers = Object.entries(lock.packages).filter(([, entry]) =>
    entry.dependencies?.braces || entry.optionalDependencies?.braces || entry.peerDependencies?.braces);
  if (!consumers.length) throw new Error('Backport remediation requires known braces consumers');
  for (const [path] of consumers) {
    const resolver = createRequire(join(root, path, 'index.js'));
    if (realpathSync(resolver.resolve('braces')) !== expectedEntry) throw new Error('Installed consumer resolves an unverified braces copy');
  }
  // Remove only paths attributable to the verified braces backport.
  // Other advisories (including transitive Tailwind advisories) must remain visible.
  const unresolved = structuredClone(report);
  const remediated = [];
  const clean = new Set();
  for (const name of affected) {
    const entry = packages[name];
    if (!entry) continue;
    if (!Array.isArray(entry.nodes) || entry.nodes.length !== 1 ||
        entry.nodes[0] !== `node_modules/${name}` ||
        lock.packages[entry.nodes[0]]?.dev !== true ||
        productionReport.vulnerabilities?.[name]) {
      throw new Error('Backport remediation requires a development-only advisory graph');
    }
    const other = entry.via.some(item => typeof item === 'string'
      ? !clean.has(item)
      : !item || item.source !== advisoryId || item.name !== 'braces' ||
        item.url !== 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm');
    if (!other) clean.add(name);
  }
  // A clean package may still be referenced by a dependent with an unrelated advisory.
  // Never discard that dependent's complete audit entry.
  for (const name of clean) {
    delete unresolved.vulnerabilities[name];
    remediated.push(name);
  }
  const counts = unresolved.metadata.vulnerabilities;
  for (const name of remediated) {
    const severity = packages[name].severity;
    counts[severity]--;
    counts.total--;
  }
  validateAuditReport(unresolved);
  return { report: unresolved, remediated: [{ advisoryId, packages: remediated,
    reason: 'Verified installed braces backport; unrelated advisory paths remain unresolved.' }] };
}
