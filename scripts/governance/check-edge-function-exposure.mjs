#!/usr/bin/env node

// Phase 2 trust-boundary gate.
//
// Enforces that every Supabase Edge Function directory is classified in
// scripts/governance/edge-function-exposure.json and that the reviewed JWT
// requirement in the manifest matches supabase/config.toml. This prevents a
// function's gateway exposure (verify_jwt) from silently drifting and makes the
// exposure classification an enforced, reviewable control rather than a doc.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const functionsRoot = join(repoRoot, "supabase", "functions");
const configPath = join(repoRoot, "supabase", "config.toml");
const manifestPath = join(
  repoRoot,
  "scripts",
  "governance",
  "edge-function-exposure.json",
);

const VALID_CLASSES = new Set([
  "public-token",
  "authenticated-user",
  "privileged-role",
  "service-only",
]);

const PRIVILEGED_ROLE_GUARD_PATTERNS = [
  /\brequireAdminOrManagement\b/,
  /\brequireAuthenticatedRole\b/,
  /\bALLOWED_ROLES\b/,
  /\bGOOGLE_MAPS_ALLOWED_ROLES\b/,
  /\.select\([^)]*\brole\b[^)]*\)/s,
];

const SERVICE_ONLY_GUARD_PATTERNS = [
  /\brequireServiceRoleRequest\b/,
  /\bisServiceRoleRequest\b/,
  /\btimingSafeEqual\b/,
  /\bWALLBOARD_SHARED_TOKEN\b/,
];

function toPosix(path) {
  return path.split("\\").join("/");
}

function listFunctionDirectories() {
  return readdirSync(functionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .filter((name) => {
      // Only directories that expose an entrypoint are deployable functions.
      return (
        existsSync(join(functionsRoot, name, "index.ts")) ||
        existsSync(join(functionsRoot, name, "index.js"))
      );
    })
    .sort((a, b) => a.localeCompare(b));
}

// Minimal supabase/config.toml reader: returns a map of function name to its
// explicit verify_jwt value. Functions absent from config.toml default to true.
function readConfigVerifyJwt() {
  const verifyJwt = new Map();

  if (!existsSync(configPath)) {
    return verifyJwt;
  }

  const lines = readFileSync(configPath, "utf8").split(/\r?\n/);
  let currentFunction = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const sectionMatch = line.match(/^\[functions\.([^\]]+)\]$/);

    if (sectionMatch) {
      currentFunction = sectionMatch[1];
      continue;
    }

    if (line.startsWith("[")) {
      currentFunction = null;
      continue;
    }

    if (!currentFunction) {
      continue;
    }

    const verifyMatch = line.match(/^verify_jwt\s*=\s*(true|false)\b/);
    if (verifyMatch) {
      verifyJwt.set(currentFunction, verifyMatch[1] === "true");
    }
  }

  return verifyJwt;
}

function readManifest() {
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Missing exposure manifest at ${toPosix(relative(repoRoot, manifestPath))}.`,
    );
  }

  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function effectiveVerifyJwt(configVerifyJwt, name) {
  // Supabase defaults verify_jwt to true when a function is not listed.
  return configVerifyJwt.has(name) ? configVerifyJwt.get(name) : true;
}

function listSourceFiles(directory) {
  const files = [];

  if (!existsSync(directory)) {
    return files;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "__tests__") {
        continue;
      }

      files.push(...listSourceFiles(entryPath));
      continue;
    }

    if (
      entry.isFile() &&
      /\.(?:ts|js)$/.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.js")
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

function readFunctionSource(name) {
  return listSourceFiles(join(functionsRoot, name))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function hasPattern(source, patterns) {
  return patterns.some((pattern) => pattern.test(source));
}

function normalizedGuard(entry) {
  return typeof entry.internalGuard === "string" ? entry.internalGuard.trim() : "";
}

function validate() {
  const directories = listFunctionDirectories();
  const manifest = readManifest();
  const declared = manifest.functions ?? {};
  const configVerifyJwt = readConfigVerifyJwt();

  const errors = [];

  const directorySet = new Set(directories);
  const declaredNames = Object.keys(declared);

  for (const name of directories) {
    const entry = declared[name];

    if (!entry) {
      errors.push(
        `Function \`${name}\` is not classified in edge-function-exposure.json. Add an exposure class.`,
      );
      continue;
    }

    if (!VALID_CLASSES.has(entry.class)) {
      errors.push(
        `Function \`${name}\` has invalid class \`${entry.class}\`. Use one of: ${[...VALID_CLASSES].join(", ")}.`,
      );
    }

    if (typeof entry.verifyJwt !== "boolean") {
      errors.push(`Function \`${name}\` must declare a boolean \`verifyJwt\`.`);
      continue;
    }

    const actual = effectiveVerifyJwt(configVerifyJwt, name);
    if (actual !== entry.verifyJwt) {
      errors.push(
        `Function \`${name}\` declares verifyJwt=${entry.verifyJwt} but supabase/config.toml resolves to ${actual}. ` +
          `Update config.toml or the reviewed exposure manifest together.`,
      );
    }

    if (entry.verifyJwt === false) {
      const guard = normalizedGuard(entry);
      if (!guard) {
        errors.push(
          `Function \`${name}\` has verifyJwt=false but no internalGuard. ` +
            `Document how it is protected without gateway JWT verification.`,
        );
      }
    }

    if (entry.class === "public-token") {
      const guard = normalizedGuard(entry);
      if (!guard) {
        errors.push(
          `Function \`${name}\` is public-token but has no internalGuard. ` +
            `Document the token, rate limit, safe public behavior, or other runtime guard.`,
        );
      }
    }

    if (entry.class === "service-only") {
      const guard = normalizedGuard(entry);
      if (!guard) {
        errors.push(
          `Function \`${name}\` is service-only but has no internalGuard. ` +
            `Document the service-role/shared-secret/runtime guard.`,
        );
      }

      const source = readFunctionSource(name);
      if (!hasPattern(source, SERVICE_ONLY_GUARD_PATTERNS)) {
        errors.push(
          `Function \`${name}\` is service-only but its source does not reference a recognizable service-only guard. ` +
            `Use requireServiceRoleRequest/isServiceRoleRequest or document and implement an equivalent guard.`,
        );
      }
    }

    if (entry.class === "privileged-role") {
      const source = readFunctionSource(name);
      if (!hasPattern(source, PRIVILEGED_ROLE_GUARD_PATTERNS)) {
        errors.push(
          `Function \`${name}\` is privileged-role but its source does not reference a recognizable role guard. ` +
            `Use requireAdminOrManagement/requireAuthenticatedRole or an explicit role allowlist.`,
        );
      }
    }
  }

  for (const name of declaredNames) {
    if (!directorySet.has(name)) {
      errors.push(
        `Exposure manifest references \`${name}\`, which has no deployable function directory. Remove the stale entry.`,
      );
    }
  }

  return { directories, declared, configVerifyJwt, errors };
}

function classCounts(directories, declared) {
  const counts = new Map();
  for (const name of directories) {
    const cls = declared[name]?.class ?? "unclassified";
    counts.set(cls, (counts.get(cls) ?? 0) + 1);
  }
  return counts;
}

function writeSummary({ directories, declared }, errors) {
  const counts = classCounts(directories, declared);
  const lines = [
    "## Edge Function Exposure Classification",
    "",
    "| Exposure class | Count |",
    "| --- | ---: |",
  ];

  for (const cls of ["public-token", "authenticated-user", "privileged-role", "service-only", "unclassified"]) {
    if (counts.has(cls)) {
      lines.push(`| ${cls} | ${counts.get(cls)} |`);
    }
  }

  lines.push("", `Total deployable functions: ${directories.length}`);

  if (errors.length > 0) {
    lines.push("", "### Violations", "");
    for (const message of errors) {
      lines.push(`- ${message}`);
    }
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" });
  }

  console.log(lines.join("\n"));
}

const result = validate();
writeSummary(result, result.errors);

if (result.errors.length > 0) {
  console.error(
    `\nEdge Function exposure gate failed with ${result.errors.length} violation(s).`,
  );
  process.exit(1);
}
