import { describe, expect, it } from 'vitest';
import {
  buildIncidentReportPdfFilename,
  buildJobPayoutPdfFilename,
  buildPayoutDuePdfFilename,
  buildTourPayoutPdfFilename,
  buildVacationRequestPdfFilename,
} from '@/utils/pdfFileNames';

describe('pdfFileNames', () => {
  const referenceDate = new Date(2026, 2, 4, 9, 8, 7);

  it('normalizes accents and repeated spaces with lowercase hyphen separators', () => {
    const filename = buildTourPayoutPdfFilename({
      jobTitle: '  Gira   Ñandú  ',
      jobId: 'job-1',
      technicianName: ' José   Luís ',
      technicianId: 'tech-1',
      generatedAt: referenceDate,
    });

    expect(filename).toBe('pago-gira-ñandú-josé-luís-2026-03-04.pdf');
  });

  it('removes invalid symbols from filename parts', () => {
    const filename = buildTourPayoutPdfFilename({
      jobTitle: 'Plan <A>/B:*',
      jobId: 'job-2',
      technicianName: 'Ana | QA ?',
      technicianId: 'tech-2',
      generatedAt: referenceDate,
    });

    expect(filename).toBe('pago-plan-a-b-ana-qa-2026-03-04.pdf');
  });

  it('falls back to ids when titles or names are empty', () => {
    const filename = buildJobPayoutPdfFilename({
      jobTitle: '   ',
      jobId: 'job-42',
      technicianName: '',
      technicianId: 'tech-99',
      generatedAt: referenceDate,
    });

    expect(filename).toBe('pago-job-42-tech-99-2026-03-04.pdf');
  });

  it('uses the same style for payout-due, incident, and vacation PDFs', () => {
    expect(buildPayoutDuePdfFilename(new Date(2026, 0, 15), new Date(2026, 0, 31))).toBe(
      'pagos-previstos-2026-01-15-2026-01-31.pdf',
    );
    expect(buildIncidentReportPdfFilename('', referenceDate)).toBe(
      'reporte-incidencia-2026-03-04-09-08-07.pdf',
    );
    expect(buildVacationRequestPdfFilename('  María   del   Mar  ', referenceDate)).toBe(
      'vacation-request-maría-del-mar-2026-03-04.pdf',
    );
  });
});
