import { describe, expect, it } from "vitest";

import {
  assignmentDayKeys,
  buildDayKeys,
  countPendingConfirmations,
  countUncoveredTransportsByDay,
  defaultAssignmentWindow,
  documentStatus,
  driverCoversLicense,
  driverDisplayName,
  driverVehicleWarnings,
  findDoubleBookedAssignmentIds,
  formatBerthLayouts,
  formatTransportDateKey,
  formatTransportSpan,
  formatTransportTime,
  groupAssignmentsByRowAndDay,
  isCrewTransfer,
  isExternallyHandledTransport,
  maxBerths,
  parseBerthLayouts,
  seatShortfall,
  startOfMadridWeek,
  suggestedLicenseForVehicleType,
  summarizeDriversByEvent,
  transportOperationLabel,
  unavailabilityByDay,
  vehicleTypeLabel,
  type DriverAssignment,
  type MatrixDriver,
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
  decline_reason: null,
  ...overrides,
});

const driver = (overrides: Partial<MatrixDriver>): MatrixDriver => ({
  id: "d1",
  first_name: "Ana",
  last_name: "Conductora",
  nickname: null,
  department: "logistics",
  phone: null,
  license_categories: ["C+E"],
  license_expiry: null,
  cap_expiry: null,
  tachograph_card_expiry: null,
  adr_certified: false,
  default_vehicle_id: null,
  notes: null,
  unavailable_days: [],
  ...overrides,
});

const event = (overrides: Partial<MatrixTransportEvent>): MatrixTransportEvent => ({
  id: "e",
  event_type: "load",
  transport_type: "trailer",
  event_date: "2026-10-01",
  event_time: "08:00:00",
  end_date: null,
  end_time: null,
  timezone: "Europe/Madrid",
  title: null,
  color: null,
  job_id: null,
  job_title: null,
  license_plate: null,
  transport_provider: null,
  berth_count: null,
  job_crew_count: null,
  passenger_count: null,
  movement_type: null,
  origin_location_id: null,
  loading_bay: null,
  notes: null,
  transport_request_id: null,
  origin: null,
  destination: null,
  location_name: null,
  location_address: null,
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
    expect(driverCoversLicense(["C+E", "D"], "D+E")).toBe(true);
    expect(driverCoversLicense(["C+E", "D"], "D1+E")).toBe(true);
    expect(driverCoversLicense(["C+E", "D1"], "D+E")).toBe(false);
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

  it("warns about expired vehicle documents, an expired tachograph card and days off", () => {
    const offDriver = driver({
      tachograph_card_expiry: "2026-09-30",
      unavailable_days: [{ date: "2026-10-01", status: "vacation" }],
    });
    const vehicle = { required_license: "C" as const, itv_expiry: "2026-09-15", insurance_expiry: "2026-12-31" };
    expect(driverVehicleWarnings(offDriver, vehicle, "2026-10-01")).toEqual([
      "tachograph_expired",
      "driver_unavailable",
      "vehicle_itv_expired",
    ]);
    // The tachograph only matters on professional vehicles, and the day off only on that day.
    expect(driverVehicleWarnings(offDriver, { required_license: "B" }, "2026-10-02")).toEqual([]);
    // A vehicle alone (no driver picked yet) still reports its own documents.
    expect(driverVehicleWarnings(null, { required_license: "B", insurance_expiry: "2026-01-01" }, "2026-10-01"))
      .toEqual(["vehicle_insurance_expired"]);
  });

  it("classifies document expiry as expired, expiring within 30 days, or valid", () => {
    expect(documentStatus(null, "2026-10-01")).toBeNull();
    expect(documentStatus("2026-09-30", "2026-10-01")).toBe("expired");
    expect(documentStatus("2026-10-01", "2026-10-01")).toBe("expiring");
    expect(documentStatus("2026-10-31", "2026-10-01")).toBe("expiring");
    expect(documentStatus("2026-11-01", "2026-10-01")).toBe("valid");
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

describe("sleeper buses", () => {
  it("label as autobús cama and pre-select a D licence", () => {
    expect(vehicleTypeLabel("sleeper_bus")).toBe("Autobús cama");
    expect(suggestedLicenseForVehicleType("sleeper_bus", "B")).toBe("D");
    expect(suggestedLicenseForVehicleType("sleeper_bus", "C+E")).toBe("D");
    // A D-family choice (a nightliner towing a trailer needs D+E) is respected.
    expect(suggestedLicenseForVehicleType("sleeper_bus", "D+E")).toBe("D+E");
    // Other types never have their licence changed behind the user's back.
    expect(suggestedLicenseForVehicleType("trailer", "B")).toBe("B");
  });

  it("need a CAP and tachograph card like any professional vehicle", () => {
    const driver = { license_categories: ["D"], license_expiry: null, cap_expiry: "2026-09-01", tachograph_card_expiry: "2026-09-01" };
    expect(driverVehicleWarnings(driver, { required_license: "D" }, "2026-10-01")).toEqual(["cap_expired", "tachograph_expired"]);
    expect(driverVehicleWarnings({ ...driver, license_categories: ["C+E"] }, { required_license: "D" }, "2026-10-01"))
      .toContain("license_missing");
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

  it("does not ask for a driver on runs an outside company handles", () => {
    const counts = countUncoveredTransportsByDay(
      [
        event({ id: "hired", transport_type: "sleeper_bus", transport_provider: "montoya" }),
        event({ id: "carrier", transport_provider: "pantoja" }),
        event({ id: "own", transport_provider: "sector_pro" }),
        event({ id: "unset" }),
      ],
      [],
    );
    expect(counts.get("2026-10-01")).toBe(2);
    expect(isExternallyHandledTransport({ transport_provider: "the_wild_tour" })).toBe(true);
    expect(isExternallyHandledTransport({ transport_provider: "sector_pro" })).toBe(false);
    expect(isExternallyHandledTransport({ transport_provider: null })).toBe(false);
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

  it("defaults to the whole transport when it has an end", () => {
    expect(defaultAssignmentWindow(event({ event_time: "08:00:00", end_date: "2026-10-04", end_time: "20:00:00" }))).toEqual({
      start: "2026-10-01T08:00",
      end: "2026-10-04T20:00",
    });
  });

  it("names the operation and, when known, what the move is for", () => {
    expect(transportOperationLabel("load", "pickup")).toBe("Carga · Recogida");
    expect(transportOperationLabel("unload", "return")).toBe("Descarga · Devolución");
    expect(transportOperationLabel("crew_transfer", null)).toBe("Traslado de personal");
    expect(transportOperationLabel("load", "bogus")).toBe("Carga");
  });

  it("describes a transport's span from its local wall-clock values", () => {
    expect(formatTransportSpan(event({ event_time: "08:00:00" }))).toBe("08:00");
    expect(formatTransportSpan(event({ event_time: "08:00:00", end_date: "2026-10-01", end_time: "13:30:00" }))).toBe("08:00–13:30");
    expect(formatTransportSpan(event({ event_time: "08:00:00", end_date: "2026-10-04", end_time: "20:00:00" })))
      .toBe("01/10 08:00 → 04/10 20:00");
  });

  it("warns when a van cannot seat a crew transfer", () => {
    const van = { vehicle_type: "furgoneta" as const, passenger_seats: 8 };
    const transfer = event({ event_type: "crew_transfer", passenger_count: 9 });
    expect(isCrewTransfer(transfer)).toBe(true);
    expect(seatShortfall(van, transfer)).toEqual({ needed: 9, available: 8 });
    expect(seatShortfall(van, event({ event_type: "crew_transfer", passenger_count: 8 }))).toBeNull();
    // Without a count, the job crew is who travels.
    expect(seatShortfall(van, event({ event_type: "crew_transfer", job_crew_count: 12 }))).toEqual({ needed: 12, available: 8 });
    // Loads, unknown seats and sleeper buses (checked on berths) are not second-guessed.
    expect(seatShortfall(van, event({ event_type: "load", passenger_count: 20 }))).toBeNull();
    expect(seatShortfall({ vehicle_type: "furgoneta", passenger_seats: null }, transfer)).toBeNull();
    expect(seatShortfall({ vehicle_type: "sleeper_bus", passenger_seats: 2 }, transfer)).toBeNull();
  });

  it("counts assignments still awaiting the driver's answer in the next 48 hours", () => {
    const now = "2026-10-01T06:00:00.000Z";
    const soon = assignment({ id: "soon", starts_at: "2026-10-02T06:00:00.000Z", ends_at: "2026-10-02T08:00:00.000Z" });
    const later = assignment({ id: "later", starts_at: "2026-10-04T06:00:00.000Z", ends_at: "2026-10-04T08:00:00.000Z" });
    const confirmed = assignment({ id: "ok", status: "confirmed" });
    const finished = assignment({ id: "done", starts_at: "2026-09-30T06:00:00.000Z", ends_at: "2026-09-30T08:00:00.000Z" });
    const vehicleOnly = assignment({ id: "van", driver_id: null, vehicle_id: "v1" });
    expect(countPendingConfirmations([soon, later, confirmed, finished, vehicleOnly], now)).toBe(1);
    expect(countPendingConfirmations([soon, later], now, 24 * 7)).toBe(2);
  });

  it("indexes a driver's days off by day and summarises who drives each transport", () => {
    const ana = driver({ unavailable_days: [{ date: "2026-10-03", status: "sick" }] });
    expect(unavailabilityByDay(ana).get("2026-10-03")).toBe("sick");
    expect(unavailabilityByDay(null).size).toBe(0);

    const summaries = summarizeDriversByEvent({
      drivers: [ana],
      vehicles: [{
        id: "v1", name: "Tráiler 1", license_plate: "1234 ABC", vehicle_type: "trailer", required_license: "C+E",
        brand: null, model: null, payload_kg: null, cargo_length_m: null, has_tail_lift: false,
        itv_expiry: null, insurance_expiry: null, notes: null, is_active: true, berth_layouts: [], passenger_seats: null,
      }],
      assignments: [
        assignment({ id: "a1", logistics_event_id: "e1", vehicle_id: "v1", status: "confirmed" }),
        assignment({ id: "a2", logistics_event_id: "e1", driver_id: "ghost", status: "declined" }),
        assignment({ id: "a3", logistics_event_id: "e2", driver_id: null, vehicle_id: "v1" }),
      ],
    });
    expect(summaries.get("e1")).toEqual([{ assignmentId: "a1", label: "Ana Conductora · Tráiler 1", status: "confirmed" }]);
    expect(summaries.get("e2")).toEqual([{ assignmentId: "a3", label: "Tráiler 1", status: "assigned" }]);
  });

  it("names drivers by first name or nickname", () => {
    expect(driverDisplayName({ first_name: "Ana", last_name: "Ruiz", nickname: null })).toBe("Ana Ruiz");
    expect(driverDisplayName({ first_name: " ", last_name: null, nickname: "Pepe" })).toBe("Pepe");
    expect(driverDisplayName({ first_name: null, last_name: null, nickname: null })).toBe("Sin nombre");
  });
});

describe("sleeper-bus berths", () => {
  it("parses the berth layouts typed in the vehicle form", () => {
    expect(parseBerthLayouts("16")).toEqual({ layouts: [16] });
    expect(parseBerthLayouts(" 16, 12 / 14 12 ")).toEqual({ layouts: [12, 14, 16] });
    expect(parseBerthLayouts("")).toEqual({ layouts: [] });
    expect(parseBerthLayouts("12, doce")).toEqual({ error: '"doce" no es un número de literas válido (1–40)' });
    expect(parseBerthLayouts("0")).toHaveProperty("error");
    expect(parseBerthLayouts("41")).toHaveProperty("error");
    expect(parseBerthLayouts("1 2 3 4 5 6 7")).toEqual({ error: "Como máximo 6 configuraciones de literas" });
  });

  it("formats layouts and finds the largest", () => {
    expect(formatBerthLayouts([16, 12])).toBe("12 / 16 literas");
    expect(formatBerthLayouts([])).toBeNull();
    expect(maxBerths({ berth_layouts: [12, 16, 14] })).toBe(16);
    expect(maxBerths({ berth_layouts: [] })).toBe(0);
  });
});
