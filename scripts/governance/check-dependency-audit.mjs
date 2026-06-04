#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

const repoRoot = process.cwd();
const baselinePath = join(
  repoRoot,
  "scripts",
  "governance",
  "dependency-audit-baseline.json",
);
const shouldWriteBaseline = process.argv.includes("--write-baseline");
const severities = ["info", "low", "moderate", "high", "critical"];

function toPosix(path) {
  return path.split("\\").join("/");
}

function runAudit() {
  const result = spawnSync("npm", ["audit", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  const output = result.stdout || result.stderr;

  if (!output) {
    throw new Error("npm audit did not produce JSON output.");
  }

  try {
    return JSON.parse(output);
  } catch (error) {
    console.error(output);
    throw new Error(`Failed to parse npm audit JSON: ${error.message}`);
  }
}

function advisoryIdsFromVia(via) {
  if (!Array.isArray(via)) {
    return [];
  }

  return via.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || typeof entry.source === "undefined") {
      return [];
    }

    return [String(entry.source)];
  });
}

function collectAuditSnapshot(report) {
  const vulnerabilities = report.vulnerabilities ?? {};
  const advisories = Object.values(vulnerabilities)
    .flatMap((entry) => advisoryIdsFromVia(entry.via))
    .sort((a, b) => a.localeCompare(b));
  const uniqueAdvisories = Array.from(new Set(advisories));
  const counts = report.metadata?.vulnerabilities ?? {};

  return {
    advisoryIds: uniqueAdvisories,
    vulnerabilityCounts: Object.fromEntries(
      severities.map((severity) => [severity, Number(counts[severity] ?? 0)]),
    ),
    total: Number(counts.total ?? 0),
  };
}

function buildBaseline(snapshot) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    note: "Current npm audit advisories are grandfathered. CI fails on new advisory IDs or increased severity counts.",
    advisoryIds: snapshot.advisoryIds,
    vulnerabilityCounts: snapshot.vulnerabilityCounts,
    total: snapshot.total,
  };
}

function readBaseline() {
  if (!existsSync(baselinePath)) {
    throw new Error(
      `Missing dependency audit baseline at ${toPosix(relative(repoRoot, baselinePath))}. Run npm run audit:deps -- --write-baseline.`,
    );
  }

  return JSON.parse(readFileSync(baselinePath, "utf8"));
}

function compareToBaseline(snapshot, baseline) {
  const allowedAdvisoryIds = new Set(baseline.advisoryIds ?? []);
  const newAdvisoryIds = snapshot.advisoryIds.filter((id) => !allowedAdvisoryIds.has(id));
  const increasedSeverityCounts = severities.flatMap((severity) => {
    const current = Number(snapshot.vulnerabilityCounts[severity] ?? 0);
    const allowed = Number(baseline.vulnerabilityCounts?.[severity] ?? 0);

    if (current <= allowed) {
      return [];
    }

    return [{
      severity,
      current,
      allowed,
    }];
  });

  return {
    newAdvisoryIds,
    increasedSeverityCounts,
  };
}

function writeSummary(snapshot, failures = { newAdvisoryIds: [], increasedSeverityCounts: [] }) {
  const lines = [
    "## Dependency Audit",
    "",
    "| Severity | Current |",
    "| --- | ---: |",
    ...severities.map((severity) => `| ${severity} | ${snapshot.vulnerabilityCounts[severity] ?? 0} |`),
    `| total | ${snapshot.total} |`,
    "",
    `Known advisory IDs: ${snapshot.advisoryIds.length}`,
  ];

  if (failures.newAdvisoryIds.length > 0) {
    lines.push("", "### New Advisory IDs", "");
    for (const id of failures.newAdvisoryIds) {
      lines.push(`- ${id}`);
    }
  }

  if (failures.increasedSeverityCounts.length > 0) {
    lines.push("", "### Increased Severity Counts", "");
    for (const entry of failures.increasedSeverityCounts) {
      lines.push(`- ${entry.severity}: ${entry.current} current, ${entry.allowed} allowed`);
    }
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" });
  }

  console.log(lines.join("\n"));
}

const snapshot = collectAuditSnapshot(runAudit());

if (shouldWriteBaseline) {
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(buildBaseline(snapshot), null, 2)}\n`);
  console.log(`Wrote ${toPosix(relative(repoRoot, baselinePath))}`);
  writeSummary(snapshot);
  process.exit(0);
}

const failures = compareToBaseline(snapshot, readBaseline());
writeSummary(snapshot, failures);

if (failures.newAdvisoryIds.length > 0 || failures.increasedSeverityCounts.length > 0) {
  console.error("Dependency audit found new or increased security debt.");
  process.exit(1);
}
