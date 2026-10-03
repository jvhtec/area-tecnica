import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { verifyInstalledBackport } from './braces-backport.mjs';
import { validateAuditReport } from './audit-report.mjs';

const advisoryId = 1240992;
const affected = ['braces', 'chokidar', 'fast-glob', 'micromatch', 'tailwindcss'];
const optionalPlugins = ['@tailwindcss/typography', 'tailwindcss-animate'];

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
  const consumers = Object.entries(lock.packages).filter(([, entry]) => entry.dependencies?.braces);
  if (!consumers.length) throw new Error('Backport remediation requires known braces consumers');
  for (const [path] of consumers) {
    const resolver = createRequire(join(root, path, 'index.js'));
    if (realpathSync(resolver.resolve('braces')) !== expectedEntry) throw new Error('Installed consumer resolves an unverified braces copy');
  }
  const admitted = [...affected, ...optionalPlugins.filter(name => Object.hasOwn(packages, name))];
  for (const name of admitted) {
    const entry = packages[name];
    if (!entry || entry.severity !== 'high' || !Array.isArray(entry.nodes) || entry.nodes.length !== 1 || entry.nodes[0] !== `node_modules/${name}` || lock.packages[entry.nodes[0]]?.dev !== true || productionReport.vulnerabilities?.[name]) {
      throw new Error('Backport remediation requires the exact development-only advisory graph');
    }
    if (optionalPlugins.includes(name) && (entry.via?.length !== 1 || entry.via[0] !== 'tailwindcss')) throw new Error('Tailwind plugin has an unrelated advisory path');
    if (!Array.isArray(entry.via) || !entry.via.length || entry.via.some(item => typeof item === 'string'
      ? !affected.includes(item) : !item || item.source !== advisoryId || item.name !== 'braces' || item.url !== 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm')) {
      throw new Error('Backport remediation refuses additional advisory paths');
    }
  }
  const unresolved = structuredClone(report);
  for (const name of admitted) delete unresolved.vulnerabilities[name];
  const counts = unresolved.metadata?.vulnerabilities;
  if (!counts || counts.high < admitted.length || counts.total < admitted.length) throw new Error('Inconsistent audit severity counts');
  counts.high -= admitted.length;
  counts.total -= admitted.length;
  return { report: unresolved, remediated: [{ advisoryId, packages: admitted, reason: 'Installed depth backport bytes verified; exact development-only graph; raw advisory remains visible.' }] };
}
