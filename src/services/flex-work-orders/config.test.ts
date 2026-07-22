import { describe, expect, it } from 'vitest';
import { technicianDisplayName } from '@/services/flex-work-orders/config';

describe('Flex work-order configuration', () => {
  it('builds trimmed technician labels with the existing fallback', () => {
    expect(technicianDisplayName({ first_name: ' Ana ', last_name: ' López ' })).toBe('Ana López');
    expect(technicianDisplayName({ first_name: null, last_name: 'Santos' })).toBe('Santos');
    expect(technicianDisplayName()).toBe('Sin nombre');
  });
});
