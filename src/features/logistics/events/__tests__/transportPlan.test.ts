import { describe, expect, it } from "vitest";

import { buildReturnTrip, validateTransportPlan, type TransportPlanInput } from "../transportPlan";

const plan = (overrides: Partial<TransportPlanInput> = {}): TransportPlanInput => ({
  eventType: "crew_transfer",
  transportType: "furgoneta",
  date: "2026-10-01",
  time: "08:00",
  endDate: "",
  endTime: "",
  hasJob: true,
  originInput: "Nave",
  destinationInput: "",
  passengerCount: 6,
  createReturn: false,
  returnDate: "",
  returnTime: "",
  ...overrides,
});

describe("validateTransportPlan", () => {
  it("accepts a complete crew transfer and a plain load", () => {
    expect(validateTransportPlan(plan())).toBeNull();
    expect(validateTransportPlan(plan({ eventType: "load", transportType: "trailer", originInput: "", passengerCount: null }))).toBeNull();
  });

  it("checks the end of any transport", () => {
    expect(validateTransportPlan(plan({ eventType: "load", endDate: "2026-10-02" }))).toMatch(/fecha y hora de fin/);
    expect(validateTransportPlan(plan({ endDate: "2026-10-01", endTime: "07:59" }))).toMatch(/posterior a la salida/);
    expect(validateTransportPlan(plan({ endDate: "2026-10-22", endTime: "08:00" }))).toBeNull();
    expect(validateTransportPlan(plan({ endDate: "2026-10-23", endTime: "08:00" }))).toMatch(/21 días/);
  });

  it("only allows people-carrying vehicle types for crew transfers", () => {
    expect(validateTransportPlan(plan({ transportType: "trailer" }))).toMatch(/solo pueden usar/);
    expect(validateTransportPlan(plan({ transportType: "rv" }))).toBeNull();
    expect(validateTransportPlan(plan({ transportType: "sleeper_bus" }))).toBeNull();
  });

  it("needs a pick-up point, a destination without a job, and passengers", () => {
    expect(validateTransportPlan(plan({ originInput: " " }))).toMatch(/punto de encuentro/);
    expect(validateTransportPlan(plan({ hasJob: false }))).toMatch(/destino/);
    expect(validateTransportPlan(plan({ hasJob: false, destinationInput: "Hotel" }))).toBeNull();
    expect(validateTransportPlan(plan({ passengerCount: null }))).toMatch(/cuántas personas/);
  });

  it("makes the return leave after the outbound trip ends", () => {
    const withReturn = { createReturn: true, endDate: "2026-10-03", endTime: "20:00" };
    expect(validateTransportPlan(plan({ ...withReturn }))).toMatch(/fecha y hora de la vuelta/);
    expect(validateTransportPlan(plan({ ...withReturn, returnDate: "2026-10-03", returnTime: "19:00" }))).toMatch(/después de la ida/);
    expect(validateTransportPlan(plan({ ...withReturn, returnDate: "2026-10-03", returnTime: "21:00" }))).toBeNull();
  });
});

describe("buildReturnTrip", () => {
  it("swaps origin and destination and keeps everything else", () => {
    const outbound = {
      title: null,
      event_date: "2026-10-01",
      event_time: "08:00",
      end_date: "2026-10-03",
      end_time: "20:00",
      origin_location_id: "nave",
      location_id: null,
      passenger_count: 6,
      transport_type: "furgoneta",
    };
    expect(buildReturnTrip(outbound, {
      destinationId: "venue",
      returnDate: "2026-10-04",
      returnTime: "09:00",
      outboundTitle: "Festival",
    })).toEqual({
      ...outbound,
      title: "Festival · vuelta",
      event_date: "2026-10-04",
      event_time: "09:00",
      end_date: null,
      end_time: null,
      origin_location_id: "venue",
      location_id: "nave",
    });
  });
});
