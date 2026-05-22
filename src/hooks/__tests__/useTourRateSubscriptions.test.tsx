// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  type MockChannel = {
    topic: string;
    state: string;
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };

  const channels: MockChannel[] = [];
  const removeChannel = vi.fn(async (channel: MockChannel) => {
    const index = channels.indexOf(channel);
    if (index >= 0) channels.splice(index, 1);
    channel.state = "closed";
    return "ok";
  });

  const channel = vi.fn((name: string) => {
    const mockChannel: MockChannel = {
      topic: `realtime:${name}`,
      state: "closed",
      on: vi.fn(() => mockChannel),
      subscribe: vi.fn(() => {
        mockChannel.state = "joined";
        return mockChannel;
      }),
    };
    channels.push(mockChannel);
    return mockChannel;
  });

  return {
    channels,
    channel,
    removeChannel,
    getChannels: vi.fn(() => channels),
    reset: () => {
      channels.splice(0, channels.length);
      channel.mockClear();
      removeChannel.mockClear();
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: mocks.channel,
    getChannels: mocks.getChannels,
    removeChannel: mocks.removeChannel,
  },
}));

import { resetTourRateSubscriptionsForTests, useTourRateSubscriptions } from "@/hooks/useTourRateSubscriptions";

function Harness(): React.JSX.Element {
  useTourRateSubscriptions();
  return null;
}

const renderHarness = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
      <Harness />
    </QueryClientProvider>,
  );
};

describe("useTourRateSubscriptions", () => {
  beforeEach(() => {
    resetTourRateSubscriptionsForTests();
    mocks.reset();
  });

  afterEach(() => {
    resetTourRateSubscriptionsForTests();
  });

  it("shares one Supabase channel set across multiple mounted consumers", async () => {
    const rendered = renderHarness();

    await waitFor(() => {
      expect(mocks.channel).toHaveBeenCalledTimes(4);
    });

    expect(mocks.channels.map((channel) => channel.topic)).toEqual([
      "realtime:tour-jobs-changes",
      "realtime:job-assignments-changes",
      "realtime:house-tech-rates-changes",
      "realtime:job-rate-extras-changes",
    ]);
    expect(mocks.channels.every((channel) => channel.on.mock.calls.length === 1)).toBe(true);

    rendered.unmount();

    await waitFor(() => {
      expect(mocks.removeChannel).toHaveBeenCalledTimes(4);
    });
  });
});
