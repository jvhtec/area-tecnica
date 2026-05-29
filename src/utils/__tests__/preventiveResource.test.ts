import { describe, expect, it } from 'vitest';

import {
  getPreventiveResourceOptions,
  isPreventiveResourceForJob,
} from '@/utils/preventiveResource';

describe('preventiveResource', () => {
  it('keeps only confirmed assigned technicians across departments', () => {
    const options = getPreventiveResourceOptions([
      {
        technician_id: 'sound-tech',
        status: 'confirmed',
        profiles: { first_name: 'Ana', last_name: 'Sonido', department: 'sound', role: 'technician' },
      },
      {
        technician_id: 'lights-tech',
        status: 'confirmed',
        profiles: { first_name: 'Luis', last_name: 'Luces', department: 'lights', role: 'house_tech' },
      },
      {
        technician_id: 'pending-tech',
        status: 'invited',
        profiles: { first_name: 'Pendiente', last_name: 'Uno', department: 'video', role: 'technician' },
      },
      {
        technician_id: 'sound-tech',
        status: 'confirmed',
        profiles: { first_name: 'Ana', last_name: 'Sonido', department: 'sound', role: 'technician' },
      },
    ]);

    expect(options).toEqual([
      { id: 'sound-tech', name: 'Ana Sonido', department: 'sound', role: 'technician' },
      { id: 'lights-tech', name: 'Luis Luces', department: 'lights', role: 'house_tech' },
    ]);
  });

  it('detects when a technician is the job preventive resource', () => {
    expect(isPreventiveResourceForJob({ preventive_resource_technician_id: 'tech-1' }, 'tech-1')).toBe(true);
    expect(isPreventiveResourceForJob({ preventive_resource_technician_id: 'tech-1' }, 'tech-2')).toBe(false);
    expect(isPreventiveResourceForJob({ preventive_resource_technician_id: null }, 'tech-1')).toBe(false);
  });
});
