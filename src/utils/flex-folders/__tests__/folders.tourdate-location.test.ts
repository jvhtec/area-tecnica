import { beforeEach, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { createAllFoldersForJob } from "../folders";

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { success: true }, error: null });
});

it("delegates tour-date identity and normalized selection to the server", async () => {
  await createAllFoldersForJob({ id: "tour-job-1", job_type: "tourdate", title: "Date", start_time: "2026-09-08T10:00:00Z", end_time: "2026-09-08T20:00:00Z", tour_id: "tour-1", tour_date_id: "date-1", location_data: { name: "Madrid" } }, "ignored", "ignored", "ignored", { sound: { subfolders: ["documentacionTecnica"] } });
  expect(invoke).toHaveBeenCalledWith("create-flex-folders", { body: { operation: "tour-date", jobId: "tour-job-1", options: { sound: { subfolders: ["documentacionTecnica"] } } } });
});

it("does not send client-controlled location or parent metadata", async () => {
  await createAllFoldersForJob({ id: "tour-job-2", job_type: "tourdate", title: "Date", start_time: "2026-09-08T10:00:00Z", end_time: "2026-09-08T20:00:00Z", tour_id: "tour-1", tour_date_id: "date-2", location_data: { name: "Untrusted" } }, "ignored", "ignored", "ignored");
  expect(invoke.mock.calls[0][1].body).toEqual({ operation: "tour-date", jobId: "tour-job-2", options: undefined });
});
