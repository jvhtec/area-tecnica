import { test } from "node:test";
import assert from "node:assert/strict";
import { compareCatalogs } from "./compare-schema-catalog.mjs";

const entry = (identity, value = { using: "auth.uid() IS NOT NULL" }) => ({ kind: "policy", identity, value });
const catalog = (...objects) => ({ format_version: 1, postgres_major: 15, objects });

test("compares object identity rather than counts or row order", () => {
  const baseline = catalog(entry("a"), entry("b"));
  assert.deepEqual(compareCatalogs(baseline, catalog(entry("b"), entry("a"))), []);
  const drift = compareCatalogs(baseline, catalog(entry("a", { using: "true" }), entry("c")));
  assert.deepEqual(drift.map(({ identity, change }) => [identity, change]), [["a", "changed"], ["b", "replay_only"], ["c", "production_only"]]);
});

test("detects changed function fingerprints and grants", () => {
  const baseline = catalog({ kind: "function", identity: "public.fn()", value: { definition_hash: "old" } });
  const changed = catalog({ kind: "function", identity: "public.fn()", value: { definition_hash: "new" } });
  assert.equal(compareCatalogs(baseline, changed).length, 1);
  const grants = catalog({ kind: "function_grant", identity: "public.fn()", value: ["authenticated"] });
  const exposed = catalog({ kind: "function_grant", identity: "public.fn()", value: ["authenticated", "PUBLIC"] });
  assert.equal(compareCatalogs(grants, exposed).length, 1);
});

test("fails closed for missing, duplicate, empty or incompatible catalogs", () => {
  const valid = catalog(entry("a"));
  for (const invalid of [{}, catalog(), catalog(entry("a"), entry("a")), { ...valid, postgres_major: 17 }]) {
    assert.throws(() => compareCatalogs(valid, invalid));
  }
});
