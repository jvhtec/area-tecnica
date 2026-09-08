import { beforeEach, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { createAllFoldersForJob } from "../folders";

beforeEach(() => invoke.mockResolvedValue({ data: { success: true }, error: null }));

it("delegates dry-hire identity to the server-owned job operation", async () => {
  await createAllFoldersForJob({ id: "dryhire-1", job_type: "dryhire", title: "Dry Hire", start_time: "2026-01-01T10:00:00Z", end_time: "2026-01-01T20:00:00Z", timezone: "Europe/Madrid" });
  expect(invoke).toHaveBeenCalledWith("create-flex-folders", { body: { operation: "job", jobId: "dryhire-1", options: undefined } });
});

it("surfaces server reconciliation failures", async () => {
  invoke.mockResolvedValueOnce({ data: { success: false, error: "Reconciliation required" }, error: null });
  await expect(createAllFoldersForJob({ id: "dryhire-2", job_type: "dryhire", title: "Dry Hire", start_time: "2026-01-01T10:00:00Z", end_time: "2026-01-01T20:00:00Z" })).rejects.toThrow("Reconciliation required");
});
