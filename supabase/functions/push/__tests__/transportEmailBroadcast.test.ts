import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../deps.ts";

const mocks = vi.hoisted(() => ({
  email: vi.fn(),
  routes: vi.fn(),
  subscriptions: vi.fn(),
  native: vi.fn(),
  push: vi.fn(),
}));

vi.mock("../transportRequestEmail.ts", () => ({ sendTransportRequestEmail: mocks.email }));
vi.mock("../data.ts", () => ({
  getAdminUserIds: async () => [], getManagementUserIds: async () => [],
  getSoundDepartmentUserIds: async () => [], getJobParticipantUserIds: async () => [],
  getManagementByDepartmentUserIds: async () => [],
  getJobTitle: async () => "Auditorio", getJobDepartment: async () => "sound",
  getJobType: async () => "single", getProfileDisplayName: async () => "Solicitante",
  getTourName: async () => null,
}));
vi.mock("../routing.ts", () => ({
  getPushNotificationRoutes: async () => [], applyRoutingOverrides: async () => undefined,
}));
vi.mock("../urls.ts", () => ({
  validateInternalUrl: () => undefined, resolveNotificationUrl: () => "/logistics",
}));
vi.mock("../broadcast/eventRouter.ts", () => ({ routeBroadcastEvent: mocks.routes }));
vi.mock("../broadcast/recipients.ts", () => ({ getScopedManagementIds: async () => [] }));
vi.mock("../broadcast/staffingRouting.ts", () => ({
  isStaffingEventCode: () => false, resolveStaffingDepartment: async () => null,
  filterStaffingRoutesForDepartment: async () => [], getStaffingRoutingManagementIds: async () => [],
}));
vi.mock("../broadcast/delivery.ts", () => ({
  loadPushSubscriptions: mocks.subscriptions, loadNativeTokens: mocks.native,
  sendPayloadToTargets: mocks.push,
}));
vi.mock("../inbox.ts", () => ({
  claimInboxItems: async (_client: unknown, recipientIds: string[]) =>
    new Map(recipientIds.map((userId) => [userId, `inbox-${userId}`])),
  recordAttemptResult: async () => undefined,
  recordDeliveryOutcomes: async () => undefined,
}));
vi.mock("../notificationPolicy.ts", () => ({
  buildEventKey: async () => "event-key",
  urgencyForEvent: () => "normal",
  decoratePayloadPolicy: (payload: unknown) => payload,
  loadRecipientPreferences: async (_client: unknown, userIds: string[]) => new Map(
    userIds.map((userId) => [userId, {
      accountEnabled: true,
      categoryEnabled: true,
      quietNow: false,
      muted: false,
    }]),
  ),
}));

import { handleBroadcast } from "../broadcast.ts";

const client = {} as SupabaseClient;
const body = { action: "broadcast" as const, type: "logistics.transport.requested", request_id: "request-id" };

describe("transport email alongside push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.email.mockResolvedValue({ status: "sent", sent: 1, failed: 0, skipped: 0 });
    mocks.routes.mockResolvedValue(true);
    mocks.subscriptions.mockResolvedValue({ subscriptions: [], error: null });
    mocks.native.mockResolvedValue({ tokens: [], error: null });
    mocks.push.mockResolvedValue([{ ok: true }]);
  });

  it("emails even when push routing leaves no recipients", async () => {
    mocks.routes.mockImplementation(async (context) => { context.audience.clearAllRecipients(); return true; });
    const response = await handleBroadcast(client, "creator-id", body);
    expect(mocks.email).toHaveBeenCalledWith(client, "creator-id", "request-id");
    expect(await response.json()).toMatchObject({ reason: "No recipients", email: { sent: 1 } });
    expect(mocks.subscriptions).not.toHaveBeenCalled();
  });

  it("emails even when users have no web or native subscriptions", async () => {
    const response = await handleBroadcast(client, "creator-id", body);
    expect(await response.json()).toMatchObject({ reason: "no_registered_devices", email: { sent: 1 } });
    expect(mocks.email).toHaveBeenCalledOnce();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("preserves push delivery when the email provider fails", async () => {
    mocks.email.mockResolvedValue({ status: "failed", sent: 0, failed: 1, skipped: 0 });
    mocks.native.mockResolvedValue({ tokens: [{ device_token: "native-token", user_id: "creator-id" }], error: null });
    const response = await handleBroadcast(client, "creator-id", body);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "accepted", outcomes: { accepted: 1 }, email: { status: "failed" } });
    expect(mocks.push).toHaveBeenCalledOnce();
  });

  it("starts push delivery without waiting for a slow mail provider", async () => {
    // The email only resolves once push has been sent; awaiting it first would deadlock.
    let releaseEmail = () => {};
    mocks.email.mockImplementation(() => new Promise((resolve) => {
      releaseEmail = () => resolve({ status: "sent", sent: 1, failed: 0, skipped: 0 });
    }));
    mocks.native.mockResolvedValue({ tokens: [{ device_token: "native-token", user_id: "creator-id" }], error: null });
    mocks.push.mockImplementation(async () => { releaseEmail(); return [{ ok: true }]; });
    const response = await handleBroadcast(client, "creator-id", body);
    expect(await response.json()).toMatchObject({ status: "accepted", email: { sent: 1 } });
  });

  it("keeps push delivery when the email path rejects outright", async () => {
    mocks.email.mockRejectedValue(new Error("provider exploded"));
    mocks.native.mockResolvedValue({ tokens: [{ device_token: "native-token", user_id: "creator-id" }], error: null });
    const response = await handleBroadcast(client, "creator-id", body);
    expect(await response.json()).toMatchObject({
      status: "accepted", outcomes: { accepted: 1 }, email: { status: "skipped", reason: "unexpected_error" },
    });
    expect(mocks.push).toHaveBeenCalledOnce();
  });

  it("does not email on unrelated logistics events", async () => {
    const response = await handleBroadcast(client, "creator-id", { ...body, type: "logistics.event.updated" });
    expect(mocks.email).not.toHaveBeenCalled();
    expect(await response.json()).not.toHaveProperty("email");
  });
});
