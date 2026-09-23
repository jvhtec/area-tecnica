import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../deps.ts";
import type { PushPayload } from "../types.ts";

const mocks = vi.hoisted(() => ({
  routes: vi.fn(),
  push: vi.fn(),
  inbox: vi.fn(),
  roles: vi.fn(),
}));

vi.mock("../transportRequestEmail.ts", () => ({ sendTransportRequestEmail: vi.fn() }));
vi.mock("../data.ts", () => ({
  getAdminUserIds: async () => [], getManagementUserIds: async () => [],
  getSoundDepartmentUserIds: async () => [], getJobParticipantUserIds: async () => [],
  getManagementByDepartmentUserIds: async () => [],
  getJobTitle: async () => "Gala", getJobDepartment: async () => "sound",
  getJobType: async () => "single", getProfileDisplayName: async () => "Coordinación",
  getTourName: async () => null,
  getProfileRoles: mocks.roles,
}));
vi.mock("../routing.ts", () => ({
  getPushNotificationRoutes: async () => [], applyRoutingOverrides: async () => undefined,
}));
vi.mock("../broadcast/eventRouter.ts", () => ({ routeBroadcastEvent: mocks.routes }));
vi.mock("../broadcast/recipients.ts", () => ({ getScopedManagementIds: async () => [] }));
vi.mock("../broadcast/staffingRouting.ts", () => ({
  isStaffingEventCode: () => false, resolveStaffingDepartment: async () => null,
  filterStaffingRoutesForDepartment: async () => [], getStaffingRoutingManagementIds: async () => [],
}));
vi.mock("../broadcast/delivery.ts", () => ({
  loadPushSubscriptions: async () => ({ subscriptions: [], error: null }),
  loadNativeTokens: async () => ({
    tokens: [
      { device_token: "mgmt-device", user_id: "manager-1" },
      { device_token: "tech-device", user_id: "tech-1" },
    ],
    error: null,
  }),
  sendPayloadToTargets: mocks.push,
}));
vi.mock("../inbox.ts", () => ({
  claimInboxItems: mocks.inbox,
  recordAttemptResult: async () => undefined,
  recordDeliveryOutcomes: async () => undefined,
}));
vi.mock("../notificationPolicy.ts", () => ({
  buildEventKey: async () => "event-key",
  urgencyForEvent: () => "normal",
  decoratePayloadPolicy: (payload: unknown) => payload,
  loadRecipientPreferences: async (_client: unknown, userIds: string[]) => new Map(
    userIds.map((userId) => [userId, { accountEnabled: true, categoryEnabled: true, quietNow: false, muted: false }]),
  ),
}));
// urls.ts imports config.ts, which reads Deno env at import time.
vi.mock("../config.ts", () => ({ EVENT_TYPES: { JOB_UPDATED: "job.updated" } }));

import { handleBroadcast } from "../broadcast.ts";

type PayloadResolver = (userId: string | undefined) => PushPayload;

describe("per-recipient notification destinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roles.mockResolvedValue(new Map([["manager-1", "management"], ["tech-1", "technician"]]));
    mocks.routes.mockImplementation(async (context) => {
      context.state.title = "Trabajo actualizado";
      context.audience.clearAllRecipients();
      context.audience.addNaturalRecipients(["manager-1", "tech-1"]);
      return true;
    });
    mocks.inbox.mockImplementation(async (_client: unknown, recipientIds: string[]) =>
      new Map(recipientIds.map((userId) => [userId, `inbox-${userId}`])));
    mocks.push.mockResolvedValue([{ ok: true }]);
  });

  it("sends management to the job page and freelancers to the job in the tech app", async () => {
    await handleBroadcast({} as SupabaseClient, "manager-1", {
      action: "broadcast", type: "job.updated", job_id: "job-1",
    });

    const resolvePush = mocks.push.mock.calls[0][3] as PayloadResolver;
    expect(resolvePush("manager-1").url).toBe("/festival-management/job-1?singleJob=true");
    expect(resolvePush("tech-1").url).toBe("/tech-app?tab=jobs&jobId=job-1&open=details");

    // The durable inbox row carries the same per-recipient link as the push.
    const resolveInbox = mocks.inbox.mock.calls[0][4] as PayloadResolver;
    expect(resolveInbox("tech-1").url).toBe("/tech-app?tab=jobs&jobId=job-1&open=details");
    expect(resolveInbox("manager-1").url).toBe("/festival-management/job-1?singleJob=true");
  });

  it("keeps the shared link when roles cannot be looked up", async () => {
    mocks.roles.mockResolvedValue(new Map());
    await handleBroadcast({} as SupabaseClient, "manager-1", {
      action: "broadcast", type: "job.updated", job_id: "job-1",
    });
    const resolvePush = mocks.push.mock.calls[0][3] as PayloadResolver;
    expect(resolvePush("tech-1").url).toBe("/festival-management/job-1?singleJob=true");
  });
});
