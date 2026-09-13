import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal stand-in for the Supabase client: `rpc` reads `this.rest`, exactly like
// SupabaseClient.prototype.rpc does, so a detached reference blows up the same way.
const rpcCalls: Array<{ name: string; args: Record<string, unknown> | undefined }> = [];
let rpcResult: { data: unknown; error: { message?: string } | null } = { data: [], error: null };

const fakeClient = {
  rest: { marker: "postgrest" },
  rpc(this: { rest: unknown }, name: string, args?: Record<string, unknown>) {
    // Throws "Cannot read properties of undefined (reading 'rest')" when unbound.
    void (this.rest as { marker: string }).marker;
    rpcCalls.push({ name, args });
    return Promise.resolve(rpcResult);
  },
};

vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: fakeClient }));

const {
  listTransportRequests,
  saveTransportRequest,
  scheduleTransportRequest,
  setTransportRequestStage,
} = await import("../transportRequests");

describe("transport request RPCs", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    rpcResult = { data: [], error: null };
  });

  it("keeps the client as the receiver so rpc() can reach this.rest", async () => {
    await expect(listTransportRequests()).resolves.toEqual([]);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("list_transport_requests");
  });

  it("passes inbox filters through to list_transport_requests", async () => {
    await listTransportRequests({ jobId: "job-1", department: "sound", includeClosed: true });
    expect(rpcCalls[0].args).toEqual({
      p_job_id: "job-1",
      p_department: "sound",
      p_include_closed: true,
    });
  });

  it("defaults optional request fields instead of sending undefined", async () => {
    rpcResult = { data: "req-1", error: null };
    await expect(
      saveTransportRequest({
        jobId: "job-1",
        department: "production",
        items: [{ transport_type: "trailer", leftover_space_meters: null }],
      }),
    ).resolves.toBe("req-1");
    expect(rpcCalls[0].args).toMatchObject({
      p_request_id: null,
      p_movement_type: "transfer",
      p_priority: "normal",
      p_is_hoja_relevant: true,
      p_source_type: "manual",
    });
  });

  it("surfaces RPC errors as thrown Errors", async () => {
    rpcResult = { data: null, error: { message: "Permission denied" } };
    await expect(setTransportRequestStage("req-1", "completed")).rejects.toThrow("Permission denied");
  });

  it("sends the full load/unload pair when scheduling", async () => {
    rpcResult = { data: null, error: null };
    await scheduleTransportRequest({
      requestId: "req-1",
      loadDate: "2026-09-20",
      loadTime: "09:00",
      unloadDate: "2026-09-21",
      unloadTime: "18:00",
    });
    expect(rpcCalls[0].name).toBe("schedule_transport_request");
    expect(rpcCalls[0].args).toMatchObject({
      p_request_id: "req-1",
      p_load_date: "2026-09-20",
      p_unload_time: "18:00",
      p_provider: null,
    });
  });
});
