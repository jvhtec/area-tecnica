import { describe, expect, it } from "vitest";

import { allSettledWithConcurrency } from "./concurrency";

describe("allSettledWithConcurrency", () => {
  it("bounds active work and preserves input order", async () => {
    let active = 0;
    let peakActive = 0;

    const results = await allSettledWithConcurrency([30, 5, 20, 10], 2, async (delay, index) => {
      active += 1;
      peakActive = Math.max(peakActive, active);
      await new Promise((resolve) => setTimeout(resolve, delay));
      active -= 1;
      if (index === 2) throw new Error("expected failure");
      return index;
    });

    expect(peakActive).toBe(2);
    expect(results).toEqual([
      { status: "fulfilled", value: 0 },
      { status: "fulfilled", value: 1 },
      { status: "rejected", reason: expect.any(Error) },
      { status: "fulfilled", value: 3 },
    ]);
  });
});
