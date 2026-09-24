import { describe, expect, it } from 'vitest';

import { collectPrecacheAssets } from '../../scripts/lib/sw-precache.mjs';

const manifest = {
  'index.html': { file: 'assets/index-a.js', isEntry: true, css: ['assets/index-a.css'], imports: ['_vendor.js'] },
  '_vendor.js': { file: 'assets/vendor-b.js' },
  'src/pages/Offline.tsx': { file: 'assets/Offline-c.js', imports: ['_vendor.js', '_shared.js'], dynamicImports: ['src/Heavy.tsx'] },
  '_shared.js': { file: 'assets/shared-d.js', css: ['assets/shared-d.css'] },
  'src/Heavy.tsx': { file: 'assets/Heavy-e.js' },
  'src/pages/Other.tsx': { file: 'assets/Other-f.js' },
};

describe('collectPrecacheAssets', () => {
  it('takes the static import closure of the entry and the offline pages only', () => {
    expect(collectPrecacheAssets(manifest, ['src/pages/Offline.tsx'])).toEqual([
      '/assets/Offline-c.js',
      '/assets/index-a.css',
      '/assets/index-a.js',
      '/assets/shared-d.css',
      '/assets/shared-d.js',
      '/assets/vendor-b.js',
    ]);
  });

  it('fails the build when an offline page disappears from the manifest', () => {
    expect(() => collectPrecacheAssets(manifest, ['src/pages/Renamed.tsx'])).toThrow(/Renamed/);
  });
});
