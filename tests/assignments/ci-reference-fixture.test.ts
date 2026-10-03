import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { activityCatalogDefaults } from '@/features/activity/catalog';

describe('synthetic staffing runtime reference catalog', () => {
  it('preserves product visibility, severity, toast and template defaults without personal fixtures', () => {
    const sql = readFileSync(resolve('tests/assignments/fixtures/staffing-runtime-reference.sql'), 'utf8');
    const codes = Object.keys(activityCatalogDefaults);
    const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
    const rows = sql.slice(sql.indexOf('\nVALUES\n') + 8, sql.indexOf('\nON CONFLICT')).split(',\n');
    expect(rows).toHaveLength(codes.length);
    for (const [index, code] of codes.entries()) {
      const entry = activityCatalogDefaults[code];
      expect(rows[index]).toBe(`(${[entry.code, entry.label, entry.default_visibility, entry.severity].map(quote).join(', ')}, ${entry.toast_enabled}, ${quote(entry.template!)})`);
    }
    expect(sql).not.toMatch(/auth\.users|public\.(?:jobs|profiles|staffing_requests)|CREATE|ALTER|TRIGGER/);
    expect(sql).toContain('ON CONFLICT (code) DO NOTHING;');
  });
});
