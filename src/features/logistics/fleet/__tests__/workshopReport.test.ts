import { describe, expect, it } from "vitest";
import { reportAppointments, workshopReportPeriod } from "../workshopReport";
import type { WorkshopAppointment } from "../workshopModel";

describe("informe de citas de flota", () => {
  it("exporta el mes completo y semanas de lunes a domingo que cruzan de año", () => {
    expect(workshopReportPeriod("monthly", "2028-02")).toEqual({ first: "2028-02-01", last: "2028-02-29" });
    expect(workshopReportPeriod("weekly", "2027-01-01")).toEqual({ first: "2026-12-28", last: "2027-01-03" });
    expect(() => workshopReportPeriod("monthly", "2026-13")).toThrow();
    expect(() => workshopReportPeriod("weekly", "")).toThrow();
  });
  it("incluye citas que cruzan el periodo y excluye las que terminan justo al inicio", () => {
    const appointment = (id: string, starts_at: string, ends_at: string) => ({ id, starts_at, ends_at }) as WorkshopAppointment;
    const rows = [
      appointment("before", "2026-09-30T17:00:00Z", "2026-09-30T22:00:00Z"),
      appointment("overlap", "2026-09-30T20:00:00Z", "2026-10-01T07:00:00Z"),
      appointment("after", "2026-10-31T23:00:00Z", "2026-11-01T08:00:00Z"),
      appointment("last-day", "2026-10-31T22:00:00Z", "2026-11-01T00:00:00Z"),
    ];
    expect(reportAppointments(rows, "2026-10-01", "2026-10-31").map((row) => row.id)).toEqual(["overlap", "last-day"]);
  });
});
