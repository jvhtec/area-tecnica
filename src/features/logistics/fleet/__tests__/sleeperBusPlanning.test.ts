import { describe, expect, it } from "vitest";

import type { DriverAssignment, FleetVehicle, MatrixTransportEvent } from "../fleetModel";
import {
  berthShortfall,
  berthsNeeded,
  bestLayoutFor,
  plannedBusLabel,
  sleeperBusDayContext,
  suggestSleeperBusPlans,
  type SleeperBusCandidate,
  type SleeperBusPlan,
} from "../sleeperBusPlanning";

const bus = (id: string, layouts: number[], available = true): SleeperBusCandidate => ({
  id,
  name: `Bus ${id}`,
  layouts,
  available,
});

const describePlan = (plan: SleeperBusPlan) => plan.buses.map(plannedBusLabel).join(" + ");

const fleet = [bus("A", [12, 14, 16]), bus("B", [12]), bus("C", [16])];

describe("suggestSleeperBusPlans", () => {
  it("suggests nothing without anyone to seat", () => {
    expect(suggestSleeperBusPlans(0, fleet)).toEqual([]);
  });

  it("prefers one of our own buses set up in the tightest layout", () => {
    const plans = suggestSleeperBusPlans(14, fleet);
    expect(plans.map(describePlan)).toEqual(["Bus A (14)", "Bus C (16)", "Alquiler 14 literas"]);
    expect(plans[0]).toMatchObject({ berths: 14, spare: 0, hired: 0 });
  });

  it("combines buses for a crew no single bus can seat, hiring only what is missing", () => {
    const plans = suggestSleeperBusPlans(30, fleet);
    expect(plans.map(describePlan)).toEqual([
      "Bus A (14) + Bus C (16)",
      "Bus A (16) + Alquiler 14 literas",
      "Bus B (12) + Alquiler 18 literas",
    ]);
  });

  it("leaves out buses already busy that day or without berths configured", () => {
    const plans = suggestSleeperBusPlans(10, [bus("A", [16], false), bus("D", [])]);
    expect(plans.map(describePlan)).toEqual(["Alquiler 12 literas"]);
    expect(plans[0]).toMatchObject({ spare: 2, hired: 1 });
  });

  it("hires as many buses as a large crew needs, with the tightest size mix", () => {
    const [plan] = suggestSleeperBusPlans(40, []);
    expect(plan.buses.map((planned) => planned.berths)).toEqual([20, 20]);
    expect(plan.spare).toBe(0);
    expect(suggestSleeperBusPlans(33, [])[0].buses.map((planned) => planned.berths)).toEqual([20, 14]);
  });

  it("sets a reconfigurable bus up to pair with the hire that fits exactly", () => {
    // 30 people, one bus as 12 or 20 berths: 12 + an 18-berth hire leaves nobody's bed empty,
    // where 20 + a 12-berth hire would leave two.
    const [best] = suggestSleeperBusPlans(30, [bus("R", [12, 20])]);
    expect(describePlan(best)).toBe("Bus R (12) + Alquiler 18 literas");
    expect(best.spare).toBe(0);
  });

  it("seats a 20-bed crew in one of our own double-deckers", () => {
    const plans = suggestSleeperBusPlans(19, [bus("DD", [18, 20]), bus("B", [12])]);
    expect(plans.map(describePlan)).toEqual(["Bus DD (20)", "Alquiler 20 literas", "Bus B (12) + Alquiler 12 literas"]);
  });
});

describe("bestLayoutFor", () => {
  it("picks the smallest layout that seats everyone, else the largest", () => {
    expect(bestLayoutFor([12, 14, 16], 13)).toBe(14);
    expect(bestLayoutFor([16, 12], 20)).toBe(16);
    expect(bestLayoutFor([], 5)).toBeNull();
  });
});

const vehicle = (overrides: Partial<FleetVehicle>): FleetVehicle => ({
  id: "v",
  name: "Vehículo",
  license_plate: "0000 AAA",
  vehicle_type: "sleeper_bus",
  required_license: "D",
  brand: null,
  model: null,
  payload_kg: null,
  cargo_length_m: null,
  has_tail_lift: false,
  itv_expiry: null,
  insurance_expiry: null,
  notes: null,
  is_active: true,
  berth_layouts: [16],
  passenger_seats: null,
  ...overrides,
});

const event = (overrides: Partial<MatrixTransportEvent>): MatrixTransportEvent => ({
  id: "e",
  event_type: "load",
  transport_type: "sleeper_bus",
  event_date: "2026-10-01",
  event_time: "23:00:00",
  end_date: null,
  end_time: null,
  timezone: "Europe/Madrid",
  title: null,
  color: null,
  job_id: "job-1",
  job_title: "Gira",
  license_plate: null,
  transport_provider: null,
  berth_count: null,
  job_crew_count: 20,
  passenger_count: null,
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

const assignment = (overrides: Partial<DriverAssignment>): DriverAssignment => ({
  id: "a",
  logistics_event_id: "e",
  driver_id: null,
  vehicle_id: null,
  starts_at: "2026-10-01T21:00:00Z",
  ends_at: "2026-10-02T06:00:00Z",
  status: "assigned",
  notes: null,
  responded_at: null,
  decline_reason: null,
  ...overrides,
});

describe("sleeperBusDayContext", () => {
  const data = {
    vehicles: [
      vehicle({ id: "bus-1", name: "Bus 1", berth_layouts: [12, 16] }),
      vehicle({ id: "bus-2", name: "Bus 2" }),
      vehicle({ id: "bus-3", name: "Bus 3", is_active: false }),
      vehicle({ id: "truck", vehicle_type: "trailer", berth_layouts: [] }),
    ],
    events: [
      event({ id: "this" }),
      event({ id: "other-bus", berth_count: 16 }),
      event({ id: "other-bus-unsized" }),
      event({ id: "other-direction", event_type: "unload", berth_count: 14 }),
      event({ id: "other-job", job_id: "job-2", berth_count: 12 }),
    ],
    assignments: [
      assignment({ id: "a1", logistics_event_id: "other-job", vehicle_id: "bus-2" }),
      assignment({ id: "a2", logistics_event_id: "this", vehicle_id: "bus-1" }),
      assignment({ id: "a3", logistics_event_id: "other-bus", vehicle_id: "bus-1", status: "declined" }),
    ],
  };

  it("marks buses busy on other runs and totals the job's other bus berths", () => {
    const context = sleeperBusDayContext(data, {
      jobId: "job-1",
      dateKey: "2026-10-01",
      eventType: "load",
      excludeEventId: "this",
    });
    expect(context.candidates).toEqual([
      { id: "bus-1", name: "Bus 1", layouts: [12, 16], available: true },
      { id: "bus-2", name: "Bus 2", layouts: [16], available: false },
    ]);
    expect(context).toMatchObject({ otherBerths: 16, otherRuns: 2, otherRunsWithoutBerths: 1 });
  });

  it("has nothing planned for a run without a job", () => {
    const context = sleeperBusDayContext(data, { jobId: null, dateKey: "2026-10-01", eventType: "load" });
    expect(context).toMatchObject({ otherBerths: 0, otherRuns: 0 });
  });
});

describe("berth fit", () => {
  it("needs the run's own berths, else the whole crew, and only on sleeper buses", () => {
    expect(berthsNeeded(event({ berth_count: 14, job_crew_count: 20 }))).toBe(14);
    expect(berthsNeeded(event({ berth_count: null, job_crew_count: 20 }))).toBe(20);
    expect(berthsNeeded(event({ transport_type: "trailer", job_crew_count: 20 }))).toBeNull();
    // A crew transfer carries its passengers, not necessarily the whole crew.
    expect(berthsNeeded(event({ berth_count: null, passenger_count: 9, job_crew_count: 20 }))).toBe(9);
  });

  it("flags a bus too small even in its largest layout", () => {
    expect(berthShortfall(vehicle({ berth_layouts: [12, 16] }), event({ job_crew_count: 18 })))
      .toEqual({ needed: 18, available: 16 });
    expect(berthShortfall(vehicle({ berth_layouts: [12, 16] }), event({ job_crew_count: 16 }))).toBeNull();
    expect(berthShortfall(vehicle({ berth_layouts: [] }), event({ job_crew_count: 18 }))).toBeNull();
    expect(berthShortfall(null, event({ job_crew_count: 18 }))).toBeNull();
  });
});
