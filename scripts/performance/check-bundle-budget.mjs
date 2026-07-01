#!/usr/bin/env node

import { gzipSync } from "node:zlib";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, relative } from "node:path";

const repoRoot = process.cwd();
const distDir = join(repoRoot, "dist");
const baselinePath = join(repoRoot, "docs", "performance", "phase-4-baseline", "baseline.json");

const kindBudgets = {
  js: { percent: 0.1, slackBytes: 75_000 },
  css: { percent: 0.1, slackBytes: 20_000 },
  font: { percent: 0.05, slackBytes: 25_000 },
  image: { percent: 0.12, slackBytes: 500_000 },
};

const absoluteKindBudgets = {
  js: 3_150_000,
  css: 80_000,
  font: 2_950_000,
  image: 8_500_000,
};

const largeJsBudget = { percent: 0.12, slackBytes: 60_000 };
const entryScriptBudget = { percent: 0.12, slackBytes: 30_000 };
const absoluteLargestEntryScriptBytes = 230_000;
const absoluteLargeJsFamilyBudgets = {
  "maps-lib.js": 575_000,
  "pdf-libs.js": 430_000,
  "spreadsheet-libs.js": 340_000,
  "index.js": 230_000,
};
const largeJsRawThresholdBytes = 500_000;
const newLargeJsGzipThresholdBytes = 180_000;

function toPosix(path) {
  return path.split("\\").join("/");
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${bytes} B`;
}

function formatDelta(bytes) {
  if (bytes === 0) return "0 B";
  const sign = bytes > 0 ? "+" : "-";
  return `${sign}${formatBytes(Math.abs(bytes))}`;
}

function walkFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

function assetKind(file) {
  const ext = extname(file).toLowerCase();
  if (ext === ".js") return "js";
  if (ext === ".css") return "css";
  if ([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".ico"].includes(ext)) return "image";
  if ([".woff", ".woff2", ".ttf", ".otf"].includes(ext)) return "font";
  return "other";
}

function chunkFamily(fileName) {
  // Rollup content hashes are 8-char base64url and can contain "-" or "_",
  // which otherwise collide with the "-" name separator and break family
  // grouping (e.g. "pdf-libs-C-EJni8q.js" must reduce to "pdf-libs.js", not
  // "pdf-libs-C.js"). Strip exactly the trailing 8-char hash segment.
  return fileName.replace(/-[A-Za-z0-9_-]{8}(?=\.[^.]+$)/, "");
}

function collectBundleMetrics() {
  const files = walkFiles(distDir).map((file) => {
    const content = readFileSync(file);
    const sizeBytes = statSync(file).size;

    return {
      path: toPosix(relative(repoRoot, file)),
      file: basename(file),
      kind: assetKind(file),
      family: chunkFamily(basename(file)),
      sizeBytes,
      gzipBytes: gzipSync(content).length,
    };
  });

  const totalsByKind = files.reduce((totals, file) => {
    const current = totals[file.kind] ?? { files: 0, sizeBytes: 0, gzipBytes: 0 };
    current.files += 1;
    current.sizeBytes += file.sizeBytes;
    current.gzipBytes += file.gzipBytes;
    totals[file.kind] = current;
    return totals;
  }, {});

  const indexHtml = readFileSync(join(distDir, "index.html"), "utf8");
  const entryScripts = Array.from(indexHtml.matchAll(/<script[^>]+src="([^"]+\.js)"/g))
    .map((match) => match[1]);

  return {
    files,
    totalsByKind,
    entryScripts,
    largeJsAssets: files
      .filter((file) => file.kind === "js" && file.sizeBytes >= largeJsRawThresholdBytes)
      .sort((a, b) => b.sizeBytes - a.sizeBytes),
  };
}

function maxAllowedBytes(baselineBytes, budget) {
  return baselineBytes + Math.max(Math.round(baselineBytes * budget.percent), budget.slackBytes);
}

function assetByPath(files, path) {
  const withoutDot = path.startsWith("./") ? path.slice(2) : path;
  const normalized = withoutDot.startsWith("/")
    ? `dist${withoutDot}`
    : withoutDot.startsWith("dist/")
      ? withoutDot
      : `dist/${withoutDot}`;

  return files.find((file) => file.path === normalized);
}

function largestEntryScript(files, entryScripts) {
  return entryScripts
    .map((entry) => assetByPath(files, entry))
    .filter(Boolean)
    .sort((a, b) => b.gzipBytes - a.gzipBytes)[0] ?? null;
}

function baselineLargeJsFamilies(baselineBundle) {
  return (baselineBundle.largeJsAssets ?? []).reduce((families, asset) => {
    families.set(chunkFamily(asset.file), asset);
    return families;
  }, new Map());
}

function baselineFilesFromBundle(baselineBundle) {
  return [
    ...(baselineBundle.largestAssets ?? []),
    ...(baselineBundle.largeJsAssets ?? []),
  ];
}

function compareBundles(current, baselineBundle) {
  const failures = [];
  const rows = [];

  for (const [kind, budget] of Object.entries(kindBudgets)) {
    const currentTotal = current.totalsByKind[kind]?.gzipBytes ?? 0;
    const baselineTotal = baselineBundle.totalsByKind?.[kind]?.gzipBytes ?? 0;
    const max = maxAllowedBytes(baselineTotal, budget);

    rows.push({
      label: `${kind} gzip total`,
      baselineBytes: baselineTotal,
      currentBytes: currentTotal,
      maxBytes: max,
    });

    if (currentTotal > max) {
      failures.push({
        label: `${kind} gzip total`,
        currentBytes: currentTotal,
        maxBytes: max,
      });
    }

    const absoluteMax = absoluteKindBudgets[kind];
    if (absoluteMax) {
      rows.push({
        label: `${kind} gzip total absolute`,
        baselineBytes: baselineTotal,
        currentBytes: currentTotal,
        maxBytes: absoluteMax,
      });

      if (currentTotal > absoluteMax) {
        failures.push({
          label: `${kind} gzip total absolute`,
          currentBytes: currentTotal,
          maxBytes: absoluteMax,
        });
      }
    }
  }

  const baselineFiles = baselineFilesFromBundle(baselineBundle);
  const baselineEntry = largestEntryScript(
    baselineFiles,
    baselineBundle.entryScripts ?? [],
  );
  const currentEntry = largestEntryScript(current.files, current.entryScripts);

  if (baselineEntry && currentEntry) {
    const max = maxAllowedBytes(baselineEntry.gzipBytes, entryScriptBudget);
    rows.push({
      label: "largest entry script gzip",
      baselineBytes: baselineEntry.gzipBytes,
      currentBytes: currentEntry.gzipBytes,
      maxBytes: max,
    });

    if (currentEntry.gzipBytes > max) {
      failures.push({
        label: `largest entry script (${currentEntry.file})`,
        currentBytes: currentEntry.gzipBytes,
        maxBytes: max,
      });
    }

    rows.push({
      label: "largest entry script gzip absolute",
      baselineBytes: baselineEntry.gzipBytes,
      currentBytes: currentEntry.gzipBytes,
      maxBytes: absoluteLargestEntryScriptBytes,
    });

    if (currentEntry.gzipBytes > absoluteLargestEntryScriptBytes) {
      failures.push({
        label: `largest entry script absolute (${currentEntry.file})`,
        currentBytes: currentEntry.gzipBytes,
        maxBytes: absoluteLargestEntryScriptBytes,
      });
    }
  }

  const baselineFamilies = baselineLargeJsFamilies(baselineBundle);

  for (const asset of current.largeJsAssets) {
    const baselineAsset = baselineFamilies.get(asset.family);

    if (!baselineAsset) {
      rows.push({
        label: `new large JS ${asset.family}`,
        baselineBytes: 0,
        currentBytes: asset.gzipBytes,
        maxBytes: newLargeJsGzipThresholdBytes,
      });

      if (asset.gzipBytes > newLargeJsGzipThresholdBytes) {
        failures.push({
          label: `new large JS chunk ${asset.file}`,
          currentBytes: asset.gzipBytes,
          maxBytes: newLargeJsGzipThresholdBytes,
        });
      }
      continue;
    }

    const max = maxAllowedBytes(baselineAsset.gzipBytes, largeJsBudget);
    const absoluteFamilyMax = absoluteLargeJsFamilyBudgets[asset.family];
    const effectiveMax = absoluteFamilyMax ? Math.min(max, absoluteFamilyMax) : max;
    rows.push({
      label: `${asset.family} gzip`,
      baselineBytes: baselineAsset.gzipBytes,
      currentBytes: asset.gzipBytes,
      maxBytes: effectiveMax,
    });

    if (asset.gzipBytes > effectiveMax) {
      failures.push({
        label: `${asset.file}`,
        currentBytes: asset.gzipBytes,
        maxBytes: effectiveMax,
      });
    }
  }

  return { rows, failures };
}

function writeSummary(rows, failures, current) {
  const lines = [
    "## Bundle Budget",
    "",
    "| Budget | Baseline | Current | Delta | Max allowed | Status |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...rows.map((row) => {
      const failed = row.currentBytes > row.maxBytes;
      return [
        `| ${row.label}`,
        formatBytes(row.baselineBytes),
        formatBytes(row.currentBytes),
        formatDelta(row.currentBytes - row.baselineBytes),
        formatBytes(row.maxBytes),
        `${failed ? "fail" : "ok"} |`,
      ].join(" | ");
    }),
    "",
    "### Current Large JS Chunks",
    "",
    current.largeJsAssets.length
      ? "| Asset | Raw | Gzip |\n| --- | ---: | ---: |\n" +
        current.largeJsAssets
          .map((asset) => `| \`${asset.path}\` | ${formatBytes(asset.sizeBytes)} | ${formatBytes(asset.gzipBytes)} |`)
          .join("\n")
      : "No JS chunks are above the large-chunk threshold.",
  ];

  if (failures.length > 0) {
    lines.push("", "### Failed Budgets", "");
    for (const failure of failures) {
      lines.push(`- ${failure.label}: ${formatBytes(failure.currentBytes)} current, ${formatBytes(failure.maxBytes)} allowed`);
    }
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" });
  }

  console.log(lines.join("\n"));
}

if (!existsSync(distDir)) {
  console.error("Missing dist directory. Run npm run build before npm run budget:bundle.");
  process.exit(1);
}

if (!existsSync(baselinePath)) {
  console.error(`Missing bundle baseline at ${toPosix(relative(repoRoot, baselinePath))}.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const current = collectBundleMetrics();
const { rows, failures } = compareBundles(current, baseline.bundle);

writeSummary(rows, failures, current);

if (failures.length > 0) {
  console.error(`Bundle budget check failed with ${failures.length} regression(s).`);
  process.exit(1);
}
