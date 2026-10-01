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
    state: "closed",
    postgresHandlers: [] as PostgresHandler[],
    statusHandlers: [] as ChannelStatusHandler[],
    on: vi.fn(),
    subscribe: vi.fn(),
    track: vi.fn().mockResolvedValue("ok"),
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
      mockChannel.state = "joined";
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
  it("preserves a healthy sibling channel when only one read model needs repair", async () => {
    const { manager, channels, removeChannel, queryClient } = await setupManager();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    manager.subscribeToTable("logistics_events", ["logistics_events"]);
    const calendar = channels.at(-1)!;
    const aggregate = manager.subscribeToTable("logistics_events", ["transport_driver_assignments"]);
    const failed = channels.at(-1)!;
    failed.state = "errored";

    manager.forceRefreshSubscriptions(["logistics_events"], [aggregate.key]);

    expect(removeChannel).toHaveBeenCalledWith(failed);
    expect(removeChannel).not.toHaveBeenCalledWith(calendar);
    expect(manager.getSubscriptionStatus("logistics_events", ["logistics_events"]).isConnected).toBe(true);
    expect(manager.getSubscriptionStatus("logistics_events", ["transport_driver_assignments"]).isConnected).toBe(true);
    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: ['transport_driver_assignments'] });
  });

  it('does not invalidate or rebuild anything for an empty refresh-key selection', async () => {
    const { manager, removeChannel, queryClient } = await setupManager();
    manager.subscribeToTable('logistics_events', ['calendar']);
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    manager.forceRefreshSubscriptions(['logistics_events', 'unregistered_table'], []);
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(removeChannel).not.toHaveBeenCalled();
  });

  it('keeps table-wide invalidation when no refresh-key filter is supplied', async () => {
    const { manager, queryClient } = await setupManager();
    manager.subscribeToTable('logistics_events', ['calendar']);
    manager.subscribeToTable('logistics_events', ['driver-aggregate']);
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    manager.forceRefreshSubscriptions(['logistics_events', 'unregistered_table']);
    expect(invalidateQueries.mock.calls.map(([options]) => options?.queryKey)).toEqual([
      ['calendar'], ['driver-aggregate'], ['unregistered_table'],
    ]);
  });

  it("checks the required table channel independently of a joined ping channel", async () => {
    const { manager, channels } = await setupManager();
    manager.subscribeToTable("job_assignments", ["optimized-jobs"]);
    const assignments = channels.find((channel) => channel.name.startsWith("job_assignments-"))!;
    expect(channels.find((channel) => channel.name === "ping")?.state).toBe("joined");
    expect(manager.getSubscriptionStatus("job_assignments", ["optimized-jobs"]).isConnected).toBe(true);

    assignments.state = "errored";
    expect(manager.getConnectionStatus()).toBe("connected");
    expect(manager.getSubscriptionStatus("job_assignments", ["optimized-jobs"]).isConnected).toBe(false);
    assignments.state = "joining";
    expect(manager.getSubscriptionStatus("job_assignments", ["optimized-jobs"]).isConnected).toBe(false);
    assignments.state = "joined";
    expect(manager.getSubscriptionStatus("job_assignments", ["optimized-jobs"]).isConnected).toBe(true);
    expect(manager.getSubscriptionStatus("job_assignments", ["other-model"]).isConnected).toBe(false);
  });
  it("deduplicates query keys with equivalent object properties in a different order", async () => {
    const { manager, channels } = await setupManager();

    manager.subscribeToTable(
      "festival_artists",
      ["festival-artists", { festivalId: "festival-1", filters: { status: "active", sort: "name" } }],
      undefined,
      "medium",
    );
    manager.subscribeToTable(
      "festival_artists",
      ["festival-artists", { filters: { sort: "name", status: "active" }, festivalId: "festival-1" }],
      undefined,
      "medium",
    );

    const artistChannels = channels.filter((mockChannel) =>
      mockChannel.name.startsWith("festival_artists-"),
    );
    expect(artistChannels).toHaveLength(1);
  });

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

  it("refetches at once on a colleague's change and coalesces a burst into one trailing refetch", async () => {
    vi.useFakeTimers();
    const { manager, queryClient, channels } = await setupManager();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    manager.subscribeToTable("job_assignments", ["job-assignments"], undefined, "medium");
    const channel = channels.find((mockChannel) => mockChannel.name.startsWith("job_assignments-"));
    const emit = () =>
      channel?.postgresHandlers[0]({ eventType: "UPDATE", table: "job_assignments", new: { id: "a" } });

    emit();
    // No waiting: the first change refetches immediately.
    expect(invalidateQueries).toHaveBeenCalledTimes(1);

    // A burst inside the window adds exactly one trailing refetch.
    emit();
    emit();
    emit();
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(300);
    expect(invalidateQueries).toHaveBeenCalledTimes(2);

    // Quiet after that: the next change is immediate again.
    await vi.advanceTimersByTimeAsync(300);
    emit();
    expect(invalidateQueries).toHaveBeenCalledTimes(3);
  });
});
