import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import { createDryhireYearFolders } from "../dryhireFolderService";

describe("createDryhireYearFolders", () => {
  beforeEach(() => invoke.mockReset().mockResolvedValue({ data: { success: true }, error: null }));

  it("uses the durable server year operation", async () => {
    await createDryhireYearFolders(2027);
    expect(invoke).toHaveBeenCalledWith("create-flex-folders", {
      body: { operation: "dryhire-year", year: 2027 },
    });
  });

  it("does not report reconciliation outcomes as success", async () => {
    invoke.mockResolvedValue({ data: { success: false, status: "needs_reconciliation" }, error: null });
    await expect(createDryhireYearFolders(2027)).rejects.toThrow("requiere reconciliación");
  });
});
