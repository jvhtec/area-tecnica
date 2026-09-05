import { describe, expect, it } from "vitest";
import { compareWarningBudgets } from "./lint-warning-policy.mjs";

const snapshot = () => ({ total: 2, rules: { any: 2 }, domains: { app: { total: 1, rules: { any: 1 } }, functions: { total: 1, rules: { any: 1 } } }, files: { "src/a.ts": { any: 1 }, "supabase/functions/a.ts": { any: 1 } } });
describe("warning budget policy", () => {
  it("accepts equality and reductions", () => {
    expect(compareWarningBudgets(snapshot(), snapshot())).toEqual([]);
    expect(compareWarningBudgets({ total: 0, rules: {}, domains: { app: { total: 0, rules: {} }, functions: { total: 0, rules: {} } }, files: {} }, snapshot())).toEqual([]);
  });
  it("rejects aggregate growth even when every file ceiling permits it", () => {
    const baseline = snapshot(); baseline.total = 1;
    expect(compareWarningBudgets(snapshot(), baseline)).toContain("total: 2 current > 1 allowed");
    baseline.total = 2; baseline.rules.any = 1;
    expect(compareWarningBudgets(snapshot(), baseline)).toContain("rule any: 2 current > 1 allowed");
  });
  it("does not let app reductions mask function debt", () => {
    const baseline = snapshot(); baseline.domains.functions.total = 0;
    expect(compareWarningBudgets(snapshot(), baseline)).toContain("domain functions: 1 current > 0 allowed");
    baseline.domains.functions.total = 1; baseline.domains.functions.rules.any = 0;
    expect(compareWarningBudgets(snapshot(), baseline)).toContain("functions/any: 1 current > 0 allowed");
  });
  it("fails closed for a missing domain baseline and new file", () => {
    const baseline = snapshot(); delete baseline.domains.functions; delete baseline.files["src/a.ts"];
    expect(compareWarningBudgets(snapshot(), baseline).length).toBeGreaterThanOrEqual(2);
  });
});
