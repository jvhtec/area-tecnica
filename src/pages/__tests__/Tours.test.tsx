// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { renderWithProviders } from "@/test/renderWithProviders";

const { useOptimizedAuthMock, tourChipsMock } = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
  tourChipsMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/components/dashboard/TourChips", () => ({
  TourChips: (props: any) => {
    tourChipsMock(props);
    return (
      <div>
        <div>Tour chips</div>
        {!props.readOnly && props.onTourClick ? (
          <button type="button" onClick={() => props.onTourClick("tour-1")}>
            Open Tour
          </button>
        ) : (
          <div>Read only tours</div>
        )}
      </div>
    );
  },
}));

import Tours from "../Tours";

describe("Tours", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });
    useOptimizedAuthMock.mockReturnValue({ userRole: "management" });
  });

  const configureProfiles = (toursExpanded: boolean | null | undefined) => {
    const profileBuilder = createMockQueryBuilder({
      data: { tours_expanded: toursExpanded },
      error: null,
    });
    const updateBuilder = createMockQueryBuilder({ data: null, error: null });
    const updateMock = vi.fn(() => updateBuilder);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => profileBuilder),
          update: updateMock,
        };
      }

      return createMockQueryBuilder();
    });

    return { updateMock, updateBuilder };
  };

  it("loads the saved collapsed preference and persists the toggle", async () => {
    const user = userEvent.setup();
    const { updateMock, updateBuilder } = configureProfiles(false);

    renderWithProviders(<Tours />);

    expect(await screen.findByRole("button", { name: /expand tours/i })).toBeInTheDocument();
    expect(screen.queryByText("Tour chips")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /expand tours/i }));

    expect(screen.getByText("Tour chips")).toBeInTheDocument();
    expect(updateMock).toHaveBeenCalledWith({ tours_expanded: true });
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("falls back to expanded tours when the preference is missing and keeps house tech read-only", async () => {
    configureProfiles(undefined);
    useOptimizedAuthMock.mockReturnValue({ userRole: "house_tech" });

    renderWithProviders(<Tours />);

    expect(await screen.findByText("Tour chips")).toBeInTheDocument();
    expect(screen.getByText("Read only tours")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open tour/i })).not.toBeInTheDocument();
  });
});
