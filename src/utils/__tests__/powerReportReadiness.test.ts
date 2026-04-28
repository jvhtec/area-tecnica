import { describe, expect, it } from 'vitest';

import {
  getTechnicalPowerDepartmentFromDocument,
  getTechnicalPowerReportStatus,
} from '@/utils/powerReportReadiness';

describe('powerReportReadiness', () => {
  it('classifies documents by department using the current storage conventions', () => {
    expect(
      getTechnicalPowerDepartmentFromDocument({
        file_name: 'Informe_de_Potencia_-_Show.pdf',
        file_path: 'calculators/lights-consumos/job-1/Informe_de_Potencia_-_Show.pdf',
        uploaded_at: '2026-04-07T10:00:00.000Z',
      })
    ).toBe('lights');

    expect(
      getTechnicalPowerDepartmentFromDocument({
        file_name: 'Sound_Power_Report_-_Show.pdf',
        file_path: 'calculators/consumos/job-1/Sound_Power_Report_-_Show.pdf',
        uploaded_at: '2026-04-07T10:01:00.000Z',
      })
    ).toBe('sound');

    expect(
      getTechnicalPowerDepartmentFromDocument({
        file_name: 'Video_Power_Report_-_Show.pdf',
        file_path: 'calculators/consumos/job-1/Video_Power_Report_-_Show.pdf',
        uploaded_at: '2026-04-07T10:02:00.000Z',
      })
    ).toBe('video');
  });

  it('keeps only the newest upload per department', () => {
    const status = getTechnicalPowerReportStatus([
      {
        id: 'sound-old',
        file_name: 'Sound_Power_Report_-_Show.pdf',
        file_path: 'calculators/consumos/job-1/Sound_Power_Report_-_Show.pdf',
        uploaded_at: '2026-04-07T08:00:00.000Z',
      },
      {
        id: 'sound-new',
        file_name: 'Sound_Power_Report_-_Show_v2.pdf',
        file_path: 'calculators/consumos/job-1/Sound_Power_Report_-_Show_v2.pdf',
        uploaded_at: '2026-04-07T11:00:00.000Z',
      },
      {
        id: 'lights',
        file_name: 'Informe_de_Potencia_-_Show.pdf',
        file_path: 'calculators/lights-consumos/job-1/Informe_de_Potencia_-_Show.pdf',
        uploaded_at: '2026-04-07T10:00:00.000Z',
      },
      {
        id: 'video',
        file_name: 'Video_Power_Report_-_Show.pdf',
        file_path: 'calculators/consumos/job-1/Video_Power_Report_-_Show.pdf',
        uploaded_at: '2026-04-07T10:30:00.000Z',
      },
    ]);

    expect(status.ready).toBe(true);
    expect(status.latestDocsByDepartment.sound?.id).toBe('sound-new');
  });

  it('treats malformed upload timestamps as the oldest value', () => {
    const status = getTechnicalPowerReportStatus([
      {
        id: 'sound-invalid-date',
        file_name: 'Sound_Power_Report_-_Show.pdf',
        file_path: 'calculators/consumos/job-1/Sound_Power_Report_-_Show.pdf',
        uploaded_at: 'not-a-date',
      },
      {
        id: 'sound-valid-date',
        file_name: 'Sound_Power_Report_-_Show_v2.pdf',
        file_path: 'calculators/consumos/job-1/Sound_Power_Report_-_Show_v2.pdf',
        uploaded_at: '2026-04-07T11:00:00.000Z',
      },
    ]);

    expect(status.latestDocsByDepartment.sound?.id).toBe('sound-valid-date');
  });

  it('reports missing departments when the pack is not ready', () => {
    const status = getTechnicalPowerReportStatus([
      {
        file_name: 'Sound_Power_Report_-_Show.pdf',
        file_path: 'calculators/consumos/job-1/Sound_Power_Report_-_Show.pdf',
        uploaded_at: '2026-04-07T10:00:00.000Z',
      },
    ]);

    expect(status.ready).toBe(false);
    expect(status.missingDepartments).toEqual(['lights', 'video']);
  });
});
