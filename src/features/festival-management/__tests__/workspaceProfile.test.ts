import { describe, expect, it } from "vitest";

import { getJobWorkspaceProfile } from "@/features/festival-management/workspaceProfile";

describe("getJobWorkspaceProfile", () => {
  it.each([
    ["festival", "Festival", "Producción del festival"],
    ["ciclo", "Ciclo", "Producción del ciclo"],
    ["single", "Bolo", "Producción del bolo"],
    ["evento", "Evento", "Producción del evento"],
    ["tourdate", "Fecha de gira", "Producción de la fecha de gira"],
  ] as const)("maps %s to its Spanish workspace identity", (jobType, badgeLabel, workspaceLabel) => {
    const result = getJobWorkspaceProfile(jobType);

    expect(result.badgeLabel).toBe(badgeLabel);
    expect(result.workspaceLabel).toBe(workspaceLabel);
    expect(result.defaultStageCount).toBe(1);
    expect(Object.values(result.modules).every(Boolean)).toBe(true);
  });

  it("uses a safe generic profile for job types outside the workspace", () => {
    expect(getJobWorkspaceProfile("dryhire")).toMatchObject({
      badgeLabel: "Trabajo",
      workspaceLabel: "Producción del trabajo",
    });
  });

  it("does not read inherited object keys as profiles", () => {
    expect(getJobWorkspaceProfile("constructor")).toMatchObject({
      badgeLabel: "Trabajo",
      workspaceLabel: "Producción del trabajo",
    });
  });
});
