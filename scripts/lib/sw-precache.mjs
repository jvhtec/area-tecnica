/**
 * Service worker precache list, computed from the Vite build manifest.
 * Used by scripts/inject-sw-version.mjs after `vite build`.
 */

// Pages that must open with no connection. Their static import closure (plus
// the app entry's) is precached by the service worker at install time.
export const OFFLINE_PAGES = [
  "src/pages/FestivalManagement.tsx",
  "src/pages/FestivalArtistManagement.tsx",
  "src/pages/TechnicianSuperApp.tsx",
];

/** Static-import closure of the entry and OFFLINE_PAGES, as absolute paths. */
export const collectPrecacheAssets = (manifest, pages = OFFLINE_PAGES) => {
  const files = new Set();
  const seen = new Set();
  const visit = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    const entry = manifest[key];
    if (!entry) return;
    files.add(`/${entry.file}`);
    for (const css of entry.css ?? []) files.add(`/${css}`);
    for (const imported of entry.imports ?? []) visit(imported);
  };
  const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
  for (const page of pages) {
    if (!manifest[page]) throw new Error(`Offline page ${page} is missing from the Vite manifest`);
  }
  [...entries, ...pages].forEach(visit);
  return [...files].sort();
};
