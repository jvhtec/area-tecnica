import { describe, expect, it, vi } from 'vitest';
import { prepareJobPayoutData } from '@/lib/job-payout-data';

const createEqInQuery = (response: unknown) => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      in: vi.fn(async () => response),
    })),
  })),
});

describe('prepareJobPayoutData', () => {
  it('enriches standard payout rows with override metadata and house-tech status for PDFs', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'jobs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: 'job-1',
                    title: 'Festival Job',
                    start_time: '2026-04-01T08:00:00.000Z',
                    end_time: '2026-04-01T18:00:00.000Z',
                    tour_id: null,
                    rates_approved: true,
                    job_type: 'show',
                    invoicing_company: 'Sector Pro',
                  },
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === 'v_job_tech_payout_2025') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [
                  {
                    job_id: 'job-1',
                    technician_id: 'tech-1',
                    timesheets_total_eur: 500,
                    extras_total_eur: 0,
                    expenses_total_eur: 0,
                    total_eur: 650,
                    extras_breakdown: { items: [] },
                    expenses_breakdown: [],
                    vehicle_disclaimer: false,
                  },
                ],
                error: null,
              })),
            })),
          };
        }

        if (table === 'job_technician_payout_overrides') {
          return createEqInQuery({
            data: [
              {
                technician_id: 'tech-1',
                override_amount_eur: 650,
                set_by: 'manager-1',
                set_at: '2026-04-02T10:15:00.000Z',
                updated_at: '2026-04-02T10:15:00.000Z',
              },
            ],
            error: null,
          });
        }

        if (table === 'v_job_tech_payout_2025_base') {
          return createEqInQuery({
            data: [{ technician_id: 'tech-1', total_eur: 500 }],
            error: null,
          });
        }

        if (table === 'profiles') {
          return {
            select: vi.fn((columns: string) => ({
              in: vi.fn(async () => ({
                data: columns.includes('autonomo')
                  ? [
                      {
                        id: 'tech-1',
                        first_name: 'Ana',
                        last_name: 'Lopez',
                        email: 'ana@example.com',
                        autonomo: false,
                      },
                    ]
                  : [
                      {
                        id: 'manager-1',
                        first_name: 'Marta',
                        last_name: 'Manager',
                        email: 'marta@example.com',
                      },
                    ],
                error: null,
              })),
            })),
          };
        }

        if (table === 'flex_work_orders') {
          return createEqInQuery({
            data: [{ technician_id: 'tech-1', lpo_number: 'LPO-001' }],
            error: null,
          });
        }

        throw new Error(`Unexpected table lookup: ${table}`);
      }),
      rpc: vi.fn(async (fn: string, args: { _profile_id: string }) => {
        if (fn !== 'is_house_tech') {
          throw new Error(`Unexpected RPC: ${fn}`);
        }

        return { data: args._profile_id === 'tech-1', error: null };
      }),
    };

    const result = await prepareJobPayoutData({
      jobId: 'job-1',
      supabase: supabase as any,
    });

    expect(result.job).toMatchObject({
      id: 'job-1',
      title: 'Festival Job',
      invoicing_company: 'Sector Pro',
    });
    expect(result.profiles).toEqual([
      expect.objectContaining({
        id: 'tech-1',
        first_name: 'Ana',
        is_house_tech: true,
      }),
    ]);
    expect(result.lpoMap.get('tech-1')).toBe('LPO-001');
    expect(result.payouts).toEqual([
      expect.objectContaining({
        technician_id: 'tech-1',
        total_eur: 650,
        has_override: true,
        override_amount_eur: 650,
        calculated_total_eur: 500,
        override_actor_name: 'Marta Manager',
        override_actor_email: 'marta@example.com',
        override_set_at: '2026-04-02T10:15:00.000Z',
      }),
    ]);
  });
});
