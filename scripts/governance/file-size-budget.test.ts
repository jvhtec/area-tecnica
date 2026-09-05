import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, expect, it } from "vitest";

const roots: string[] = [];
const script = resolve("scripts/governance/check-file-size-budget.mjs");
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(lines: number, ceiling?: number) {
  const root = mkdtempSync(join(tmpdir(), "area-size-test-")); roots.push(root);
  mkdirSync(join(root, "supabase/functions/example"), { recursive: true });
  mkdirSync(join(root, "scripts/governance"), { recursive: true });
  writeFileSync(join(root, "supabase/functions/example/index.ts"), "// fixture\n".repeat(lines));
  writeFileSync(join(root, "scripts/governance/function-file-size-baseline.json"), JSON.stringify({ files: ceiling ? { "supabase/functions/example/index.ts": ceiling } : {} }));
  return spawnSync(process.execPath, [script, "--functions"], { cwd: root, encoding: "utf8", env: { ...process.env, GITHUB_STEP_SUMMARY: "" } });
}
it("rejects a newly oversized Edge Function", () => { expect(fixture(801).status).toBe(1); });
it("rejects growth in a baselined Edge Function", () => { expect(fixture(901, 900).status).toBe(1); });
it("allows a shrinking legacy function", () => { expect(fixture(850, 900).status).toBe(0); });
it("reports approaching-threshold functions without failing", () => {
  const result = fixture(780);
  expect(result.status).toBe(0); expect(result.stdout).toContain("Approaching threshold");
});
it("forwards baseline-write arguments to both independent checks", () => {
  fixture(801);
  const root = roots.at(-1)!;
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src/new.ts"), "// fixture\n".repeat(801));
  const result = spawnSync(process.execPath, [resolve("scripts/governance/check-file-size-budgets.mjs"), "--write-baseline"], { cwd: root, encoding: "utf8", env: { ...process.env, GITHUB_STEP_SUMMARY: "" } });
  expect(result.status).toBe(0);
  expect(JSON.parse(readFileSync(join(root, "scripts/governance/file-size-baseline.json"), "utf8")).files["src/new.ts"]).toBe(801);
  expect(JSON.parse(readFileSync(join(root, "scripts/governance/function-file-size-baseline.json"), "utf8")).files["supabase/functions/example/index.ts"]).toBe(801);
});
