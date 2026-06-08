import { describe, expect, it, vi } from "vitest";

import {
  buildPrepTimesheetDateMap,
  buildPrepTimesheetMap,
  fetchTourJobEmailTimesheets,
} from "@/lib/tour-payout-email";

describe("tour payout prep-day timesheet documentation", () => {
  it("fetches tour email timesheets without selecting virtual visible amount columns", async () => {
    type QueryResult = {
      data: Array<Record<string, unknown>>;
      error: null;
    };
    type EqQuery = {
      eq: (column: string, value: unknown) => EqQuery | Promise<QueryResult>;
    };

    let selectedColumns = "";
    const filters: Array<[string, unknown]> = [];
    const query: EqQuery = {
      eq: vi.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        if (filters.length === 1) return query;
        return Promise.resolve({
          data: [
            {
              technician_id: "tech-1",
              job_id: "job-1",
              date: "2026-06-01",
              approved_by_manager: true,
              amount_breakdown: { is_prep_day: true, total_eur: 75 },
            },
          ],
          error: null,
        });
      }),
    };
    const select = vi.fn((columns: string) => {
      selectedColumns = columns;
      return query;
    });
    const supabase = {
      from: vi.fn(() => ({ select })),
    };

    const rows = await fetchTourJobEmailTimesheets(
      supabase as unknown as Parameters<typeof fetchTourJobEmailTimesheets>[0],
      "job-1"
    );

    expect(supabase.from).toHaveBeenCalledWith("timesheets");
    expect(selectedColumns).toBe("technician_id, job_id, date, approved_by_manager, amount_breakdown");
    expect(selectedColumns).not.toContain("amount_breakdown_visible");
    expect(filters).toEqual([
      ["job_id", "job-1"],
      ["is_active", true],
    ]);
    expect(rows).toHaveLength(1);
  });

  it("keeps only approved prep-day rows in the prep timesheet map", () => {
    const map = buildPrepTimesheetMap([
      {
        technician_id: "tech-1",
        date: "2026-05-31",
        approved_by_manager: true,
        amount_breakdown: {
          is_prep_day: true,
          hours_rounded: 6,
          base_day_eur: 90,
          prep_day_hourly_rate_eur: 15,
          total_eur: 90,
        },
      },
      {
        technician_id: "tech-1",
        date: "2026-06-01",
        approved_by_manager: true,
        amount_breakdown: {
          is_prep_day: false,
          hours_rounded: 8,
          total_eur: 160,
        },
      },
      {
        technician_id: "tech-2",
        date: "2026-05-31",
        approved_by_manager: false,
        amount_breakdown: {
          is_prep_day: true,
          hours_rounded: 5,
          total_eur: 75,
        },
      },
    ]);

    expect(map.get("tech-1")).toEqual([
      expect.objectContaining({
        date: "2026-05-31",
        hours_rounded: 6,
        is_prep_day: true,
        prep_day_hourly_rate_eur: 15,
        total_eur: 90,
      }),
    ]);
    expect(map.has("tech-2")).toBe(false);
  });

  it("builds tour worked-date documentation only from approved prep-day lines", () => {
    const prepMap = buildPrepTimesheetMap([
      {
        technician_id: "tech-1",
        date: "2026-05-31",
        approved_by_manager: true,
        amount_breakdown: {
          is_prep_day: true,
          hours_rounded: 6,
          total_eur: 90,
        },
      },
      {
        technician_id: "tech-1",
        date: "2026-06-01",
        approved_by_manager: true,
        amount_breakdown: {
          is_prep_day: false,
          hours_rounded: 8,
          total_eur: 160,
        },
      },
    ]);

    const dateMap = buildPrepTimesheetDateMap(prepMap);

    expect(Array.from(dateMap.get("tech-1") || [])).toEqual(["2026-05-31"]);
  });
});
