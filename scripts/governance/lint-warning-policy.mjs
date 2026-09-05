export function compareWarningBudgets(snapshot, baseline) {
  const failures = [];
  const check = (scope, current, allowed) => {
    if (!Number.isFinite(allowed) || current > allowed) {
      failures.push(`${scope}: ${current} current > ${allowed ?? "missing"} allowed`);
    }
  };
  check("total", snapshot.total, baseline.total);
  for (const [rule, count] of Object.entries(snapshot.rules)) check(`rule ${rule}`, count, baseline.rules?.[rule] ?? 0);
  for (const [domain, counts] of Object.entries(snapshot.domains)) {
    check(`domain ${domain}`, counts.total, baseline.domains?.[domain]?.total);
    for (const [rule, count] of Object.entries(counts.rules)) check(`${domain}/${rule}`, count, baseline.domains?.[domain]?.rules?.[rule] ?? 0);
  }
  for (const [file, counts] of Object.entries(snapshot.files)) {
    for (const [rule, count] of Object.entries(counts)) check(`${file}/${rule}`, count, baseline.files?.[file]?.[rule] ?? 0);
  }
  return failures;
}
