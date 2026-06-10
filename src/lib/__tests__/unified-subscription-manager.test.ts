// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

type PostgresHandler = (payload: Record<string, unknown>) => void;
type ChannelStatusHandler = (status: string) => void;

const setupManager = async () => {
  vi.resetModules();

  const channels: Array<ReturnType<typeof createChannel>> = [];
  const removeChannel = vi.fn();
  const channel = vi.fn((name: string) => {
    const mockChannel = createChannel(name);
    channels.push(mockChannel);
    return mockChannel;
  });

  vi.doMock("@/lib/supabase", () => ({
    supabase: {
      channel,
      removeChannel,
    },
  }));

  const { UnifiedSubscriptionManager } = await import("@/lib/unified-subscription-manager");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    manager: UnifiedSubscriptionManager.getInstance(queryClient),
    queryClient,
    channels,
    removeChannel,
  };
};

const createChannel = (name: string) => {
  const mockChannel = {
    name,
    postgresHandlers: [] as PostgresHandler[],
    statusHandlers: [] as ChannelStatusHandler[],
    on: vi.fn(),
    subscribe: vi.fn(),
  };

  mockChannel.on.mockImplementation(
    (event: string, _config: unknown, callback: PostgresHandler) => {
      if (event === "postgres_changes") {
        mockChannel.postgresHandlers.push(callback);
      }
      return mockChannel;
    },
  );

  mockChannel.subscribe.mockImplementation((callback?: (status: string) => void) => {
    if (callback) {
      mockChannel.statusHandlers.push(callback);
      callback("SUBSCRIBED");
    }
    return mockChannel;
  });

  return mockChannel;
};

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("UnifiedSubscriptionManager", () => {
  it("deduplicates channels while cleaning up owner-scoped payload handlers", async () => {
    const { manager, channels, removeChannel } = await setupManager();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    manager.subscribeToTable(
      "staffing_requests",
      ["staffing-realtime", "requests"],
      undefined,
      "high",
      {
        ownerRoute: "/matrix:first",
        onPayload: firstHandler,
        invalidateOnPayload: false,
      },
    );
    manager.subscribeToTable(
      "staffing_requests",
      ["staffing-realtime", "requests"],
      undefined,
      "high",
      {
        ownerRoute: "/matrix:second",
        onPayload: secondHandler,
        invalidateOnPayload: false,
      },
    );

    const staffingChannels = channels.filter((mockChannel) =>
      mockChannel.name.startsWith("staffing_requests-"),
    );
    expect(staffingChannels).toHaveLength(1);

    const [postgresHandler] = staffingChannels[0].postgresHandlers;
    postgresHandler({ eventType: "INSERT", table: "staffing_requests", new: { id: "req-1" } });

    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledTimes(1);

    manager.cleanupRouteDependentSubscriptions("/matrix:first");
    postgresHandler({ eventType: "UPDATE", table: "staffing_requests", new: { id: "req-1" } });

    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledTimes(2);
    expect(removeChannel).not.toHaveBeenCalledWith(staffingChannels[0]);

    manager.cleanupRouteDependentSubscriptions("/matrix:second");

    expect(removeChannel).toHaveBeenCalledWith(staffingChannels[0]);
  });

  it("restores payload handlers when subscriptions are reestablished", async () => {
    const { manager, channels } = await setupManager();
    const handler = vi.fn();

    manager.subscribeToTable(
      "staffing_events",
      ["staffing-realtime", "events"],
      undefined,
      "high",
      {
        ownerRoute: "/matrix:staffing",
        onPayload: handler,
        invalidateOnPayload: false,
      },
    );

    const firstStaffingChannel = channels.find((mockChannel) =>
      mockChannel.name.startsWith("staffing_events-"),
    );
    firstStaffingChannel?.postgresHandlers[0]({
      eventType: "INSERT",
      table: "staffing_events",
      new: { id: "evt-1" },
    });

    expect(handler).toHaveBeenCalledTimes(1);

    manager.reestablishSubscriptions();

    const staffingChannels = channels.filter((mockChannel) =>
      mockChannel.name.startsWith("staffing_events-"),
    );
    const reestablishedChannel = staffingChannels[staffingChannels.length - 1];
    reestablishedChannel.postgresHandlers[0]({
      eventType: "UPDATE",
      table: "staffing_events",
      new: { id: "evt-1" },
    });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("preserves payload handlers and invalidation settings when channel retries resubscribe", async () => {
    vi.useFakeTimers();
    const { manager, queryClient, channels, removeChannel } = await setupManager();
    const handler = vi.fn();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    manager.subscribeToTable(
      "staffing_requests",
      ["staffing-realtime", "requests"],
      undefined,
      "high",
      {
        ownerRoute: "/matrix:staffing",
        onPayload: handler,
        invalidateOnPayload: false,
      },
    );

    const firstStaffingChannel = channels.find((mockChannel) =>
      mockChannel.name.startsWith("staffing_requests-"),
    );
    firstStaffingChannel?.statusHandlers[0]?.("CHANNEL_ERROR");

    await vi.advanceTimersByTimeAsync(5000);

    expect(removeChannel).toHaveBeenCalledWith(firstStaffingChannel);

    const staffingChannels = channels.filter((mockChannel) =>
      mockChannel.name.startsWith("staffing_requests-"),
    );
    const retriedChannel = staffingChannels[staffingChannels.length - 1];

    retriedChannel.postgresHandlers[0]({
      eventType: "UPDATE",
      table: "staffing_requests",
      new: { id: "req-1" },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).not.toHaveBeenCalled();

    manager.cleanupRouteDependentSubscriptions("/matrix:staffing");

    expect(removeChannel).toHaveBeenCalledWith(retriedChannel);
  });

  it("preserves payload handlers and invalidation settings when subscriptions are force refreshed", async () => {
    const { manager, queryClient, channels, removeChannel } = await setupManager();
    const handler = vi.fn();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    manager.subscribeToTable(
      "staffing_requests",
      ["staffing-realtime", "requests"],
      undefined,
      "high",
      {
        ownerRoute: "/matrix:staffing",
        onPayload: handler,
        invalidateOnPayload: false,
      },
    );

    const firstStaffingChannel = channels.find((mockChannel) =>
      mockChannel.name.startsWith("staffing_requests-"),
    );

    manager.forceRefreshSubscriptions(["staffing_requests"]);
    invalidateQueries.mockClear();

    expect(removeChannel).toHaveBeenCalledWith(firstStaffingChannel);

    const staffingChannels = channels.filter((mockChannel) =>
      mockChannel.name.startsWith("staffing_requests-"),
    );
    const refreshedChannel = staffingChannels[staffingChannels.length - 1];

    refreshedChannel.postgresHandlers[0]({
      eventType: "UPDATE",
      table: "staffing_requests",
      new: { id: "req-1" },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).not.toHaveBeenCalled();

    manager.cleanupRouteDependentSubscriptions("/matrix:staffing");

    expect(removeChannel).toHaveBeenCalledWith(refreshedChannel);
  });
});
