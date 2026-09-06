import { describe, expect, it } from 'vitest';
import { checkRouteBudgets, staticRouteFiles } from '../../scripts/performance/route-budgets.mjs';

describe('initial route bundle budgets', () => {
  const budgets = [{ name: 'fixture', roots: ['entry'], maxBytes: 50 }];
  it('deduplicates shared imports and cycles, excluding on-demand imports', () => {
    const manifest = {
      entry: { file: 'assets/main.js', imports: ['shared'], dynamicImports: ['pdf'] },
      shared: { file: 'assets/shared.js', imports: ['entry'] },
      pdf: { file: 'assets/pdf-libs-12345678.js' },
    };
    expect(staticRouteFiles(manifest, ['entry', 'shared'])).toEqual(['assets/main.js', 'assets/shared.js']);
    const result = checkRouteBudgets(manifest, new Map([['assets/main.js', 20], ['assets/shared.js', 10]]), budgets);
    expect(result[0]).toMatchObject({ currentBytes: 30, pass: true, eagerHeavy: [] });
  });
  it('rejects both an eager heavy library and excess total bytes', () => {
    expect(checkRouteBudgets({ entry: { file: 'assets/pdf-libs-12345678.js' } }, new Map([['assets/pdf-libs-12345678.js', 1]]), budgets)[0].pass).toBe(false);
    expect(checkRouteBudgets({ entry: { file: 'assets/main.js' } }, new Map([['assets/main.js', 51]]), budgets)[0].pass).toBe(false);
  });
  it('fails closed on missing manifest entries or built files', () => {
    expect(() => staticRouteFiles({}, ['entry'])).toThrow('Missing manifest entry');
    expect(() => checkRouteBudgets({ entry: { file: 'assets/main.js' } }, new Map(), budgets)).toThrow('Missing built asset');
  });
});
