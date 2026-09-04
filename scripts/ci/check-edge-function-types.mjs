#!/usr/bin/env node
/**
 * Type gate for Supabase Edge Functions (DATA-02).
 *
 * The Vite app is type-checked by `tsc -p tsconfig.app.json`, but that project only
 * includes `src/`. Edge Functions are Deno modules importing from `https://esm.sh/`,
 * `npm:` and `https://deno.land/std`, so only Deno can resolve and check them —
 * without this gate, privileged server code regresses silently.
 *
 * Checks every function entrypoint plus every `_shared/` module (the latter so shared
 * code is covered even when no function currently imports it).
 *
 * Requires Deno on PATH, or DENO_BIN pointing at the binary. Missing Deno is a
 * FAILURE by default, so a `&&`-chained validation run or a release checklist can
 * never report success without the functions having actually been checked. Pass
 * `--allow-missing-deno` to opt out explicitly on a machine without Deno.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const functionsRoot = join(repoRoot, "supabase", "functions");
const configPath = join(functionsRoot, "deno.check.json");

const denoBin = process.env.DENO_BIN || "deno";
const denoAvailable = spawnSync(denoBin, ["--version"], { encoding: "utf8" }).status === 0;

if (!denoAvailable) {
  const message =
    `Deno not found (tried '${denoBin}'). Install it from https://deno.land or set DENO_BIN.`;
  // Fail closed: skipping silently would let `npm run governance` and the release
  // checklist pass without any Edge Function having been type-checked.
  if (!process.argv.includes("--allow-missing-deno")) {
    console.error(`FAIL: ${message}`);
    console.error("Pass --allow-missing-deno to skip this check deliberately.");
    process.exit(1);
  }
  console.warn(`SKIP (--allow-missing-deno): edge function type check — ${message}`);
  process.exit(0);
}

const entrypoints = [];

for (const entry of readdirSync(functionsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === "_shared") continue;
  const indexPath = join(functionsRoot, entry.name, "index.ts");
  if (existsSync(indexPath)) entrypoints.push(indexPath);
}

const sharedRoot = join(functionsRoot, "_shared");
for (const entry of readdirSync(sharedRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
  if (entry.name.endsWith(".d.ts")) continue;
  // `_shared/*.test.ts` are Vitest specs that run under Node (`npm run test:run`),
  // not Deno tests — they import bare `vitest` and use extensionless specifiers.
  if (entry.name.endsWith(".test.ts")) continue;
  entrypoints.push(join(sharedRoot, entry.name));
}

entrypoints.sort();

if (entrypoints.length === 0) {
  console.error("FAIL: no edge function entrypoints found.");
  process.exit(1);
}

console.log(`Type-checking ${entrypoints.length} edge function modules with Deno...`);

const result = spawnSync(
  denoBin,
  ["check", "--frozen", "--config", configPath, ...entrypoints.map((path) => relative(repoRoot, path))],
  { cwd: repoRoot, stdio: "inherit" },
);

if (result.status !== 0) {
  console.error("\nFAIL: edge function type check reported errors.");
  process.exit(result.status ?? 1);
}

console.log(`OK: ${entrypoints.length} edge function modules type-check cleanly.`);
