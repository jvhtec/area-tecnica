import { describe, expect, it } from "vitest";

import {
  clampPdfConcurrency,
  getTotalPages,
  isNonEmptyBlob,
  runWithConcurrency,
} from "@/utils/pdf/festivalPdfSupport";

describe("festivalPdfSupport", () => {
  it("clamps invalid and excessive concurrency values", () => {
    expect(clampPdfConcurrency()).toBe(4);
    expect(clampPdfConcurrency(0)).toBe(1);
    expect(clampPdfConcurrency(2.9)).toBe(2);
    expect(clampPdfConcurrency(99)).toBe(6);
  });

  it("preserves input ordering while work completes out of order", async () => {
    const result = await runWithConcurrency(
      [30, 5, 15],
      async (delay, index) => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return `item-${index}`;
      },
      3,
    );

    expect(result).toEqual(["item-0", "item-1", "item-2"]);
  });

  it("summarizes page counts and rejects empty blobs", () => {
    expect(getTotalPages([2, 3, 1])).toBe(6);
    expect(isNonEmptyBlob(new Blob(["pdf"]))).toBe(true);
    expect(isNonEmptyBlob(new Blob())).toBe(false);
    expect(isNonEmptyBlob(null)).toBe(false);
  });
});
