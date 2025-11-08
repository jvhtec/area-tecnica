import { describe, expect, it } from 'vitest';
import { appendAutonomoLabel, getAutonomoBadgeLabel, NO_AUTONOMO_LABEL } from '@/utils/autonomo';

describe('autonomo helpers', () => {
  it('returns the badge label only when autonomo is false', () => {
    expect(getAutonomoBadgeLabel(true)).toBeNull();
    expect(getAutonomoBadgeLabel(undefined)).toBeNull();
    expect(getAutonomoBadgeLabel(null)).toBeNull();
    expect(getAutonomoBadgeLabel(false)).toBe(NO_AUTONOMO_LABEL);
  });

  it('appends the label on a new line by default when not autonomo', () => {
    expect(appendAutonomoLabel('Ana Lopez', true)).toBe('Ana Lopez');
    expect(appendAutonomoLabel('Ana Lopez', false)).toBe(`Ana Lopez\n${NO_AUTONOMO_LABEL}`);
  });

  it('can append the label inline when requested', () => {
    expect(appendAutonomoLabel('Ana Lopez', false, { multiline: false })).toBe(
      `Ana Lopez (${NO_AUTONOMO_LABEL})`
    );
  });
});
