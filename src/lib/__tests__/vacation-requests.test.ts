import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

import { vacationRequestsApi } from "../vacation-requests";

describe("vacationRequestsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
  });

  it("throws when submitting a request without an authenticated user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(
      vacationRequestsApi.submitRequest({
        start_date: "2026-06-01",
        end_date: "2026-06-03",
        reason: "Descanso",
      }),
    ).rejects.toThrow("User not authenticated");
  });

  it("submits a vacation request as the current user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "tech-1" } },
      error: null,
    });

    const insertBuilder = createMockQueryBuilder({
      data: { id: "vac-1", technician_id: "tech-1" },
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "vacation_requests") {
        return {
          insert: vi.fn(() => insertBuilder),
        };
      }

      return createMockQueryBuilder();
    });

    const result = await vacationRequestsApi.submitRequest({
      start_date: "2026-06-01",
      end_date: "2026-06-03",
      reason: "Descanso",
    });

    expect(result).toEqual({ id: "vac-1", technician_id: "tech-1" });
    expect(insertBuilder.select).toHaveBeenCalledTimes(1);
    expect(insertBuilder.single).toHaveBeenCalledTimes(1);
  });

  it("loads the current user's requests with descending create order", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "tech-1" } },
      error: null,
    });

    const selectBuilder = createMockQueryBuilder({
      data: [{ id: "vac-1" }],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "vacation_requests") {
        return selectBuilder;
      }

      return createMockQueryBuilder();
    });

    const result = await vacationRequestsApi.getUserRequests();

    expect(result).toEqual([{ id: "vac-1" }]);
    expect(selectBuilder.eq).toHaveBeenCalledWith("technician_id", "tech-1");
    expect(selectBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("loads pending requests and filters by pending status", async () => {
    const selectBuilder = createMockQueryBuilder({
      data: [{ id: "vac-1", status: "pending" }],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "vacation_requests") {
        return selectBuilder;
      }

      return createMockQueryBuilder();
    });

    const result = await vacationRequestsApi.getPendingRequests();

    expect(result).toEqual([{ id: "vac-1", status: "pending" }]);
    expect(selectBuilder.eq).toHaveBeenCalledWith("status", "pending");
    expect(selectBuilder.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("approves requests, stamps the approver, and invokes the decision email function", async () => {
    vi.setSystemTime(new Date("2026-03-10T10:00:00Z"));
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "manager-1" } },
      error: null,
    });

    const updateBuilder = createMockQueryBuilder({
      data: [{ id: "vac-1" }, { id: "vac-2" }],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "vacation_requests") {
        return {
          update: vi.fn(() => updateBuilder),
        };
      }

      return createMockQueryBuilder();
    });

    const result = await vacationRequestsApi.approveRequests(["vac-1", "vac-2"]);

    expect(result).toEqual([{ id: "vac-1" }, { id: "vac-2" }]);
    expect(updateBuilder.in).toHaveBeenCalledWith("id", ["vac-1", "vac-2"]);
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("send-vacation-decision", {
      body: { request_ids: ["vac-1", "vac-2"] },
    });
  });

  it("rejects requests and forwards the rejection reason", async () => {
    vi.setSystemTime(new Date("2026-03-10T10:00:00Z"));
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "manager-1" } },
      error: null,
    });

    const updateBuilder = createMockQueryBuilder({
      data: [{ id: "vac-1" }],
      error: null,
    });

    const updateMock = vi.fn(() => updateBuilder);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "vacation_requests") {
        return {
          update: updateMock,
        };
      }

      return createMockQueryBuilder();
    });

    await vacationRequestsApi.rejectRequests(["vac-1"], "Ya cubierto");

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        approved_by: "manager-1",
        rejection_reason: "Ya cubierto",
      }),
    );
    expect(updateBuilder.in).toHaveBeenCalledWith("id", ["vac-1"]);
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("send-vacation-decision", {
      body: { request_ids: ["vac-1"] },
    });
  });

  it("creates a linked SoundVision access request and message metadata", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "tech-1" } },
      error: null,
    });

    const vacationInsertBuilder = createMockQueryBuilder({
      data: { id: "vac-sv-1" },
      error: null,
    });
    const profileBuilder = createMockQueryBuilder({
      data: { first_name: "Pat", last_name: "Jones" },
      error: null,
    });
    const messageInsertBuilder = createMockQueryBuilder({
      data: null,
      error: null,
    });
    const messageInsertMock = vi.fn(() => messageInsertBuilder);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "vacation_requests") {
        return {
          insert: vi.fn(() => vacationInsertBuilder),
        };
      }
      if (table === "profiles") {
        return profileBuilder;
      }
      if (table === "messages") {
        return {
          insert: messageInsertMock,
        };
      }

      return createMockQueryBuilder();
    });

    const result = await vacationRequestsApi.submitSoundVisionAccessRequest("Necesito revisar un sistema", "sound");

    expect(result).toEqual({ id: "vac-sv-1" });
    expect(profileBuilder.eq).toHaveBeenCalledWith("id", "tech-1");
    expect(messageInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        department: "sound",
        sender_id: "tech-1",
        status: "unread",
        metadata: {
          type: "soundvision_access_request",
          vacation_request_id: "vac-sv-1",
        },
      }),
    );
  });
});
