import { describe, expect, it } from "vitest";

import type { MyTransportAssignment } from "../fleetModel";
import {
  currentSharingAssignment,
  describeLocationAge,
  distanceMeters,
  isStaleLocation,
  shouldReportPosition,
} from "../tracking";

const now = "2026-09-30T12:00:00.000Z";

const assignment = (overrides: Partial<MyTransportAssignment>): MyTransportAssignment => ({
  id: "a",
  status: "assigned",
  starts_at: "2026-09-30T13:00:00Z",
  ends_at: "2026-09-30T15:00:00Z",
  notes: null,
  responded_at: null,
  decline_reason: null,
  event_id: "e",
  event_type: "load",
  transport_type: "trailer",
  event_date: "2026-09-30",
  event_time: "15:00:00",
  end_date: null,
  end_time: null,
  passenger_count: null,
  movement_type: null,
  timezone: "Europe/Madrid",
  title: null,
  job_id: null,
  job_title: null,
  loading_bay: null,
  event_notes: null,
  origin: null,
  destination: null,
  location_name: null,
  location_address: null,
  location_lat: null,
  location_lng: null,
  pickup_name: null,
  pickup_address: null,
  pickup_lat: null,
  pickup_lng: null,
  vehicle: null,
  ...overrides,
});

describe("position freshness", () => {
  it("marks a position stale after ten minutes and describes its age in Spanish", () => {
    expect(isStaleLocation("2026-09-30T11:55:00Z", now)).toBe(false);
    expect(isStaleLocation("2026-09-30T11:49:00Z", now)).toBe(true);
    expect(describeLocationAge("2026-09-30T11:59:40Z", now)).toBe("ahora mismo");
    expect(describeLocationAge("2026-09-30T11:57:00Z", now)).toBe("hace 3 min");
    expect(describeLocationAge("2026-09-30T09:30:00Z", now)).toBe("hace 2 h");
    expect(describeLocationAge("2026-09-28T09:30:00Z", now)).toBe("hace 2 días");
  });
});

describe("report throttling", () => {
  const madrid = { latitude: 40.4168, longitude: -3.7038 };

  it("measures distance on the ground", () => {
    // Puerta del Sol → Atocha is roughly 1.4 km.
    const atocha = { latitude: 40.4065, longitude: -3.6895 };
    expect(distanceMeters(madrid, atocha)).toBeGreaterThan(1_300);
    expect(distanceMeters(madrid, atocha)).toBeLessThan(1_800);
    expect(distanceMeters(madrid, madrid)).toBe(0);
  });

  it("always sends the first fix, then only after 30 s or 50 m", () => {
    const t0 = Date.parse(now);
    expect(shouldReportPosition(null, madrid, t0)).toBe(true);
    const previous = { ...madrid, reportedAt: t0 };
    expect(shouldReportPosition(previous, madrid, t0 + 10_000)).toBe(false);
    expect(shouldReportPosition(previous, madrid, t0 + 30_000)).toBe(true);
    // ~60 m north.
    expect(shouldReportPosition(previous, { latitude: 40.41734, longitude: -3.7038 }, t0 + 10_000)).toBe(true);
    // ~20 m north.
    expect(shouldReportPosition(previous, { latitude: 40.41698, longitude: -3.7038 }, t0 + 10_000)).toBe(false);
  });
});

describe("sharing window", () => {
  it("only shares for a non-declined transport that is running or starts within two hours", () => {
    const soon = assignment({ id: "soon" });
    const running = assignment({ id: "running", starts_at: "2026-09-30T11:00:00Z", ends_at: "2026-09-30T13:30:00Z" });
    const later = assignment({ id: "later", starts_at: "2026-09-30T14:30:00Z", ends_at: "2026-09-30T16:00:00Z" });
    const declined = assignment({ id: "declined", status: "declined" });
    const finished = assignment({ id: "finished", starts_at: "2026-09-30T09:00:00Z", ends_at: "2026-09-30T11:00:00Z" });

    expect(currentSharingAssignment([later, declined, finished], now)).toBeNull();
    expect(currentSharingAssignment([later, soon, declined], now)?.id).toBe("soon");
    // The one already under way wins over one that merely starts within the lead time.
    expect(currentSharingAssignment([soon, running], now)?.id).toBe("running");
  });
});
