const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateAuditReport(report) {
  if (!object(report) || Object.hasOwn(report, 'error') || report.auditReportVersion !== 2 || !object(report.vulnerabilities) || !object(report.metadata?.vulnerabilities)) {
    throw new Error('Invalid npm audit report; failure is not proof of absent vulnerabilities');
  }
  const counts = report.metadata.vulnerabilities;
  if ([...severities, 'total'].some(name => !Number.isSafeInteger(counts[name]) || counts[name] < 0) || severities.reduce((sum, name) => sum + counts[name], 0) !== counts.total) {
    throw new Error('Inconsistent npm audit severity counts');
  }
  const actual = Object.fromEntries(severities.map(name => [name, 0]));
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    if (!object(entry) || entry.name !== name || !severities.includes(entry.severity) || !Array.isArray(entry.via) || !Array.isArray(entry.nodes)) throw new Error('Invalid npm audit package entry');
    actual[entry.severity]++;
  }
  if (severities.some(name => counts[name] !== actual[name])) throw new Error('Audit findings differ from severity counts');
  return report;
}
