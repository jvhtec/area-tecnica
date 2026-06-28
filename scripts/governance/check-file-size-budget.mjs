#!/usr/bin/env node

/**
 * File-size budget guard (ratchet).
 *
 * Large "god files" are the dominant maintainability debt in this codebase
 * (see docs/CODE_QUALITY_AUDIT_2026-06-27.md). This check does not try to shrink
 * them in one pass; it freezes the current state so the debt cannot grow:
 *
 *   1. No NEW source file may cross THRESHOLD lines unless it is in the baseline.
 *   2. A baselined file may shrink freely, but may not exceed its recorded size.
 *
 * Regenerate the baseline after an intentional, reviewed change:
 *   npm run governance:filesize -- --write-baseline
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative } from "node:path";

const repoRoot = process.cwd();
const baselinePath = join(repoRoot, "scripts", "governance", "file-size-baseline.json");
const shouldWriteBaseline = process.argv.includes("--write-baseline");
const sourceRoot = join(repoRoot, "src");

const THRESHOLD = 800;

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

// Generated or otherwise non-authored files we cannot reasonably split.
const excludeMatchers = [
  /^src\/integrations\/supabase\/types\.ts$/,
];

function toPosix(path) {
  return path.split("\\").join("/");
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function isSourceFile(path) {
  return sourceExtensions.has(extname(path));
}

function isTestFile(path) {
  return /(?:^|\/)__tests__\//.test(path) || /\.(?:test|spec)\.[jt]sx?$/.test(path);
}

function isExcluded(path) {
  return excludeMatchers.some((matcher) => matcher.test(path));
}

function countLines(absolute) {
  const content = readFileSync(absolute, "utf8");
  if (content === "") return 0;
  const withoutTrailingNewline = content.endsWith("\n") ? content.slice(0, -1) : content;
  return withoutTrailingNewline.split("\n").length;
}

function collectOversized() {
  return walk(sourceRoot)
    .map((file) => ({ absolute: file, path: toPosix(relative(repoRoot, file)) }))
    .filter((file) => isSourceFile(file.path) && !isTestFile(file.path) && !isExcluded(file.path))
    .map((file) => ({ path: file.path, lines: countLines(file.absolute) }))
    .filter((file) => file.lines > THRESHOLD)
    .sort((a, b) => b.lines - a.lines);
}

function buildBaseline(files) {
  return {
    version: 1,
    threshold: THRESHOLD,
    generatedAt: new Date().toISOString(),
    note:
      "Line-count ceilings for files over the threshold. CI fails when a file exceeds its ceiling or a new file crosses the threshold. Regenerate with: npm run governance:filesize -- --write-baseline",
    files: Object.fromEntries(files.map((file) => [file.path, file.lines])),
  };
}

function readBaseline() {
  if (!existsSync(baselinePath)) {
    throw new Error(
      `Missing file-size baseline at ${toPosix(relative(repoRoot, baselinePath))}. Run npm run governance:filesize -- --write-baseline.`,
    );
  }
  return JSON.parse(readFileSync(baselinePath, "utf8"));
}

function compareToBaseline(files, baseline) {
  const ceilings = baseline.files ?? {};
  const failures = [];

  for (const file of files) {
    const ceiling = ceilings[file.path];
    if (ceiling === undefined) {
      failures.push({
        path: file.path,
        lines: file.lines,
        kind: "new",
        message: `new file over ${THRESHOLD} lines (${file.lines})`,
      });
    } else if (file.lines > ceiling) {
      failures.push({
        path: file.path,
        lines: file.lines,
        kind: "grew",
        message: `grew from ${ceiling} to ${file.lines} lines`,
      });
    }
  }

  return failures;
}

function writeSummary(files, failures = []) {
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;
  const baselineCount = baseline ? Object.keys(baseline.files ?? {}).length : 0;

  const lines = [
    "## File Size Budget",
    "",
    `Threshold: ${THRESHOLD} lines. Files over threshold: ${files.length} (baseline: ${baselineCount}).`,
  ];

  if (failures.length > 0) {
    lines.push("", "### Budget Violations", "");
    for (const failure of failures.slice(0, 25)) {
      lines.push(`- \`${failure.path}\`: ${failure.message}`);
    }
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" });
  }

  console.log(lines.join("\n"));
}

const files = collectOversized();

if (shouldWriteBaseline) {
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(buildBaseline(files), null, 2)}\n`);
  console.log(`Wrote ${toPosix(relative(repoRoot, baselinePath))}`);
  writeSummary(files);
  process.exit(0);
}

const baseline = readBaseline();
const failures = compareToBaseline(files, baseline);
writeSummary(files, failures);

if (failures.length > 0) {
  console.error(`File size budget found ${failures.length} violation(s).`);
  process.exit(1);
}
