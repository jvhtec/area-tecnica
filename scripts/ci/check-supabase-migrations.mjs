#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("../..", import.meta.url).pathname;
const migrationsRoot = join(repoRoot, "supabase", "migrations");
const files = readdirSync(migrationsRoot)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const filenamePattern = /^(?<timestamp>\d{14})_[a-z0-9][a-z0-9_]*\.sql$/;
const seenTimestamps = new Map();
const problems = [];

for (const [index, file] of files.entries()) {
  const match = file.match(filenamePattern);
  if (!match?.groups) {
    problems.push(`${file}: migration filename must be <YYYYMMDDHHMMSS>_<slug>.sql`);
    continue;
  }

  const timestamp = match.groups.timestamp;
  const previous = seenTimestamps.get(timestamp);
  if (previous) {
    problems.push(`${file}: duplicate migration timestamp also used by ${previous}`);
  }
  seenTimestamps.set(timestamp, file);

  if (index > 0 && files[index - 1] > file) {
    problems.push(`${file}: migrations are not lexicographically ordered`);
  }

  const sql = readFileSync(join(migrationsRoot, file), "utf8");
  if (sql.trim().length === 0) {
    problems.push(`${file}: migration is empty`);
  }

  if (file !== "00000000000000_production_schema.sql" && timestamp === "00000000000000") {
    problems.push(`${file}: only the production schema baseline may use the zero timestamp`);
  }
}

if (problems.length > 0) {
  console.error("Supabase migration ordering check failed:");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log(`OK: ${files.length} Supabase migrations have unique ordered timestamps.`);
