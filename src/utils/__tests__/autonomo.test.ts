/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  isAutonomo,
  getAutonomoBadgeLabel,
  appendAutonomoLabel,
  NO_AUTONOMO_LABEL,
  HOUSE_TECH_LABEL,
} from '@/utils/autonomo';

describe('isAutonomo', () => {
  it('returns true for true', () => {
    expect(isAutonomo(true)).toBe(true);
  });

  it('returns true for null', () => {
    expect(isAutonomo(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isAutonomo(undefined)).toBe(true);
  });

  it('returns false for false', () => {
    expect(isAutonomo(false)).toBe(false);
  });

  it('interprets null as freelancer (autonomo)', () => {
    // Null means not specified, default to freelancer
    expect(isAutonomo(null)).toBe(true);
  });

  it('interprets undefined as freelancer (autonomo)', () => {
    expect(isAutonomo(undefined)).toBe(true);
  });
});

describe('getAutonomoBadgeLabel', () => {
  describe('house techs', () => {
    it('returns HOUSE_TECH_LABEL for house techs regardless of autonomo value', () => {
      expect(getAutonomoBadgeLabel(true, true)).toBe(HOUSE_TECH_LABEL);
      expect(getAutonomoBadgeLabel(false, true)).toBe(HOUSE_TECH_LABEL);
      expect(getAutonomoBadgeLabel(null, true)).toBe(HOUSE_TECH_LABEL);
    });

    it('returns HOUSE_TECH_LABEL when isHouseTech is true', () => {
      expect(getAutonomoBadgeLabel(undefined, true)).toBe(HOUSE_TECH_LABEL);
    });
  });

  describe('autonomo (freelancer)', () => {
    it('returns null for autonomo=true', () => {
      expect(getAutonomoBadgeLabel(true, false)).toBe(null);
    });

    it('returns null for autonomo=null (default freelancer)', () => {
      expect(getAutonomoBadgeLabel(null, false)).toBe(null);
    });

    it('returns null for autonomo=undefined', () => {
      expect(getAutonomoBadgeLabel(undefined, false)).toBe(null);
    });
  });

  describe('no autonomo', () => {
    it('returns NO_AUTONOMO_LABEL for autonomo=false', () => {
      expect(getAutonomoBadgeLabel(false, false)).toBe(NO_AUTONOMO_LABEL);
    });

    it('returns NO_AUTONOMO_LABEL when not house tech and autonomo=false', () => {
      expect(getAutonomoBadgeLabel(false, undefined)).toBe(NO_AUTONOMO_LABEL);
    });
  });

  describe('constants', () => {
    it('NO_AUTONOMO_LABEL contains discount info', () => {
      expect(NO_AUTONOMO_LABEL).toContain('€30');
      expect(NO_AUTONOMO_LABEL).toContain('descuento');
    });

    it('HOUSE_TECH_LABEL is "Plantilla"', () => {
      expect(HOUSE_TECH_LABEL).toBe('Plantilla');
    });
  });
});

describe('appendAutonomoLabel', () => {
  describe('base cases', () => {
    it('returns base string when autonomo (no label)', () => {
      expect(appendAutonomoLabel('John Doe', true)).toBe('John Doe');
    });

    it('returns base string when null (default freelancer)', () => {
      expect(appendAutonomoLabel('Jane Doe', null)).toBe('Jane Doe');
    });
  });

  describe('no autonomo label', () => {
    it('appends label on new line by default', () => {
      const result = appendAutonomoLabel('John Doe', false);
      expect(result).toBe(`John Doe\n${NO_AUTONOMO_LABEL}`);
    });

    it('appends label inline when multiline=false', () => {
      const result = appendAutonomoLabel('John Doe', false, { multiline: false });
      expect(result).toBe(`John Doe (${NO_AUTONOMO_LABEL})`);
    });
  });

  describe('house tech label', () => {
    it('appends house tech label on new line', () => {
      const result = appendAutonomoLabel('Jane Doe', true, { isHouseTech: true });
      expect(result).toBe(`Jane Doe\n${HOUSE_TECH_LABEL}`);
    });

    it('appends house tech label inline when multiline=false', () => {
      const result = appendAutonomoLabel('Jane Doe', true, { isHouseTech: true, multiline: false });
      expect(result).toBe(`Jane Doe (${HOUSE_TECH_LABEL})`);
    });

    it('prioritizes house tech over no-autonomo', () => {
      // House tech with autonomo=false still shows "Plantilla"
      const result = appendAutonomoLabel('Jane Doe', false, { isHouseTech: true });
      expect(result).toBe(`Jane Doe\n${HOUSE_TECH_LABEL}`);
    });
  });

  describe('options', () => {
    it('multiline=true is default behavior', () => {
      const resultDefault = appendAutonomoLabel('Name', false);
      const resultExplicit = appendAutonomoLabel('Name', false, { multiline: true });
      expect(resultDefault).toBe(resultExplicit);
    });

    it('multiline=false formats inline', () => {
      const result = appendAutonomoLabel('Name', false, { multiline: false });
      expect(result).toContain('(');
      expect(result).toContain(')');
      expect(result).not.toContain('\n');
    });
  });
});
