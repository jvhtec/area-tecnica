import { describe, expect, it } from 'vitest';
import { canUseLaSessionTools } from './access.ts';

describe('canUseLaSessionTools', () => {
  it('allows admin and management to retain access to the NM/SV parser', () => {
    expect(canUseLaSessionTools('admin', null, false)).toBe(true);
    expect(canUseLaSessionTools('management', 'lights', false)).toBe(true);
  });

  it('allows Sound house techs without an explicit grant', () => {
    expect(canUseLaSessionTools('house_tech', 'sound', false)).toBe(true);
    expect(canUseLaSessionTools('house_tech', 'lights', true)).toBe(false);
  });

  it('allows only explicitly entitled Sound technicians', () => {
    expect(canUseLaSessionTools('technician', 'sound', true)).toBe(true);
    expect(canUseLaSessionTools('technician', 'sound', false)).toBe(false);
    expect(canUseLaSessionTools('technician', 'lights', true)).toBe(false);
  });
});
