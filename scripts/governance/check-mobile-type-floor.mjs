import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sourceRoot = join(repoRoot, "src");
const baselinePath = join(repoRoot, "scripts", "governance", "mobile-type-floor-baseline.json");
const shouldWriteBaseline = process.argv.includes("--write-baseline");
const tinyTextPattern = /text-\[(?:8|9|10|11)px\]/g;

const sourceFiles = [];
const visit = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(path);
      continue;
    }
    if ([".ts", ".tsx"].includes(extname(entry.name))) sourceFiles.push(path);
  }
};
visit(sourceRoot);

const files = {};
for (const file of sourceFiles) {
  const count = readFileSync(file, "utf8").match(tinyTextPattern)?.length ?? 0;
  if (count === 0) continue;
  files[relative(repoRoot, file).replaceAll("\\", "/")] = count;
}

const sortedFiles = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
const snapshot = {
  generatedAt: new Date().toISOString(),
  note: "Per-file ceilings for sub-12px Tailwind arbitrary text classes. New debt fails governance; reductions are always allowed.",
  total: Object.values(sortedFiles).reduce((sum, count) => sum + count, 0),
  files: sortedFiles,
};

if (shouldWriteBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${relative(repoRoot, baselinePath)} with ${snapshot.total} tiny-text occurrences.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const failures = Object.entries(snapshot.files)
  .map(([file, current]) => ({ file, current, allowed: baseline.files?.[file] ?? 0 }))
  .filter(({ current, allowed }) => current > allowed);

console.log("## Mobile Type Floor\n");
console.log(`Current sub-12px classes: ${snapshot.total}; baseline: ${baseline.total}.`);

if (failures.length > 0) {
  console.error("\nNew sub-12px typography debt:");
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.current} current > ${failure.allowed} allowed`);
  }
  process.exit(1);
}
