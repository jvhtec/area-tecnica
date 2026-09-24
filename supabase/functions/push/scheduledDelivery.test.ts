import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimInboxItems: vi.fn(),
  recordDeliveryResults: vi.fn(),
  loadNativeTokens: vi.fn(),
  sendPayloadToTargets: vi.fn(),
  loadRecipientPreferences: vi.fn(),
}));

vi.mock("./inbox.ts", () => ({
  claimInboxItems: mocks.claimInboxItems,
  recordDeliveryResults: mocks.recordDeliveryResults,
}));
vi.mock("./broadcast/delivery.ts", () => ({
  loadNativeTokens: mocks.loadNativeTokens,
  sendPayloadToTargets: mocks.sendPayloadToTargets,
}));
vi.mock("./notificationPolicy.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./notificationPolicy.ts")>()),
  loadRecipientPreferences: mocks.loadRecipientPreferences,
}));

import {
  addOutcome,
  deliverScheduledToUser,
  emptyTally,
  isScheduledRunSuccessful,
} from "./scheduledDelivery.ts";
import type { BroadcastBody } from "./types.ts";

const body: BroadcastBody = {
  action: "broadcast",
  type: "job.shift.reminder",
  event_id: "2026-09-23:20:00:00",
  recipient_id: "tech-1",
};
const message = { title: "Mañana: Gala", body: "Citación 09:00", url: "/tech-app" };

function clientWithSubscriptions(rows: unknown[], error: unknown = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    returns: async () => ({ data: rows, error }),
  };
  return { from: vi.fn(() => chain) } as never;
}

const allowAll = () => new Map([["tech-1", {
  accountEnabled: true, categoryEnabled: true, quietNow: false, muted: false,
}]]);

describe("deliverScheduledToUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimInboxItems.mockResolvedValue(new Map([["tech-1", "inbox-1"]]));
    mocks.loadRecipientPreferences.mockResolvedValue(allowAll());
    mocks.loadNativeTokens.mockResolvedValue({ tokens: [], error: null });
  });

  it("keys the inbox row by the scheduler occurrence so retries reuse it", async () => {
    const client = clientWithSubscriptions([{ endpoint: "e", p256dh: "p", auth: "a" }]);
    mocks.sendPayloadToTargets.mockResolvedValue([{ endpoint: "x", ok: true, attempts: 1, channel: "webpush" }]);

    const outcome = await deliverScheduledToUser(client, "tech-1", body, message);

    expect(outcome).toEqual(expect.objectContaining({ status: "delivered", sent: true }));
    expect(mocks.claimInboxItems.mock.calls[0][2]).toBe("job.shift.reminder:2026-09-23:20:00:00");
    // includeRetryable: a leased retry reclaims pending/failed rows.
    expect(mocks.claimInboxItems.mock.calls[0][6]).toBe(true);
    expect(mocks.sendPayloadToTargets.mock.calls[0][3]).toEqual(expect.objectContaining({
      title: "Mañana: Gala",
      url: "/tech-app",
    }));
  });

  it("does nothing more for an occurrence already delivered to this user", async () => {
    mocks.claimInboxItems.mockResolvedValue(new Map());
    const outcome = await deliverScheduledToUser(clientWithSubscriptions([]), "tech-1", body, message);
    expect(outcome).toEqual({ status: "duplicate" });
    expect(mocks.loadRecipientPreferences).not.toHaveBeenCalled();
  });

  it("honours an opt-out and records it as skipped", async () => {
    mocks.loadRecipientPreferences.mockResolvedValue(new Map([["tech-1", {
      accountEnabled: true, categoryEnabled: false, quietNow: false, muted: false,
    }]]));
    const outcome = await deliverScheduledToUser(clientWithSubscriptions([]), "tech-1", body, message);
    expect(outcome).toEqual({ status: "skipped" });
    expect(mocks.recordDeliveryResults).toHaveBeenCalledWith(expect.anything(), expect.any(Map), [], ["tech-1"]);
    expect(mocks.sendPayloadToTargets).not.toHaveBeenCalled();
  });

  it("marks a failed preference lookup as retryable instead of assuming opt-in", async () => {
    mocks.loadRecipientPreferences.mockRejectedValue(new Error("db down"));
    const outcome = await deliverScheduledToUser(clientWithSubscriptions([]), "tech-1", body, message);
    expect(outcome).toEqual({ status: "failed" });
    expect(mocks.recordDeliveryResults).toHaveBeenCalledWith(expect.anything(), expect.any(Map), [], [], ["tech-1"]);
  });

  it("treats a user with no devices as a terminal skip", async () => {
    const outcome = await deliverScheduledToUser(clientWithSubscriptions([]), "tech-1", body, message);
    expect(outcome).toEqual({ status: "skipped" });
  });
});

describe("scheduled run tally", () => {
  it("succeeds with no provider attempts, or with at least one accepted user", () => {
    const quiet = emptyTally();
    addOutcome(quiet, { status: "skipped" });
    expect(isScheduledRunSuccessful(quiet)).toBe(true);

    const rejected = emptyTally();
    addOutcome(rejected, { status: "delivered", sent: false, results: [{ endpoint: "x", ok: false, attempts: 3 }] });
    expect(isScheduledRunSuccessful(rejected)).toBe(false);

    addOutcome(rejected, { status: "delivered", sent: true, results: [{ endpoint: "y", ok: true, attempts: 1 }] });
    expect(isScheduledRunSuccessful(rejected)).toBe(true);
  });

  it("fails the run on any operational failure so it is retried", () => {
    const tally = emptyTally();
    addOutcome(tally, { status: "delivered", sent: true, results: [{ endpoint: "y", ok: true, attempts: 1 }] });
    addOutcome(tally, { status: "failed" });
    expect(isScheduledRunSuccessful(tally)).toBe(false);
  });
});
