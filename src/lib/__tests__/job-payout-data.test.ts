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
  it('treats an explicitly empty payouts override as authoritative', async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error('Unexpected query');
      }),
      rpc: vi.fn(),
    };

    const result = await prepareJobPayoutData({
      jobId: 'job-empty',
      supabase: supabase as any,
      jobDetails: {
        id: 'job-empty',
        title: 'No payouts',
        start_time: '2026-04-04T08:00:00.000Z',
      },
      payouts: [],
    });

    expect(result.payouts).toEqual([]);
    expect(result.profiles).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

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

  it('does not short-circuit on partial provided profiles when more technician ids are required', async () => {
    const rpcCalls: string[] = [];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'jobs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: 'job-3',
                    title: 'Partial profile cache',
                    start_time: '2026-04-05T08:00:00.000Z',
                    end_time: '2026-04-05T18:00:00.000Z',
                    tour_id: null,
                    rates_approved: true,
                    job_type: 'show',
                    invoicing_company: null,
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
                    job_id: 'job-3',
                    technician_id: 'tech-1',
                    timesheets_total_eur: 100,
                    extras_total_eur: 0,
                    expenses_total_eur: 0,
                    total_eur: 100,
                    extras_breakdown: { items: [] },
                    expenses_breakdown: [],
                    vehicle_disclaimer: false,
                  },
                  {
                    job_id: 'job-3',
                    technician_id: 'tech-2',
                    timesheets_total_eur: 200,
                    extras_total_eur: 0,
                    expenses_total_eur: 0,
                    total_eur: 200,
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
            data: [],
            error: null,
          });
        }

        if (table === 'v_job_tech_payout_2025_base') {
          return createEqInQuery({
            data: [],
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
                        first_name: 'Fetched',
                        last_name: 'One',
                        email: 'one@example.com',
                        autonomo: false,
                      },
                      {
                        id: 'tech-2',
                        first_name: 'Fetched',
                        last_name: 'Two',
                        email: 'two@example.com',
                        autonomo: true,
                      },
                    ]
                  : [],
                error: null,
              })),
            })),
          };
        }

        if (table === 'flex_work_orders') {
          return createEqInQuery({
            data: [],
            error: null,
          });
        }

        throw new Error(`Unexpected table lookup: ${table}`);
      }),
      rpc: vi.fn(async (fn: string, args: { _profile_id: string }) => {
        if (fn !== 'is_house_tech') {
          throw new Error(`Unexpected RPC: ${fn}`);
        }

        rpcCalls.push(args._profile_id);
        return { data: args._profile_id === 'tech-1', error: null };
      }),
    };

    const result = await prepareJobPayoutData({
      jobId: 'job-3',
      supabase: supabase as any,
      profiles: [
        {
          id: 'tech-1',
          first_name: 'Cached',
          last_name: 'Only',
          email: 'cached@example.com',
          autonomo: false,
          is_house_tech: false,
        },
      ],
    });

    expect(result.profiles).toEqual([
      expect.objectContaining({
        id: 'tech-1',
        first_name: 'Fetched',
        email: 'one@example.com',
        is_house_tech: true,
      }),
      expect.objectContaining({
        id: 'tech-2',
        first_name: 'Fetched',
        email: 'two@example.com',
        is_house_tech: false,
      }),
    ]);
    expect(rpcCalls.sort()).toEqual(['tech-1', 'tech-2']);
  });

  it('falls back to provided profiles when the profile lookup fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'jobs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: 'job-2',
                    title: 'Pack Export Job',
                    start_time: '2026-04-03T08:00:00.000Z',
                    end_time: '2026-04-03T18:00:00.000Z',
                    tour_id: null,
                    rates_approved: true,
                    job_type: 'show',
                    invoicing_company: null,
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
                    job_id: 'job-2',
                    technician_id: 'tech-2',
                    timesheets_total_eur: 320,
                    extras_total_eur: 20,
                    expenses_total_eur: 0,
                    total_eur: 340,
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
            data: [],
            error: null,
          });
        }

        if (table === 'v_job_tech_payout_2025_base') {
          return createEqInQuery({
            data: [],
            error: null,
          });
        }

        if (table === 'profiles') {
          return {
            select: vi.fn((columns: string) => ({
              in: vi.fn(async () => ({
                data: columns.includes('autonomo') ? null : [],
                error: columns.includes('autonomo') ? new Error('profiles unavailable') : null,
              })),
            })),
          };
        }

        if (table === 'flex_work_orders') {
          return createEqInQuery({
            data: [],
            error: null,
          });
        }

        throw new Error(`Unexpected table lookup: ${table}`);
      }),
      rpc: vi.fn(async () => ({ data: false, error: null })),
    };

    try {
      const result = await prepareJobPayoutData({
        jobId: 'job-2',
        supabase: supabase as any,
        profiles: [
          {
            id: 'tech-2',
            first_name: 'Fallback',
            last_name: 'Tech',
            autonomo: false,
          },
        ],
      });

      expect(result.payouts).toEqual([
        expect.objectContaining({
          technician_id: 'tech-2',
          total_eur: 340,
        }),
      ]);
      expect(result.profiles).toEqual([
        expect.objectContaining({
          id: 'tech-2',
          first_name: 'Fallback',
          last_name: 'Tech',
          autonomo: false,
        }),
      ]);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
