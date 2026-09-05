export const routeBudgets = [
  { name: 'public entry', roots: ['index.html'], maxBytes: 425_000 },
  { name: 'authenticated shell', roots: ['index.html', 'src/routes/AuthenticatedShell.tsx'], maxBytes: 435_000 },
  { name: 'technician entry', roots: ['index.html', 'src/routes/AuthenticatedShell.tsx', 'src/pages/TechnicianSuperApp.tsx'], maxBytes: 700_000 },
];

export function staticRouteFiles(manifest, roots) {
  const seen = new Set();
  const files = new Set();
  function visit(key) {
    if (seen.has(key)) return;
    seen.add(key);
    const entry = manifest[key];
    if (!entry || typeof entry.file !== 'string') throw new Error(`Missing manifest entry: ${key}`);
    files.add(entry.file);
    for (const dependency of entry.imports ?? []) visit(dependency);
    // Dynamic imports are deliberately excluded: this measures the initial
    // static module graph, not every feature reachable after interaction.
  }
  for (const root of roots) visit(root);
  return [...files];
}

export function checkRouteBudgets(manifest, gzipBytesByPath, budgets = routeBudgets) {
  return budgets.map(({ name, roots, maxBytes }) => {
    const files = staticRouteFiles(manifest, roots);
    let currentBytes = 0;
    for (const file of files) {
      if (!gzipBytesByPath.has(file)) throw new Error(`Missing built asset: ${file}`);
      currentBytes += gzipBytesByPath.get(file);
    }
    const eagerHeavy = files.filter(file => /\/(maps-lib|pdf-libs|spreadsheet-libs|html2canvas-pro)[-.]/.test(file));
    return { name, currentBytes, maxBytes, eagerHeavy, pass: currentBytes <= maxBytes && eagerHeavy.length === 0 };
  });
}
