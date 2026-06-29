import { describe, expect, it } from "vitest";

import { shouldHideJobForTourState } from "@/utils/cancelledTourJobs";

const nowMs = Date.parse("2026-06-29T12:00:00.000Z");

describe("cancelled tour job visibility", () => {
  it("keeps completed jobs visible when the parent tour is cancelled", () => {
    expect(
      shouldHideJobForTourState(
        { status: "Completado", start_time: "2026-07-01T12:00:00.000Z" },
        { status: "cancelled", deleted: false },
        nowMs,
      ),
    ).toBe(false);
  });

  it("keeps already-started non-cancelled jobs visible when the parent tour is cancelled", () => {
    expect(
      shouldHideJobForTourState(
        { status: "Confirmado", start_time: "2026-06-28T12:00:00.000Z" },
        { status: "cancelled", deleted: false },
        nowMs,
      ),
    ).toBe(false);
  });

  it("hides future non-completed jobs when the parent tour is cancelled", () => {
    expect(
      shouldHideJobForTourState(
        { status: "Confirmado", start_time: "2026-06-30T12:00:00.000Z" },
        { status: "cancelled", deleted: false },
        nowMs,
      ),
    ).toBe(true);
  });

  it("always hides explicitly cancelled jobs", () => {
    expect(
      shouldHideJobForTourState(
        { status: "Cancelado", start_time: "2026-06-28T12:00:00.000Z" },
        { status: "cancelled", deleted: false },
        nowMs,
      ),
    ).toBe(true);
  });
});
