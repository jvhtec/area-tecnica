import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Matrix hardening (Phase C/D): Matrix and direct-assignment mutation
// surfaces persist through src/features/assignments/commands only. A direct
// table write or a multi-step RPC sequence here reintroduces partial states.
const MUTATION_SURFACES = [
  "src/components/matrix/AssignJobDialog.tsx",
  "src/components/matrix/AssignmentStatusDialog.tsx",
  "src/components/matrix/optimized-matrix-cell/useMatrixCellAssignmentRemoval.ts",
  "src/components/jobs/JobAssignmentDialog.tsx",
  "src/hooks/useJobAssignmentsRealtime.ts",
  "src/components/department/MobileAssignmentsDialog.tsx",
];

const FORBIDDEN = [
  // Reads for display are fine; any write chained on these tables is not.
  {
    name: "direct assignment/schedule table write",
    pattern: /from\(\s*['"](?:job_assignments|timesheets)['"]\s*\)\s*\.\s*(?:insert|update|delete|upsert)\b/,
  },
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

  it.each([
    ["src/components/matrix/AssignJobDialog.tsx", "applyDirectAssignment("],
    ["src/components/matrix/AssignmentStatusDialog.tsx", "setAssignmentStatus("],
    ["src/components/matrix/optimized-matrix-cell/useMatrixCellAssignmentRemoval.ts", "removeAssignmentDate("],
    ["src/components/jobs/JobAssignmentDialog.tsx", "changeAssignmentRole("],
    ["src/hooks/useJobAssignmentsRealtime.ts", "removeDirectAssignment("],
    ["src/hooks/useJobAssignmentsRealtime.ts", "applyDirectAssignment("],
  ])("%s persists through %s", (path, command) => {
    expect(readFileSync(join(process.cwd(), path), "utf8")).toContain(command);
  });
});
