import { describe, expect, it } from 'vitest';
import { appendAutonomoLabel, getAutonomoBadgeLabel, isAutonomo, NO_AUTONOMO_LABEL, HOUSE_TECH_LABEL } from '@/utils/autonomo';

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

  describe('house tech labeling', () => {
    it('returns Plantilla label for house techs instead of autonomo status', () => {
      // House techs get "Plantilla" label regardless of autonomo flag
      expect(getAutonomoBadgeLabel(true, true)).toBe(HOUSE_TECH_LABEL);
      expect(getAutonomoBadgeLabel(false, true)).toBe(HOUSE_TECH_LABEL);
      expect(getAutonomoBadgeLabel(undefined, true)).toBe(HOUSE_TECH_LABEL);
    });

    it('appends Plantilla label for house techs', () => {
      expect(appendAutonomoLabel('Juan Garcia', true, { isHouseTech: true })).toBe(
        `Juan Garcia\n${HOUSE_TECH_LABEL}`
      );
      expect(appendAutonomoLabel('Juan Garcia', true, { multiline: false, isHouseTech: true })).toBe(
        `Juan Garcia (${HOUSE_TECH_LABEL})`
      );
    });

    it('isAutonomo only checks the autonomo flag (house tech handled separately for labels)', () => {
      // isAutonomo just checks the flag, labeling logic handles house techs
      expect(isAutonomo(true)).toBe(true);
      expect(isAutonomo(false)).toBe(false);
      expect(isAutonomo(undefined)).toBe(true);
      expect(isAutonomo(null)).toBe(true);
    });
  });
});
