import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const baselinePath = join(root, "scripts/governance/legacy-console-allowlist.json");
const eslint = new ESLint({ cwd: root, overrideConfig: { rules: { "no-console": "error" } } });
const results = await eslint.lintFiles(["supabase/functions/**/*.ts"]);
const files = {};
for (const result of results) {
  const file = relative(root, result.filePath).replaceAll("\\", "/");
  if (/\.(test|spec)\.ts$|\/__tests__\//.test(file) || file.endsWith("/_shared/structuredLogger.ts")) continue;
  const count = result.messages.filter(message => message.ruleId === "no-console").length;
  if (count) files[file] = count;
}
if (process.argv.includes("--write-baseline")) {
  writeFileSync(baselinePath, JSON.stringify({
    rationale: "Legacy console sites are frozen for incremental migration; this is not approval to log PII. Auth and audited mail boundaries have been migrated. New files must use structuredLogger and each legacy file may only shrink.",
    files,
  }, null, 2) + "\n");
  console.log(`Wrote legacy console allowlist: ${Object.keys(files).length} files, ${Object.values(files).reduce((a,b)=>a+b,0)} sites.`);
} else {
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const failures = Object.entries(files).filter(([file, count]) => count > (baseline.files[file] ?? 0));
  console.log(`Legacy console sites: ${Object.values(files).reduce((a,b)=>a+b,0)} in ${Object.keys(files).length} files. New/unlisted sites: ${failures.length}.`);
  for (const [file, count] of failures) console.error(`${file}: ${count} > ${baseline.files[file] ?? 0}`);
  if (failures.length) process.exit(1);
}
