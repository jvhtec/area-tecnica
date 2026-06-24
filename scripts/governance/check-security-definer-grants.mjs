#!/usr/bin/env node

// Phase 2 trust-boundary gate (ENT-DB-01).
//
// Scans every committed migration for `GRANT EXECUTE ... TO anon`/`TO PUBLIC`
// statements and fails when a function is newly exposed to anonymous callers
// unless it is on the reviewed allowlist baseline. Each migration is applied in
// timestamp order, so a later REVOKE that closes an earlier grant clears the
// finding — only functions left executable by anon/PUBLIC at the end are
// reported.
//
// This makes "no new unsafe SECURITY DEFINER grant to anon" an enforced control
// instead of a manual review step. Regenerate the baseline (after review) with:
//   npm run governance:sql-grants -- --write-baseline

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const migrationsRoot = join(repoRoot, "supabase", "migrations");
const baselinePath = join(
  repoRoot,
  "scripts",
  "governance",
  "security-definer-grant-baseline.json",
);
const shouldWriteBaseline = process.argv.includes("--write-baseline");

function toPosix(path) {
  return path.split("\\").join("/");
}

// Strip line (--) and block (/* */) SQL comments so commented-out grants do not
// register as live statements.
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

function listMigrations() {
  if (!existsSync(migrationsRoot)) {
    return [];
  }

  return readdirSync(migrationsRoot)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

// Normalize a function signature into a stable key: schema-qualified name plus
// the count of comma-separated argument groups, ignoring whitespace/case. Exact
// argument types are not always present on REVOKE/GRANT, so we key on name+arity
// which is sufficient to track a function across grant/revoke statements.
function normalizeTarget(rawTarget) {
  const target = rawTarget.replace(/\s+/g, " ").trim();
  const match = target.match(/^([a-z0-9_."]+)\s*(?:\(([^)]*)\))?/i);
  if (!match) {
    return null;
  }

  const name = match[1].replace(/"/g, "").toLowerCase();
  const args = (match[2] ?? "").trim();
  const arity = args === "" ? 0 : args.split(",").length;
  return `${name}/${arity}`;
}

// Split a GRANT/REVOKE target list into individual function targets. A single
// statement may name several functions (`... ON FUNCTION f1(a, b), f2(c) TO x`).
// We split on top-level commas only, so commas inside an argument list are kept
// with their function.
function splitFunctionTargets(rawTargets) {
  const targets = [];
  let depth = 0;
  let current = "";

  for (const ch of rawTargets) {
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
    }

    if (ch === "," && depth === 0) {
      targets.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    targets.push(current);
  }

  return targets.map((target) => target.trim()).filter(Boolean);
}

const GRANT_RE =
  /\bGRANT\s+(?:EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+FUNCTION\s+([\s\S]+?)\s+TO\s+([^;]+);/gi;
const REVOKE_RE =
  /\bREVOKE\s+(?:EXECUTE|ALL)(?:\s+PRIVILEGES)?\s+ON\s+FUNCTION\s+([\s\S]+?)\s+FROM\s+([^;]+);/gi;

// Schema-wide grants expose (or revoke) EXECUTE on every function in a schema at
// once. We cannot enumerate the affected functions statically, so a grant of
// `ON ALL FUNCTIONS IN SCHEMA <schema> TO anon/PUBLIC` is tracked under a single
// wildcard key and treated as a hard exposure unless explicitly allowlisted.
const GRANT_ALL_IN_SCHEMA_RE =
  /\bGRANT\s+(?:EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+([a-z0-9_".]+)\s+TO\s+([^;]+);/gi;
const REVOKE_ALL_IN_SCHEMA_RE =
  /\bREVOKE\s+(?:EXECUTE|ALL)(?:\s+PRIVILEGES)?\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+([a-z0-9_".]+)\s+FROM\s+([^;]+);/gi;

function schemaWildcardKey(rawSchema) {
  const schema = rawSchema.replace(/"/g, "").trim().toLowerCase();
  return `${schema}.* (ALL FUNCTIONS IN SCHEMA)`;
}

function rolesList(rawRoles) {
  return rawRoles
    .split(",")
    .map((role) => role.trim().replace(/"/g, "").toLowerCase())
    .filter(Boolean);
}

// Replay all migrations in order, tracking which functions end up granted to
// anon or PUBLIC.
function computeAnonExecutable() {
  const exposed = new Map(); // key -> { display, migration }

  for (const fileName of listMigrations()) {
    const sql = stripSqlComments(readFileSync(join(migrationsRoot, fileName), "utf8"));

    // Order within a file matters; interleave grants and revokes by position.
    const statements = [];

    let match;
    GRANT_RE.lastIndex = 0;
    while ((match = GRANT_RE.exec(sql)) !== null) {
      statements.push({ index: match.index, kind: "grant", scope: "function", target: match[1], roles: match[2] });
    }
    REVOKE_RE.lastIndex = 0;
    while ((match = REVOKE_RE.exec(sql)) !== null) {
      statements.push({ index: match.index, kind: "revoke", scope: "function", target: match[1], roles: match[2] });
    }
    GRANT_ALL_IN_SCHEMA_RE.lastIndex = 0;
    while ((match = GRANT_ALL_IN_SCHEMA_RE.exec(sql)) !== null) {
      statements.push({ index: match.index, kind: "grant", scope: "schema", target: match[1], roles: match[2] });
    }
    REVOKE_ALL_IN_SCHEMA_RE.lastIndex = 0;
    while ((match = REVOKE_ALL_IN_SCHEMA_RE.exec(sql)) !== null) {
      statements.push({ index: match.index, kind: "revoke", scope: "schema", target: match[1], roles: match[2] });
    }

    statements.sort((a, b) => a.index - b.index);

    for (const statement of statements) {
      const roles = rolesList(statement.roles);
      const touchesAnon = roles.includes("anon") || roles.includes("public");

      if (!touchesAnon) {
        continue;
      }

      // Each statement may carry several function targets (or a schema wildcard).
      const entries = statement.scope === "schema"
        ? [{ key: schemaWildcardKey(statement.target), display: `ALL FUNCTIONS IN SCHEMA ${statement.target.replace(/"/g, "").trim()}` }]
        : splitFunctionTargets(statement.target)
            .map((target) => ({ key: normalizeTarget(target), display: target.replace(/\s+/g, " ").trim() }))
            .filter((entry) => entry.key);

      for (const entry of entries) {
        if (statement.kind === "grant") {
          exposed.set(entry.key, { display: entry.display, migration: fileName });
        } else {
          exposed.delete(entry.key);
        }
      }
    }
  }

  return exposed;
}

function readBaseline() {
  if (!existsSync(baselinePath)) {
    throw new Error(
      `Missing SECURITY DEFINER grant baseline at ${toPosix(relative(repoRoot, baselinePath))}. ` +
        `Run npm run governance:sql-grants -- --write-baseline.`,
    );
  }
  return JSON.parse(readFileSync(baselinePath, "utf8"));
}

function buildBaseline(exposed) {
  return {
    version: 1,
    note:
      "Functions whose EXECUTE is still granted to anon/PUBLIC after replaying all migrations. " +
      "Each entry is an accepted, reviewed exposure. New unlisted grants to anon/PUBLIC fail CI. " +
      "Prefer revoking from anon/PUBLIC and granting explicitly to authenticated/service_role.",
    allowedAnonExecutable: [...exposed.keys()].sort(),
  };
}

const exposed = computeAnonExecutable();

if (shouldWriteBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify(buildBaseline(exposed), null, 2)}\n`);
  console.log(`Wrote ${toPosix(relative(repoRoot, baselinePath))} with ${exposed.size} entr(y/ies).`);
  process.exit(0);
}

const baseline = readBaseline();
const allowed = new Set(baseline.allowedAnonExecutable ?? []);

const violations = [...exposed.entries()].filter(([key]) => !allowed.has(key));

const lines = [
  "## SECURITY DEFINER Anonymous Grant Gate",
  "",
  "| Metric | Count |",
  "| --- | ---: |",
  `| Functions executable by anon/PUBLIC | ${exposed.size} |`,
  `| Reviewed/allowlisted | ${allowed.size} |`,
  `| New unreviewed exposures | ${violations.length} |`,
];

if (violations.length > 0) {
  lines.push("", "### New anon/PUBLIC EXECUTE grants", "");
  for (const [key, info] of violations) {
    lines.push(`- \`${info.display}\` (${key}) granted in \`${info.migration}\``);
  }
}

if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" });
}

console.log(lines.join("\n"));

if (violations.length > 0) {
  console.error(
    `\nSECURITY DEFINER grant gate failed: ${violations.length} function(s) newly executable by anon/PUBLIC. ` +
      `Revoke the grant or, if intentional, add it to the reviewed baseline.`,
  );
  process.exit(1);
}
