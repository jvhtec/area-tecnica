import { describe, expect, it } from 'vitest';

import { unwrapPostgrestRelation } from '@/utils/postgrestRelation';

describe('unwrapPostgrestRelation', () => {
  const profile = { id: 'tech-1', department: 'sound' };

  it('preserves an object relation', () => {
    expect(unwrapPostgrestRelation(profile)).toBe(profile);
  });

  it('unwraps the first row from an array relation', () => {
    expect(unwrapPostgrestRelation([profile])).toBe(profile);
  });

  const emptyRelations: Array<{ label: string; value: unknown }> = [
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'empty array', value: [] },
  ];

  for (const { label, value } of emptyRelations) {
    it(`normalizes ${label} to null`, () => {
      expect(unwrapPostgrestRelation(value)).toBeNull();
    });
  }
});
