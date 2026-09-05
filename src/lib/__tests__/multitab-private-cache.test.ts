// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { setPrivateDataIdentity } from "../private-data-scope";
import { MultiTabCoordinator } from "../multitab-coordinator";

vi.mock("@/lib/unified-subscription-manager", () => ({ UnifiedSubscriptionManager: { getInstance: vi.fn() } }));
vi.mock("@/runtime/app-runtime-events", () => ({
  APP_RUNTIME_EVENTS: { HIDDEN: "hidden", VISIBLE: "visible" },
  subscribeAppRuntimeEvent: () => () => {},
}));

class TestChannel {
  static instances: TestChannel[] = [];
  listener: ((event: { data: unknown }) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
  constructor(readonly name: string) { TestChannel.instances.push(this); }
  addEventListener(_type: string, listener: (event: { data: unknown }) => void) { this.listener = listener; }
  receive(data: unknown) { this.listener?.({ data }); }
}

describe("cross-tab private cache isolation", () => {
  let coordinator: MultiTabCoordinator;
  let client: QueryClient;
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    TestChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", TestChannel);
    setPrivateDataIdentity("account-a", "management:sound");
    client = new QueryClient();
    coordinator = MultiTabCoordinator.getInstance(client);
  });
  afterEach(() => {
    coordinator.destroy();
    client.clear();
    setPrivateDataIdentity(null);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("rejects messages from another identity or a legacy unscoped tab", () => {
    const channel = TestChannel.instances.at(-1)!;
    channel.receive({ type: "cache-update", queryKey: ["private"], data: "legacy data", tabId: "other" });
    expect(client.getQueryData(["private"])).toBeUndefined();
    channel.receive({ type: "cache-update", scopeKey: JSON.stringify(["account-b", "management:sound"]), queryKey: ["private"], data: "B data", tabId: "other" });
    expect(client.getQueryData(["private"])).toBeUndefined();
    channel.receive({ type: "cache-update", scopeKey: JSON.stringify(["account-a", "management:sound"]), queryKey: ["private"], data: "A data", tabId: "other" });
    expect(client.getQueryData(["private"])).toBe("A data");
  });

  it("drops buffered broadcasts and late messages from the old account's channel", async () => {
    const oldChannel = TestChannel.instances.at(-1)!;
    client.setQueryData(["private"], "A data");
    setPrivateDataIdentity("account-b", "management:sound");
    client.clear();
    const nextChannel = TestChannel.instances.at(-1)!;
    expect(oldChannel.close).toHaveBeenCalled();
    expect(nextChannel.name).not.toBe(oldChannel.name);
    oldChannel.receive({ type: "cache-update", scopeKey: JSON.stringify(["account-a", "management:sound"]), queryKey: ["private"], data: "late A data", tabId: "other" });
    await vi.advanceTimersByTimeAsync(100);
    expect(client.getQueryData(["private"])).toBeUndefined();
    expect(nextChannel.postMessage.mock.calls.some(([message]) => message.type === "cache-update")).toBe(false);
  });
});
