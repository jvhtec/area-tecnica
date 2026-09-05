import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { compareWarningBudgets } from "./lint-warning-policy.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const baselinePath = join(repoRoot, "scripts", "governance", "lint-warning-baseline.json");
const shouldWriteBaseline = process.argv.includes("--write-baseline");
const eslint = new ESLint({ cwd: repoRoot });
const results = await eslint.lintFiles(["src", "tests", "vite.config.ts", "supabase/functions"]);

const counts = {};
const files = {};
const domains = { app: { total: 0, rules: {} }, functions: { total: 0, rules: {} } };
const errors = results.reduce((sum, result) => sum + result.errorCount, 0);
if (errors) {
  console.error(`Lint has ${errors} error(s); refusing to accept or regenerate a warning baseline.`);
  process.exit(1);
}
for (const result of results) {
  const repoPath = relative(repoRoot, result.filePath).replaceAll("\\", "/");
  const domain = domains[repoPath.startsWith("supabase/functions/") ? "functions" : "app"];
  for (const message of result.messages) {
    if (message.severity !== 1) continue;
    const rule = message.ruleId ?? "unknown";
    domain.total += 1;
    domain.rules[rule] = (domain.rules[rule] ?? 0) + 1;
    counts[rule] = (counts[rule] ?? 0) + 1;
    files[repoPath] ??= {};
    files[repoPath][rule] = (files[repoPath][rule] ?? 0) + 1;
  }
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  note: "Lint warning ceilings by rule and file. New warnings fail governance; reductions are always allowed.",
  total: Object.values(counts).reduce((sum, count) => sum + count, 0),
  domains,
  rules: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
  files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
};

if (shouldWriteBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${relative(repoRoot, baselinePath)} with ${snapshot.total} warnings.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const failures = compareWarningBudgets(snapshot, baseline);

console.log("## Lint Warning Baseline\n");
console.log(`Current warnings: ${snapshot.total}; baseline: ${baseline.total}.`);
for (const [domain, counts] of Object.entries(domains)) console.log(`${domain}: ${counts.total}; baseline: ${baseline.domains?.[domain]?.total ?? "missing"}.`);

if (failures.length > 0) {
  console.error("\nNew lint warnings:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

