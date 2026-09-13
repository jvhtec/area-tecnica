import { describe, expect, it } from "vitest";

import { isScheduleDue } from "./schedulePolicy.ts";

const config = {
  timezone: "Europe/Madrid",
  schedule_time: "08:45:00",
  days_of_week: [1],
};

describe("isScheduleDue", () => {
  it("sends only at the configured local minute", () => {
    expect(isScheduleDue(config, new Date("2026-09-14T06:05:00Z"))).toBe(false);
    expect(isScheduleDue(config, new Date("2026-09-14T06:45:00Z"))).toBe(true);
    expect(isScheduleDue(config, new Date("2026-09-14T06:46:00Z"))).toBe(false);
  });

  it("respects configured weekdays and the completed occurrence", () => {
    expect(isScheduleDue(config, new Date("2026-09-15T06:45:00Z"))).toBe(false);
    expect(isScheduleDue({
      ...config,
      last_sent_at: "2026-09-14T06:45:20Z",
    }, new Date("2026-09-14T06:45:50Z"))).toBe(false);
  });

  it("handles Madrid daylight-saving time", () => {
    expect(isScheduleDue({ ...config, days_of_week: [7] }, new Date("2026-03-29T06:45:00Z")))
      .toBe(true);
  });
});
