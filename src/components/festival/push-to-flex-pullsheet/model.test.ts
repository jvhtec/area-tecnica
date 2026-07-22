import { describe, expect, it } from 'vitest';
import {
  ALL_SECTIONS_ENABLED,
  isPaPresetCategory,
  normalizePresetSubsystem,
} from '@/components/festival/push-to-flex-pullsheet/model';

describe('push-to-Flex pullsheet model', () => {
  it('accepts only PA preset categories and known subsystems', () => {
    expect(isPaPresetCategory('pa_mains')).toBe(true);
    expect(isPaPresetCategory('wired_mics')).toBe(false);
    expect(isPaPresetCategory(null)).toBe(false);
    expect(normalizePresetSubsystem('amplification')).toBe('amplification');
    expect(normalizePresetSubsystem('unknown')).toBeNull();
  });

  it('enables every gear section by default', () => {
    expect(ALL_SECTIONS_ENABLED).toEqual({
      consolas: true,
      rf: true,
      iem: true,
      wired_mics: true,
    });
  });
});
