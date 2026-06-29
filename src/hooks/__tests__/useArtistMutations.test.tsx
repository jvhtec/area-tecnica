// @vitest-environment jsdom
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { useArtistMutations } from "@/hooks/useArtistMutations";

const createWrapper = () => {
  const queryClient = createTestQueryClient();

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useArtistMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("normalizes empty artist time fields when creating an artist", async () => {
    const insertBuilder = createMockQueryBuilder({
      data: { id: "artist-1", name: "Main Act" },
      error: null,
    });
    mockSupabase.from.mockReturnValue(insertBuilder);

    const { result } = renderHook(() => useArtistMutations("job-1", "2026-06-29"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.createArtist({
        name: "Main Act",
        show_start: "",
        show_end: "23:00",
        soundcheck_start: "",
      });
    });

    await waitFor(() => {
      expect(insertBuilder.insert).toHaveBeenCalledWith([
        {
          name: "Main Act",
          show_start: null,
          show_end: "23:00",
          soundcheck_start: null,
          job_id: "job-1",
        },
      ]);
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Success",
      description: "Artist created successfully",
    });
  });

  it("normalizes empty artist time fields when updating an artist", async () => {
    const updateBuilder = createMockQueryBuilder({
      data: { id: "artist-1", name: "Main Act Updated" },
      error: null,
    });
    mockSupabase.from.mockReturnValue(updateBuilder);

    const { result } = renderHook(() => useArtistMutations("job-1", "2026-06-29"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.updateArtist({
        id: "artist-1",
        name: "Main Act Updated",
        show_end: "",
        soundcheck_end: "18:00",
      });
    });

    await waitFor(() => {
      expect(updateBuilder.update).toHaveBeenCalledWith({
        name: "Main Act Updated",
        show_end: null,
        soundcheck_end: "18:00",
      });
    });
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "artist-1");
    expect(toastMock).toHaveBeenCalledWith({
      title: "Success",
      description: "Artist updated successfully",
    });
  });

  it("surfaces Supabase error messages in create failure toasts", async () => {
    const insertBuilder = createMockQueryBuilder({
      data: null,
      error: { message: "Festival artist insert failed" },
    });
    mockSupabase.from.mockReturnValue(insertBuilder);

    const { result } = renderHook(() => useArtistMutations("job-1", "2026-06-29"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.createArtist({ name: "Main Act" });
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Error",
        description: "Could not create artist: Festival artist insert failed",
        variant: "destructive",
      });
    });
  });
});
