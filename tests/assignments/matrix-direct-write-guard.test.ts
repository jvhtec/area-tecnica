import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Matrix hardening (Phase C/D): Matrix and direct-assignment mutation
// surfaces persist through src/features/assignments/commands only. A direct
// table write or a multi-step RPC sequence here reintroduces partial states.
const MUTATION_SURFACES = [
  "src/components/matrix/AssignJobDialog.tsx",
  "src/components/matrix/optimized-matrix-cell/useMatrixCellAssignmentRemoval.ts",
];

const FORBIDDEN = [
  { name: "direct job_assignments access", pattern: /from\(\s*['"]job_assignments['"]\s*\)/ },
  { name: "direct timesheets access", pattern: /from\(\s*['"]timesheets['"]\s*\)/ },
  { name: "per-date toggle RPC", pattern: /toggle_timesheet_day|toggleTimesheetDay/ },
  { name: "legacy removal RPC", pattern: /remove_assignment_with_timesheets|removeTimesheetAssignment/ },
  { name: "lifecycle hard delete", pattern: /manage_assignment_lifecycle/ },
  { name: "browser category sync", pattern: /syncTimesheetCategoriesForAssignment/ },
  { name: "direct Flex crew call", pattern: /manage-flex-crew-assignments/ },
];

describe("matrix mutation surfaces use the assignment command layer", () => {
  it.each(MUTATION_SURFACES)("%s has no direct assignment persistence", (path) => {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    for (const { name, pattern } of FORBIDDEN) {
      expect(pattern.test(source), `${path} contains ${name}`).toBe(false);
    }
  });

  it("job-card whole removal goes through the atomic removal command", () => {
    const source = readFileSync(join(process.cwd(), "src/hooks/useJobAssignmentsRealtime.ts"), "utf8");
    const removal = source.slice(source.indexOf("const removeAssignment = async"), source.indexOf("const handleRefresh = async"));
    expect(removal).toContain("removeDirectAssignment(");
    for (const { name, pattern } of FORBIDDEN) {
      expect(pattern.test(removal), `job-card removal contains ${name}`).toBe(false);
    }
  });
});
