// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: mockSupabase }));
vi.mock("@/hooks/useAppBadgeSource", () => ({ useAppBadgeSource: vi.fn() }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => vi.fn(),
}));

import { NotificationBadge } from "../NotificationBadge";

describe("NotificationBadge query scope", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetMockSupabase();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderBadge = async (userDepartment: string | null) => {
    const messageBuilder = createMockQueryBuilder({ data: null, error: null, count: 0 });
    const directBuilder = createMockQueryBuilder({ data: null, error: null, count: 0 });
    mockSupabase.from
      .mockImplementationOnce(() => messageBuilder)
      .mockImplementationOnce(() => directBuilder);

    render(
      <NotificationBadge
        userId="manager-1"
        userRole="management"
        userDepartment={userDepartment}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    return { messageBuilder };
  };

  it("uses sender scope for a management profile without a department", async () => {
    const { messageBuilder: builder } = await renderBadge(null);

    expect(builder.eq).toHaveBeenCalledWith("sender_id", "manager-1");
    expect(builder.eq).not.toHaveBeenCalledWith("department", expect.anything());
  });

  it("uses department scope when management has a department", async () => {
    const { messageBuilder: builder } = await renderBadge("sound");

    expect(builder.eq).toHaveBeenCalledWith("department", "sound");
    expect(builder.eq).not.toHaveBeenCalledWith("sender_id", expect.anything());
  });

  it("does not restart polling whenever loading state changes", async () => {
    await renderBadge("sound");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(mockSupabase.from).toHaveBeenCalledTimes(2);
  });
});
