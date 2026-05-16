import { describe, expect, it } from "vitest";

import {
  formatCompanyLabel,
  formatDateTimeLabel,
  formatRoomTypeLabel,
  formatShiftTime,
  formatTransportCategory,
  getDateTypeBadgeClass,
  getDateTypeLabel,
  getJobTypeLabel,
  getLogisticsTransportTypeLabel,
  getTravelTransportTypeLabel,
  isUuidLike,
} from "../formatters";

describe("technician details modal formatters", () => {
  it("keeps legacy labels for job, date, room, and transport values", () => {
    expect(getJobTypeLabel("tourdate")).toBe("Fecha de gira");
    expect(getJobTypeLabel("unknown")).toBe("Un solo día");
    expect(getDateTypeLabel("setup")).toBe("Montaje");
    expect(formatRoomTypeLabel("double")).toBe("Doble");
    expect(getTravelTransportTypeLabel("sleeper_bus")).toBe("Autobús cama");
    expect(getLogisticsTransportTypeLabel("9m")).toBe("Camión 9m");
    expect(formatCompanyLabel("sector_pro")).toBe("Sector Pro");
  });

  it("preserves fallback formatting for custom values", () => {
    expect(formatTransportCategory("night_bus")).toBe("Night Bus");
    expect(getTravelTransportTypeLabel("night_bus")).toBe("Night Bus");
    expect(formatCompanyLabel("wild tour")).toBe("Wild Tour");
    expect(formatRoomTypeLabel("quad")).toBe("quad");
  });

  it("formats time-like values without creating dates", () => {
    expect(formatShiftTime("09:30:00")).toBe("09:30");
    expect(formatShiftTime("call")).toBe("call");
    expect(formatDateTimeLabel("08:15:00")).toBe("08:15");
    expect(formatDateTimeLabel(null)).toBe("Pendiente");
  });

  it("returns stable badge classes for date types in both themes", () => {
    expect(getDateTypeBadgeClass("show", true)).toContain("bg-emerald-500/20");
    expect(getDateTypeBadgeClass("show", false)).toContain("bg-emerald-100");
    expect(getDateTypeBadgeClass("custom", true)).toContain("bg-slate-500/20");
  });

  it("recognizes UUID-like room occupant ids", () => {
    expect(isUuidLike("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUuidLike("0")).toBe(false);
    expect(isUuidLike("not-a-uuid")).toBe(false);
  });
});
