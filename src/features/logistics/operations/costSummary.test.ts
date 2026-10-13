import { expect, it } from "vitest";
import { costSummary } from "./costSummary";
import type { Operation } from "./operationsModel";
it("shares rounded totals and distinguishes zero from missing costs", () => {
  const summary = costSummary([{ transport_cost: 0.1, hotel_cost: 0.2, other_cost: 0 } as Operation, { transport_cost: 10, hotel_cost: null, other_cost: 0 } as Operation]);
  expect(summary.total).toBe(10.3);
  expect(summary.concepts.map((concept) => concept.amount)).toEqual([10.1, 0.2, 0]);
  expect(summary.concepts.map((concept) => concept.pending)).toEqual([false, true, false]);
  expect(costSummary([undefined]).concepts.every((concept) => concept.pending)).toBe(true);
});
