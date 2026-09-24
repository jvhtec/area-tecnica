import { describe, expect, it } from "vitest";

import {
  assignmentDayKeys,
  buildDayKeys,
  countUncoveredTransportsByDay,
  defaultAssignmentWindow,
  driverCoversLicense,
  driverDisplayName,
  driverVehicleWarnings,
  findDoubleBookedAssignmentIds,
  formatTransportDateKey,
  formatTransportTime,
  groupAssignmentsByRowAndDay,
  startOfMadridWeek,
  type DriverAssignment,
  type MatrixTransportEvent,
} from "../fleetModel";

const assignment = (overrides: Partial<DriverAssignment>): DriverAssignment => ({
  id: "a",
  logistics_event_id: "e",
  driver_id: "d1",
  vehicle_id: null,
  // 08:00–10:00 Madrid (CEST) on 1 Oct 2026.
  starts_at: "2026-10-01T06:00:00.000Z",
  ends_at: "2026-10-01T08:00:00.000Z",
  status: "assigned",
  notes: null,
  responded_at: null,
  ...overrides,
});

const event = (overrides: Partial<MatrixTransportEvent>): MatrixTransportEvent => ({
  id: "e",
  event_type: "load",
  transport_type: "trailer",
  event_date: "2026-10-01",
  event_time: "08:00:00",
  timezone: "Europe/Madrid",
  title: null,
  color: null,
  job_id: null,
  job_title: null,
  license_plate: null,
  transport_provider: null,
  loading_bay: null,
  notes: null,
  transport_request_id: null,
  origin: null,
  destination: null,
  location_name: null,
  departments: [],
  ...overrides,
});

describe("driver licences", () => {
  it("accepts the exact category and every category a higher licence implies", () => {
    expect(driverCoversLicense(["C+E"], "C")).toBe(true);
    expect(driverCoversLicense(["C+E"], "C1")).toBe(true);
    expect(driverCoversLicense(["C"], "B")).toBe(true);
    expect(driverCoversLicense(["D"], "D1")).toBe(true);
    expect(driverCoversLicense(["B+E"], "B")).toBe(true);
    expect(driverCoversLicense(["C1+E"], "B+E")).toBe(true);
    expect(driverCoversLicense(["C+E"], "C1+E")).toBe(true);
    expect(driverCoversLicense(["D1+E"], "B+E")).toBe(true);
    expect(driverCoversLicense(["D+E"], "D1+E")).toBe(true);
  });

  it("rejects a vehicle beyond the driver's licence", () => {
    expect(driverCoversLicense(["B"], "C")).toBe(false);
    expect(driverCoversLicense(["C"], "C+E")).toBe(false);
    expect(driverCoversLicense(["C1"], "C")).toBe(false);
  });

  it("warns about missing licences and documents expired on the transport day", () => {
    const driver = { license_categories: ["B"], license_expiry: "2026-09-30", cap_expiry: "2026-09-30" };
    expect(driverVehicleWarnings(driver, { required_license: "C" }, "2026-10-01")).toEqual([
      "license_missing",
      "license_expired",
      "cap_expired",
    ]);
    // A van needs no CAP, and a driver with no licence data yet is not flagged.
    expect(driverVehicleWarnings({ license_categories: [], license_expiry: null, cap_expiry: "2020-01-01" }, { required_license: "B" }, "2026-10-01"))
      .toEqual([]);
    expect(driverVehicleWarnings(
      { license_categories: ["B+E"], license_expiry: null, cap_expiry: "2020-01-01" },
      { required_license: "B+E" },
      "2026-10-01",
    )).toEqual([]);
  });
});

describe("matrix layout", () => {
  it("starts weeks on Monday and lists inclusive day ranges", () => {
    expect(startOfMadridWeek("2026-10-01")).toBe("2026-09-28");
    expect(startOfMadridWeek("2026-09-28")).toBe("2026-09-28");
    expect(startOfMadridWeek("2026-10-04")).toBe("2026-09-28");
    expect(buildDayKeys("2026-09-28", "2026-10-02")).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02",
    ]);
  });

  it("files an assignment under its Madrid day, not its UTC day", () => {
    // 00:30 Madrid on 2 Oct is still 1 Oct in UTC.
    expect(assignmentDayKeys({ starts_at: "2026-10-01T22:30:00.000Z", ends_at: "2026-10-01T23:30:00.000Z" }))
      .toEqual(["2026-10-02"]);
  });

  it("shows an overnight haul on every day it touches, but not the day it ends at midnight", () => {
    expect(assignmentDayKeys({ starts_at: "2026-10-01T18:00:00.000Z", ends_at: "2026-10-02T06:00:00.000Z" }))
      .toEqual(["2026-10-01", "2026-10-02"]);
    expect(assignmentDayKeys({ starts_at: "2026-10-01T20:00:00.000Z", ends_at: "2026-10-01T22:00:00.000Z" }))
      .toEqual(["2026-10-01"]);
  });

  it("formats and groups assignment time in the transport event timezone", () => {
    const item = assignment({
      starts_at: "2026-10-01T22:30:00.000Z",
      ends_at: "2026-10-02T00:30:00.000Z",
    });
    expect(formatTransportTime(item.starts_at, "Europe/London")).toBe("23:30");
    expect(formatTransportDateKey(item.starts_at, "Europe/London")).toBe("2026-10-01");
    expect(formatTransportDateKey(item.starts_at, "Europe/Madrid")).toBe("2026-10-02");
    expect(assignmentDayKeys(item, "Europe/London")).toEqual(["2026-10-01", "2026-10-02"]);

    const grouped = groupAssignmentsByRowAndDay(
      [item],
      "driver_id",
      new Map([["e", "Europe/London"]]),
    );
    expect(grouped.get("d1")?.has("2026-10-01")).toBe(true);
  });

  it("groups several same-day transports into one cell in start order", () => {
    const later = assignment({ id: "late", starts_at: "2026-10-01T13:00:00.000Z", ends_at: "2026-10-01T14:00:00.000Z" });
    const early = assignment({ id: "early" });
    const grouped = groupAssignmentsByRowAndDay([later, early], "driver_id");
    expect(grouped.get("d1")?.get("2026-10-01")?.map((a) => a.id)).toEqual(["early", "late"]);
    expect(groupAssignmentsByRowAndDay([early], "vehicle_id").size).toBe(0);
  });
});

describe("double booking", () => {
  it("flags overlapping windows for the same driver or vehicle", () => {
    const flagged = findDoubleBookedAssignmentIds([
      assignment({ id: "a" }),
      assignment({ id: "b", starts_at: "2026-10-01T07:00:00.000Z", ends_at: "2026-10-01T09:00:00.000Z" }),
      assignment({ id: "c", driver_id: "d2", vehicle_id: "v1", starts_at: "2026-10-01T12:00:00.000Z", ends_at: "2026-10-01T13:00:00.000Z" }),
      assignment({ id: "d", driver_id: "d3", vehicle_id: "v1", starts_at: "2026-10-01T12:30:00.000Z", ends_at: "2026-10-01T14:00:00.000Z" }),
    ]);
    expect([...flagged].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("lets back-to-back runs and declined rows pass", () => {
    expect(findDoubleBookedAssignmentIds([
      assignment({ id: "a" }),
      assignment({ id: "b", starts_at: "2026-10-01T08:00:00.000Z", ends_at: "2026-10-01T09:00:00.000Z" }),
      assignment({ id: "c", status: "declined", starts_at: "2026-10-01T07:00:00.000Z" }),
    ]).size).toBe(0);
  });
});

describe("coverage and defaults", () => {
  it("counts transports without a non-declined driver per day", () => {
    const counts = countUncoveredTransportsByDay(
      [event({ id: "e1" }), event({ id: "e2" }), event({ id: "e3", event_date: "2026-10-02" })],
      [
        assignment({ logistics_event_id: "e1" }),
        assignment({ logistics_event_id: "e2", status: "declined" }),
        assignment({ logistics_event_id: "e3", driver_id: null, vehicle_id: "v1" }),
      ],
    );
    expect(counts.get("2026-10-01")).toBe(1);
    expect(counts.get("2026-10-02")).toBe(1);
  });

  it("defaults to a two-hour window from the transport time, crossing midnight when needed", () => {
    expect(defaultAssignmentWindow(event({ event_time: "08:30:00" }))).toEqual({
      start: "2026-10-01T08:30",
      end: "2026-10-01T10:30",
    });
    expect(defaultAssignmentWindow(event({ event_time: "23:15:00" }))).toEqual({
      start: "2026-10-01T23:15",
      end: "2026-10-02T01:15",
    });
  });

  it("names drivers by first name or nickname", () => {
    expect(driverDisplayName({ first_name: "Ana", last_name: "Ruiz", nickname: null })).toBe("Ana Ruiz");
    expect(driverDisplayName({ first_name: " ", last_name: null, nickname: "Pepe" })).toBe("Pepe");
    expect(driverDisplayName({ first_name: null, last_name: null, nickname: null })).toBe("Sin nombre");
  });
});
