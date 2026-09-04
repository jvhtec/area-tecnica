// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: mockSupabase }));
vi.mock("../useMessagesSubscription", () => ({ useMessagesSubscription: vi.fn() }));

import { useMessagesQuery } from "../useMessagesQuery";
import { useMessagesSubscription } from "../useMessagesSubscription";

describe("useMessagesQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
  });

  it("refetches technician messages when the signed-in user changes", async () => {
    const builders: ReturnType<typeof createMockQueryBuilder>[] = [];
    mockSupabase.from.mockImplementation(() => {
      const builder = createMockQueryBuilder({ data: [], error: null });
      builders.push(builder);
      return builder;
    });
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { rerender } = renderHook(
      ({ userId }) => useMessagesQuery("technician", null, userId),
      { initialProps: { userId: "user-1" }, wrapper },
    );

    await waitFor(() => expect(builders).toHaveLength(1));
    expect(builders[0].eq).toHaveBeenCalledWith("sender_id", "user-1");
    expect(vi.mocked(useMessagesSubscription)).toHaveBeenLastCalledWith("user-1", expect.any(Function));

    rerender({ userId: "user-2" });

    await waitFor(() => expect(builders).toHaveLength(2));
    expect(builders[1].eq).toHaveBeenCalledWith("sender_id", "user-2");
    expect(vi.mocked(useMessagesSubscription)).toHaveBeenLastCalledWith("user-2", expect.any(Function));
  });
});
