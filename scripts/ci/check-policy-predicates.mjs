import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

export function suspiciousPredicate(sql) {
  if (!sql) return false;
  // Ignore string literals: a data value containing SQL words is not a clause.
  const text = sql.replace(/'(?:''|[^'])*'/g, "'literal'");
  const tokens = text.match(/"(?:""|[^"])+"|[a-z_][a-z_0-9]*|[^\s]/gi) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].toLowerCase() !== "true") continue;
    const before = tokens[i - 1]?.toLowerCase();
    const after = tokens[i + 1]?.toLowerCase();
    if ((!before || ["(", "or", "and"].includes(before)) && (!after || [")", "or", "and"].includes(after))) return true;
  }
  // Qualified self-equality is the historical job-assignment correlation bug.
  return /\b([a-z_][a-z_0-9]*\s*\.\s*[a-z_][a-z_0-9]*)\s*=\s*\1\b/i.test(text.replaceAll('"', ''));
}

export function checkPolicies(catalog, baseline) {
  if (catalog?.format_version !== 1 || !Array.isArray(catalog.objects) || !catalog.objects.some(o => o.kind === "policy")) throw new Error("Missing versioned policy catalog");
  const failures = [];
  for (const policy of catalog.objects.filter(o => o.kind === "policy")) {
    if (!suspiciousPredicate(policy.value.using) && !suspiciousPredicate(policy.value.check)) continue;
    const allowed = baseline.policies?.[policy.identity];
    if (!allowed?.rationale || !isDeepStrictEqual(allowed.value, policy.value)) failures.push(policy.identity);
  }
  return failures;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const catalog = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const baseline = JSON.parse(readFileSync(new URL("../governance/policy-predicate-allowlist.json", import.meta.url), "utf8"));
  const failures = checkPolicies(catalog, baseline);
  console.log(`Policy predicate guard: ${failures.length} unreviewed unconditional/self-comparison policies.`);
  for (const identity of failures) console.error(identity);
  if (failures.length) process.exit(1);
}
