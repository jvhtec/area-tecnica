#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";

const repoRoot = process.cwd();
const functionsRoot = join(repoRoot, "supabase", "functions");
const baselinePath = join(
  repoRoot,
  "scripts",
  "governance",
  "edge-function-baseline.json",
);
const shouldWriteBaseline = process.argv.includes("--write-baseline");

function toPosix(path) {
  return path.split("\\").join("/");
}

function listFunctionEntrypoints() {
  return readdirSync(functionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => {
      const path = join(functionsRoot, entry.name, "index.ts");
      return {
        name: entry.name,
        path,
        relativePath: toPosix(relative(repoRoot, path)),
        exists: existsSync(path),
      };
    })
    .filter((entry) => entry.exists)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function isCompliant(content) {
  return (
    /\bcreateHttpHandler\b/.test(content) &&
    /(?:\bDeno\.)?\bserve\s*\(\s*createHttpHandler\s*\(/.test(content)
  );
}

function collectManualFunctions() {
  return listFunctionEntrypoints().flatMap((entry) => {
    const content = readFileSync(entry.path, "utf8");

    if (isCompliant(content)) {
      return [];
    }

    return [{
      functionName: entry.name,
      path: entry.relativePath,
    }];
  });
}

function buildBaseline(manualFunctions) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    note: "Existing manual Edge Functions are grandfathered. New functions must use createHttpHandler or add an explicit reviewed exemption.",
    manualFunctions: manualFunctions.map((entry) => ({
      ...entry,
      reason: "Legacy entrypoint present before the Edge Function compliance gate.",
    })),
  };
}

function readBaseline() {
  if (!existsSync(baselinePath)) {
    throw new Error(
      `Missing Edge Function baseline at ${toPosix(relative(repoRoot, baselinePath))}. Run npm run governance:functions -- --write-baseline.`,
    );
  }

  return JSON.parse(readFileSync(baselinePath, "utf8"));
}

function compareToBaseline(currentManualFunctions, baseline) {
  const allowed = new Set((baseline.manualFunctions ?? []).map((entry) => entry.functionName));

  return currentManualFunctions.filter((entry) => !allowed.has(entry.functionName));
}

function writeSummary(currentManualFunctions, failures = []) {
  const totalFunctions = listFunctionEntrypoints().length;
  const compliantCount = totalFunctions - currentManualFunctions.length;
  const lines = [
    "## Edge Function Compliance",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Total entrypoints | ${totalFunctions} |`,
    `| Using \`createHttpHandler\` | ${compliantCount} |`,
    `| Legacy manual entrypoints | ${currentManualFunctions.length} |`,
    `| New unexempted manual entrypoints | ${failures.length} |`,
  ];

  if (failures.length > 0) {
    lines.push("", "### New Manual Functions", "");
    for (const entry of failures) {
      lines.push(`- \`${entry.functionName}\` at \`${entry.path}\``);
    }
  }

  if (currentManualFunctions.length > 0) {
    lines.push("", "### Legacy Manual Entrypoints", "");
    for (const entry of currentManualFunctions.slice(0, 25)) {
      lines.push(`- \`${basename(dirname(entry.path))}\` at \`${entry.path}\``);
    }
    if (currentManualFunctions.length > 25) {
      lines.push(`- ... ${currentManualFunctions.length - 25} more`);
    }
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" });
  }

  console.log(lines.join("\n"));
}

const currentManualFunctions = collectManualFunctions();

if (shouldWriteBaseline) {
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(buildBaseline(currentManualFunctions), null, 2)}\n`);
  console.log(`Wrote ${toPosix(relative(repoRoot, baselinePath))}`);
  writeSummary(currentManualFunctions);
  process.exit(0);
}

const failures = compareToBaseline(currentManualFunctions, readBaseline());
writeSummary(currentManualFunctions, failures);

if (failures.length > 0) {
  console.error(`Edge Function compliance found ${failures.length} new unexempted manual entrypoint(s).`);
  process.exit(1);
}
