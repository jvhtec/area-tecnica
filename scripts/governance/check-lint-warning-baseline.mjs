import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const baselinePath = join(repoRoot, "scripts", "governance", "lint-warning-baseline.json");
const shouldWriteBaseline = process.argv.includes("--write-baseline");
const eslint = new ESLint({ cwd: repoRoot });
const results = await eslint.lintFiles(["src", "tests", "vite.config.ts", "supabase/functions"]);

const counts = {};
const files = {};
for (const result of results) {
  const repoPath = relative(repoRoot, result.filePath).replaceAll("\\", "/");
  for (const message of result.messages) {
    if (message.severity !== 1) continue;
    const rule = message.ruleId ?? "unknown";
    counts[rule] = (counts[rule] ?? 0) + 1;
    files[repoPath] ??= {};
    files[repoPath][rule] = (files[repoPath][rule] ?? 0) + 1;
  }
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  note: "Lint warning ceilings by rule and file. New warnings fail governance; reductions are always allowed.",
  total: Object.values(counts).reduce((sum, count) => sum + count, 0),
  rules: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
  files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
};

if (shouldWriteBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${relative(repoRoot, baselinePath)} with ${snapshot.total} warnings.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const failures = [];
for (const [file, ruleCounts] of Object.entries(snapshot.files)) {
  for (const [rule, current] of Object.entries(ruleCounts)) {
    const allowed = baseline.files?.[file]?.[rule] ?? 0;
    if (current > allowed) failures.push({ file, rule, current, allowed });
  }
}

console.log("## Lint Warning Baseline\n");
console.log(`Current warnings: ${snapshot.total}; baseline: ${baseline.total}.`);

if (failures.length > 0) {
  console.error("\nNew lint warnings:");
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.rule} ${failure.current} current > ${failure.allowed} allowed`);
  }
  process.exit(1);
}

