import { expect, it } from "vitest";
import { checkPolicies, suspiciousPredicate } from "./check-policy-predicates.mjs";
it("detects unconditional clauses and qualified self comparisons", () => {
  for (const sql of ["true", "(true OR auth.uid() IS NOT NULL)", "(is_admin() OR (true))", "ja.job_id = ja.job_id", '"ja"."job_id" = "ja"."job_id"']) expect(suspiciousPredicate(sql)).toBe(true);
});
it("does not confuse boolean data comparisons or literals with unconditional policies", () => {
  for (const sql of ["(is_global = true) OR tour_id IS NULL", "ja.job_id = festival_artists.job_id", "notes = 'true OR true'", "auth.uid() = user_id"]) expect(suspiciousPredicate(sql)).toBe(false);
});
it("requires an exact reviewed body and role/command scope", () => {
  const policy = { kind: "policy", identity: "public.jobs.select", value: { using: "true", check: null, roles: ["authenticated"], command: "SELECT", permissive: "PERMISSIVE" } };
  const catalog = { format_version: 1, objects: [policy] };
  const baseline = { policies: { [policy.identity]: { rationale: "Current calendar contract", value: structuredClone(policy.value) } } };
  expect(checkPolicies(catalog, baseline)).toEqual([]);
  policy.value.roles = ["public"];
  expect(checkPolicies(catalog, baseline)).toEqual([policy.identity]);
  expect(() => checkPolicies({ objects: [] }, baseline)).toThrow();
});
