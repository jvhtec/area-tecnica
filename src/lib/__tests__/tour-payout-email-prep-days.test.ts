import { describe, expect, it } from "vitest";

import {
  buildPrepTimesheetDateMap,
  buildPrepTimesheetMap,
} from "@/lib/tour-payout-email";

describe("tour payout prep-day timesheet documentation", () => {
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
