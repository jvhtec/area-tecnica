import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  events: [] as string[],
  createTourRootFolders: vi.fn(),
  failingInsert: "" as string,
}));

vi.mock("@/hooks/useLocationManagement", () => ({
  useLocationManagement: () => ({ getOrCreateLocation: vi.fn().mockResolvedValue("location-1") }),
}));

vi.mock("@/utils/tourFolders", () => ({
  createTourRootFolders: state.createTourRootFolders,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
    from: (table: string) => ({
      insert: (payload: unknown) => {
        state.events.push(`insert:${table}`);
        const error = state.failingInsert === table ? new Error(`${table} failed`) : null;
        if (table === "tours") return { select: () => ({ single: async () => ({ data: { id: "tour-1", name: "Tour" }, error }) }) };
        if (table === "tour_dates") return { select: () => ({ single: async () => ({ data: { id: "date-1" }, error }) }) };
        if (table === "jobs") return { select: () => ({ single: async () => ({ data: { id: "job-1" }, error }) }) };
        return Promise.resolve({ data: payload, error });
      },
      delete: () => ({ eq: async () => {
        state.events.push(`delete:${table}`);
        return { error: null };
      } }),
    }),
  },
}));

import { useTourCreationMutation } from "./useTourCreationMutation";

describe("useTourCreationMutation provisioning order", () => {
  beforeEach(() => {
    state.events.length = 0;
    state.failingInsert = "";
    state.createTourRootFolders.mockReset().mockImplementation(async () => {
      state.events.push("provision:tour-root");
      return { success: true };
    });
  });

  it("persists selected departments before invoking canonical root provisioning", async () => {
    await useTourCreationMutation().createTourWithDates({
      title: "Test Tour",
      description: "",
      dates: [{ date: "2026-08-30", location: "Madrid" }],
      color: "#000000",
      departments: ["sound"],
    });

    expect(state.events).toEqual([
      "insert:tours",
      "insert:tour_dates",
      "insert:jobs",
      "insert:job_departments",
      "insert:job_date_types",
      "provision:tour-root",
    ]);
  });

  it("keeps the created tour when remote provisioning needs recovery", async () => {
    state.createTourRootFolders.mockResolvedValue({ success: false, error: "needs reconciliation" });
    await expect(useTourCreationMutation().createTourWithDates({
      title: "Test Tour",
      description: "",
      dates: [{ date: "2026-08-30", location: "" }],
      color: "#000000",
      departments: ["sound"],
    })).rejects.toThrow("needs reconciliation");
    expect(state.events).not.toContain("delete:tours");
  });

  it("removes the incomplete tour when local persistence fails", async () => {
    state.failingInsert = "job_departments";
    await expect(useTourCreationMutation().createTourWithDates({
      title: "Test Tour",
      description: "",
      dates: [{ date: "2026-08-30", location: "Madrid" }],
      color: "#000000",
      departments: ["sound"],
    })).rejects.toThrow("job_departments failed");
    expect(state.events).toContain("delete:tours");
    expect(state.events).not.toContain("provision:tour-root");
  });
});
