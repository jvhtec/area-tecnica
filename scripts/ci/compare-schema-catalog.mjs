import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

function objectsByIdentity(catalog) {
  if (catalog?.format_version !== 1 || !Array.isArray(catalog.objects) || !catalog.objects.length) {
    throw new Error("Expected a non-empty version 1 schema catalog.");
  }
  const objects = new Map();
  for (const entry of catalog.objects) {
    if (typeof entry.kind !== "string" || typeof entry.identity !== "string" || !("value" in entry)) {
      throw new Error("Invalid catalog entry.");
    }
    const key = JSON.stringify([entry.kind, entry.identity]);
    if (objects.has(key)) throw new Error(`Duplicate catalog identity: ${key}`);
    objects.set(key, entry);
  }
  return objects;
}

export function compareCatalogs(expected, actual) {
  if (expected.postgres_major !== actual.postgres_major) {
    throw new Error("Postgres major versions differ; replay with the production major before comparing deparsed definitions.");
  }
  const left = objectsByIdentity(expected);
  const right = objectsByIdentity(actual);
  const differences = [];
  for (const key of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const before = left.get(key);
    const after = right.get(key);
    const entry = before ?? after;
    if (!before || !after || !isDeepStrictEqual(before.value, after.value)) {
      differences.push({ kind: entry.kind, identity: entry.identity,
        change: !before ? "production_only" : !after ? "replay_only" : "changed",
        expected: before?.value, actual: after?.value });
    }
  }
  return differences;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [expectedPath, actualPath] = process.argv.slice(2);
  if (!expectedPath || !actualPath) throw new Error("Usage: node scripts/ci/compare-schema-catalog.mjs <replayed.json> <production.json>");
  const differences = compareCatalogs(JSON.parse(readFileSync(expectedPath, "utf8")), JSON.parse(readFileSync(actualPath, "utf8")));
  console.log(JSON.stringify({ difference_count: differences.length, differences }, null, 2));
  process.exitCode = differences.length ? 1 : 0;
}
