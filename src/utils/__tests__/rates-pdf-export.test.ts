import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TourJobRateQuote } from '@/types/tourRates';
import { generateRateQuotePDF, type TechnicianProfile } from '@/utils/rates-pdf-export';

const autoTableCalls: any[] = [];

vi.mock('jspdf-autotable', () => ({
  __esModule: true,
  default: (doc: any, options: any) => {
    autoTableCalls.push(options);
    (doc as any).lastAutoTable = { finalY: (options.startY ?? 0) + 10 };
  },
}));

vi.mock('@/utils/pdf/logoUtils', () => ({
  fetchJobLogo: vi.fn().mockResolvedValue(undefined),
  fetchTourLogo: vi.fn().mockResolvedValue(undefined),
  getCompanyLogo: vi.fn().mockResolvedValue(undefined),
}));

describe('generateRateQuotePDF', () => {
  beforeEach(() => {
    autoTableCalls.length = 0;
  });

  afterEach(() => {
    autoTableCalls.length = 0;
  });

  it('renders multiplier math in the base column when multiplier applies', async () => {
    const job = {
      id: 'job-1',
      title: 'Madrid Arena',
      start_time: '2025-05-12T08:00:00Z',
      end_time: undefined,
      tour_id: 'tour-1',
      job_type: 'show',
    };

    const profiles: TechnicianProfile[] = [
      { id: 'tech-1', first_name: 'Ana', last_name: 'Lopez', autonomo: false },
      { id: 'tech-2', first_name: 'Luis', last_name: 'Martin', autonomo: true },
    ];

    const quotes: TourJobRateQuote[] = [
      {
        job_id: job.id,
        technician_id: 'tech-1',
        start_time: job.start_time,
        end_time: job.start_time,
        job_type: job.job_type!,
        tour_id: job.tour_id!,
        title: job.title,
        is_house_tech: false,
        is_tour_team_member: false,
        category: 'Backline',
        base_day_eur: 225,
        week_count: 1,
        multiplier: 1.25,
        per_job_multiplier: 1.25,
        iso_year: 2025,
        iso_week: 20,
        total_eur: 225,
        extras_total_eur: 40,
        total_with_extras_eur: 265,
        vehicle_disclaimer: false,
        breakdown: {
          after_discount: 180,
          autonomo_discount: 30,
          weekly_bonus_total_eur: 50,
        },
      },
      {
        job_id: job.id,
        technician_id: 'tech-2',
        start_time: job.start_time,
        end_time: job.start_time,
        job_type: job.job_type!,
        tour_id: job.tour_id!,
        title: job.title,
        is_house_tech: false,
        is_tour_team_member: false,
        category: 'Iluminación',
        base_day_eur: 150,
        week_count: 3,
        multiplier: 3,
        per_job_multiplier: undefined,
        iso_year: 2025,
        iso_week: 20,
        total_eur: 150,
        extras_total_eur: 15,
        total_with_extras_eur: 165,
        vehicle_disclaimer: false,
        breakdown: {
          after_discount: 150,
          autonomo_discount: 0,
          weekly_bonus_total_eur: 0,
        },
      },
    ];

    const blob = (await generateRateQuotePDF(quotes, job, profiles, new Map(), {
      download: false,
    })) as Blob;

    expect(blob).toBeInstanceOf(Blob);
    expect(autoTableCalls.length).toBeGreaterThan(0);

    const mainTable = autoTableCalls[0];
    expect(mainTable.head[0][2]).toBe('Base (calc.)');
    expect(mainTable.body[0][0]).toContain('No autónomo – €30 descuento');
    expect(mainTable.body[0][2]).toBe('180 € ×1,25 = 225 €');
    expect(mainTable.body[1][2]).toBe('150 €');
  });
});
