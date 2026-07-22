import { describe, expect, it } from 'vitest';
import { evaluateDropValidity, isValidDrop, type DropValidityInput } from '../dropValidity';

const baseInput = (overrides: Partial<DropValidityInput> = {}): DropValidityInput => ({
  sourceTechnicianId: 'tech-source',
  sourceDateKey: '2026-07-15',
  targetTechnicianId: 'tech-target',
  targetDateKey: '2026-07-15',
  targetHasAssignment: false,
  targetIsFridge: false,
  targetIsUnavailable: false,
  targetHasDeclinedJob: false,
  ...overrides,
});

describe('evaluateDropValidity', () => {
  it('is valid for an empty cell on the same date, different technician', () => {
    expect(evaluateDropValidity(baseInput())).toBe('valid');
  });

  it('rejects dropping onto the same technician', () => {
    const result = evaluateDropValidity(baseInput({ targetTechnicianId: 'tech-source' }));
    expect(result).toBe('invalid-same-technician');
  });

  it('rejects cross-date drops', () => {
    const result = evaluateDropValidity(baseInput({ targetDateKey: '2026-07-16' }));
    expect(result).toBe('invalid-different-date');
  });

  it('rejects an occupied target cell', () => {
    expect(evaluateDropValidity(baseInput({ targetHasAssignment: true }))).toBe('invalid-occupied');
  });

  it('rejects a fridge technician before checking occupancy', () => {
    const result = evaluateDropValidity(baseInput({ targetIsFridge: true, targetHasAssignment: true }));
    expect(result).toBe('invalid-fridge');
  });

  it('rejects a technician who already declined this job', () => {
    expect(evaluateDropValidity(baseInput({ targetHasDeclinedJob: true }))).toBe('invalid-declined');
  });

  it('rejects an unavailable technician', () => {
    expect(evaluateDropValidity(baseInput({ targetIsUnavailable: true }))).toBe('invalid-unavailable');
  });
});

describe('isValidDrop', () => {
  it('is true only for "valid"', () => {
    expect(isValidDrop('valid')).toBe(true);
    expect(isValidDrop('invalid-occupied')).toBe(false);
  });
});
