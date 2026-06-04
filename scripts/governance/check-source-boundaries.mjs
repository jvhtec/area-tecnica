#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative } from "node:path";

const repoRoot = process.cwd();
const baselinePath = join(
  repoRoot,
  "scripts",
  "governance",
  "source-boundary-baseline.json",
);
const shouldWriteBaseline = process.argv.includes("--write-baseline");
const sourceRoot = join(repoRoot, "src");

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const schedulingPathMatchers = [
  /^src\/components\/schedule\//,
  /^src\/components\/matrix\//,
  /^src\/components\/.*\/scheduling\//,
  /^src\/features\/staffing\//,
  /^src\/pages\/job-assignment-matrix\//,
];

const routeManifestAllowlist = [
  /^src\/routes\/.*manifest.*\.(ts|tsx)$/i,
  /^src\/routes\/.*routes.*\.(ts|tsx)$/i,
];

const rules = [
  {
    id: "pages-supabase-client-import",
    description: "Pages must not import the Supabase browser client directly.",
    appliesTo: (path) => path.startsWith("src/pages/") && !isTestFile(path),
    linePattern: /from\s+["'][^"']*(?:@\/integrations\/supabase\/client|integrations\/supabase\/client)["']/,
  },
  {
    id: "ui-data-layer-client-import",
    description: "Pages and components must not import the legacy dataLayerClient.",
    appliesTo: (path) =>
      (path.startsWith("src/pages/") || path.startsWith("src/components/")) &&
      !isTestFile(path),
    linePattern: /from\s+["'][^"']*(?:@\/services\/dataLayerClient|services\/dataLayerClient)["']/,
  },
  {
    id: "scheduling-new-date",
    description: "Scheduling domains must route new date construction through approved date utilities.",
    appliesTo: (path) =>
      schedulingPathMatchers.some((matcher) => matcher.test(path)) &&
      !isTestFile(path),
    linePattern: /\bnew\s+Date\s*\(/,
  },
  {
    id: "direct-protected-route-allowed-roles",
    description: "Route access policy must not add new inline ProtectedRoute allowedRoles usage outside the route manifest.",
    appliesTo: (path) =>
      !isTestFile(path) &&
      !routeManifestAllowlist.some((matcher) => matcher.test(path)),
    fileExtractor: extractProtectedRouteMatches,
  },
];

function toPosix(path) {
  return path.split("\\").join("/");
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(path);
    }

    return [path];
  });
}

function isSourceFile(path) {
  return sourceExtensions.has(extname(path));
}

function isTestFile(path) {
  return /(?:^|\/)__tests__\//.test(path) || /\.(?:test|spec)\.[jt]sx?$/.test(path);
}

function cleanLine(line) {
  return line.trim().replace(/\s+/g, " ");
}

function fingerprint(match) {
  return `${match.path} :: ${match.snippet}`;
}

function countFingerprints(matches) {
  return matches.reduce((counts, match) => {
    const key = fingerprint(match);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map());
}

function extractLineMatches(path, content, rule) {
  const lines = content.split(/\r?\n/);
  return lines.flatMap((line, index) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("//")) {
      return [];
    }

    if (!rule.linePattern.test(line)) {
      return [];
    }

    return [{
      path,
      line: index + 1,
      snippet: cleanLine(line),
    }];
  });
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function lineAt(content, lineNumber) {
  return content.split(/\r?\n/)[lineNumber - 1] ?? "";
}

function extractProtectedRouteMatches(path, content) {
  const matches = [];
  const pattern = /<ProtectedRoute\b[\s\S]*?\ballowedRoles\s*=/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const allowedRolesOffset = match[0].search(/\ballowedRoles\s*=/);
    const index = match.index + Math.max(allowedRolesOffset, 0);
    const line = lineNumberAt(content, index);

    matches.push({
      path,
      line,
      snippet: cleanLine(lineAt(content, line)),
    });
  }

  return matches;
}

function collectMatches() {
  const files = walk(sourceRoot)
    .filter(isSourceFile)
    .map((file) => ({
      absolute: file,
      path: toPosix(relative(repoRoot, file)),
    }));

  return rules.reduce((results, rule) => {
    results[rule.id] = [];

    for (const file of files) {
      if (!rule.appliesTo(file.path)) {
        continue;
      }

      const content = readFileSync(file.absolute, "utf8");
      const matches = rule.fileExtractor
        ? rule.fileExtractor(file.path, content)
        : extractLineMatches(file.path, content, rule);

      results[rule.id].push(...matches);
    }

    return results;
  }, {});
}

function buildBaseline(matches) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    note: "Generated from current legacy debt. CI fails when current matches exceed these fingerprints.",
    rules: Object.fromEntries(
      rules.map((rule) => [
        rule.id,
        {
          description: rule.description,
          fingerprints: matches[rule.id].map(fingerprint).sort(),
        },
      ]),
    ),
  };
}

function readBaseline() {
  if (!existsSync(baselinePath)) {
    throw new Error(
      `Missing source boundary baseline at ${toPosix(relative(repoRoot, baselinePath))}. Run npm run governance:source -- --write-baseline.`,
    );
  }

  return JSON.parse(readFileSync(baselinePath, "utf8"));
}

function compareToBaseline(matches, baseline) {
  return rules.flatMap((rule) => {
    const currentCounts = countFingerprints(matches[rule.id]);
    const baselineCounts = (baseline.rules?.[rule.id]?.fingerprints ?? []).reduce((counts, key) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map());

    return Array.from(currentCounts.entries()).flatMap(([key, count]) => {
      const allowedCount = baselineCounts.get(key) ?? 0;
      const newCount = count - allowedCount;

      if (newCount <= 0) {
        return [];
      }

      const examples = matches[rule.id]
        .filter((match) => fingerprint(match) === key)
        .slice(0, newCount);

      return examples.map((match) => ({
        rule,
        match,
      }));
    });
  });
}

function writeSummary(matches, failures = []) {
  const lines = [
    "## Source Boundary Scan",
    "",
    "| Rule | Current matches | Baseline matches | Status |",
    "| --- | ---: | ---: | --- |",
  ];

  let baseline = null;
  if (existsSync(baselinePath)) {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  }

  for (const rule of rules) {
    const baselineCount = baseline?.rules?.[rule.id]?.fingerprints?.length ?? 0;
    const failureCount = failures.filter((failure) => failure.rule.id === rule.id).length;
    lines.push(
      `| \`${rule.id}\` | ${matches[rule.id].length} | ${baselineCount} | ${failureCount > 0 ? `${failureCount} new` : "ok"} |`,
    );
  }

  if (failures.length > 0) {
    lines.push("", "### New Violations", "");
    for (const { rule, match } of failures.slice(0, 25)) {
      lines.push(`- \`${rule.id}\` at \`${match.path}:${match.line}\`: ${match.snippet}`);
    }
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" });
  }

  console.log(lines.join("\n"));
}

const matches = collectMatches();

if (shouldWriteBaseline) {
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(buildBaseline(matches), null, 2)}\n`);
  console.log(`Wrote ${toPosix(relative(repoRoot, baselinePath))}`);
  writeSummary(matches);
  process.exit(0);
}

const baseline = readBaseline();
const failures = compareToBaseline(matches, baseline);
writeSummary(matches, failures);

if (failures.length > 0) {
  console.error(`Source boundary scan found ${failures.length} new violation(s).`);
  process.exit(1);
}
