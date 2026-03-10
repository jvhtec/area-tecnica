// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createUserProfile } from "@/test/fixtures";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { renderWithProviders } from "@/test/renderWithProviders";

const { useTabVisibilityMock } = vi.hoisted(() => ({
  useTabVisibilityMock: vi.fn(),
}));

vi.mock("@/hooks/useTabVisibility", () => ({
  useTabVisibility: (...args: any[]) => useTabVisibilityMock(...args),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("../UsersListContent", () => ({
  UsersListContent: ({ users, groupBy }: { users: Array<{ first_name?: string | null }>; groupBy?: string | null }) => (
    <div>
      <div>Group by: {groupBy ?? "none"}</div>
      <div>Visible users: {users.map((user) => user.first_name ?? "Unknown").join(", ")}</div>
    </div>
  ),
}));

import { UsersList } from "../UsersList";

describe("UsersList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "manager-1" } } },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderList = (props?: React.ComponentProps<typeof UsersList>) =>
    renderWithProviders(<UsersList {...props} />);

  it("blocks data fetching when the user is not authenticated", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderList();

    expect(await screen.findByText(/please sign in to view users/i)).toBeInTheDocument();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("applies filters, search, sorting, and pagination to the profiles query", async () => {
    const user = userEvent.setup();
    const profilesBuilder = createMockQueryBuilder({
      data: Array.from({ length: 10 }, (_, index) =>
        createUserProfile({
          id: `user-${index + 1}`,
          first_name: `User ${index + 1}`,
          role: "technician",
          department: "sound",
        }),
      ),
      error: null,
      count: 12,
    } as any);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profilesBuilder;
      }

      return createMockQueryBuilder();
    });

    renderList({
      searchQuery: "ana",
      roleFilter: "technician",
      departmentFilter: "sound",
      isManagementUser: true,
    });

    expect(await screen.findByText(/visible users:/i)).toBeInTheDocument();
    expect(profilesBuilder.eq).toHaveBeenCalledWith("role", "technician");
    expect(profilesBuilder.eq).toHaveBeenCalledWith("department", "sound");
    expect(profilesBuilder.or).toHaveBeenCalledWith(
      "first_name.ilike.%ana%,nickname.ilike.%ana%,last_name.ilike.%ana%,email.ilike.%ana%",
    );
    expect(profilesBuilder.order).toHaveBeenCalledWith("first_name", { ascending: true });
    expect(profilesBuilder.range).toHaveBeenCalledWith(0, 9);
    expect(screen.getByText("Total: 12 users")).toBeInTheDocument();

    await user.click(screen.getByText("2"));

    await waitFor(() => {
      expect(profilesBuilder.range).toHaveBeenCalledWith(10, 19);
    });
  });

  it("supports grouping by role and department from the toolbar", async () => {
    const user = userEvent.setup();
    const profilesBuilder = createMockQueryBuilder({
      data: [
        createUserProfile({ id: "user-1", first_name: "Alex", role: "management", department: "sound" }),
        createUserProfile({ id: "user-2", first_name: "Pat", role: "technician", department: "lights" }),
      ],
      error: null,
      count: 2,
    } as any);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profilesBuilder;
      }

      return createMockQueryBuilder();
    });

    renderList();

    expect(await screen.findByText("Group by: none")).toBeInTheDocument();

    const [groupSelect] = screen.getAllByRole("combobox");
    await user.click(groupSelect);
    await user.click(screen.getByRole("option", { name: /by role/i }));
    expect(await screen.findByText("Group by: role")).toBeInTheDocument();

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(screen.getByRole("option", { name: /by department/i }));
    expect(await screen.findByText("Group by: department")).toBeInTheDocument();
  });

  it("shows the empty state when no users match the query", async () => {
    const profilesBuilder = createMockQueryBuilder({
      data: [],
      error: null,
      count: 0,
    } as any);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profilesBuilder;
      }

      return createMockQueryBuilder();
    });

    renderList();

    expect(await screen.findByText(/no users found/i)).toBeInTheDocument();
  });

  it("renders the error state and retries the query", async () => {
    const user = userEvent.setup();
    const profilesBuilder = createMockQueryBuilder({
      data: null,
      error: new Error("boom"),
      count: 0,
    } as any);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profilesBuilder;
      }

      return createMockQueryBuilder();
    });

    renderList();

    expect(
      await screen.findByText(/error loading users: boom/i, undefined, { timeout: 10_000 }),
    ).toBeInTheDocument();

    profilesBuilder.__setResult({
      data: [createUserProfile({ id: "user-1", first_name: "Recovered" })],
      error: null,
      count: 1,
    } as any);

    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText(/visible users: recovered/i)).toBeInTheDocument();
  }, 15_000);
});
