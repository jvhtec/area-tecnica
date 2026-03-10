// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { renderWithProviders } from "@/test/renderWithProviders";

const {
  useOptimizedAuthMock,
  usePushNotificationsMock,
  usePushDebugMock,
  navigateMock,
  toastMock,
} = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
  usePushNotificationsMock: vi.fn(),
  usePushDebugMock: vi.fn(),
  navigateMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/hooks/usePushNotifications", () => ({
  usePushNotifications: (...args: any[]) => usePushNotificationsMock(...args),
}));

vi.mock("@/hooks/usePushDebug", () => ({
  usePushDebug: (...args: any[]) => usePushDebugMock(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: any[]) => toastMock(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/components/users/CreateUserDialog", () => ({
  CreateUserDialog: ({ open }: { open: boolean }) => (open ? <div>Create User Dialog</div> : null),
}));

vi.mock("@/components/users/import/ImportUsersDialog", () => ({
  ImportUsersDialog: ({ open }: { open: boolean }) => (open ? <div>Import Users Dialog</div> : null),
}));

vi.mock("@/components/users/UsersList", () => ({
  UsersList: (props: any) => (
    <div>
      Users list {props.searchQuery}/{props.roleFilter || "all"}/{props.departmentFilter || "all"}
    </div>
  ),
}));

vi.mock("@/components/users/filters/FilterBar", () => ({
  FilterBar: ({ searchQuery, selectedRole, selectedDepartment, onSearchChange, onRoleChange, onDepartmentChange, onClearFilters }: any) => (
    <div>
      <div>Filters {searchQuery}/{selectedRole}/{selectedDepartment}</div>
      <button type="button" onClick={() => onSearchChange("ana")}>Set Search</button>
      <button type="button" onClick={() => onRoleChange("technician")}>Set Role</button>
      <button type="button" onClick={() => onDepartmentChange("lights")}>Set Department</button>
      <button type="button" onClick={onClearFilters}>Clear Filters</button>
    </div>
  ),
}));

vi.mock("@/components/settings/PushNotificationMatrix", () => ({
  PushNotificationMatrix: () => <div>Push matrix</div>,
}));

vi.mock("@/components/settings/PushNotificationSchedule", () => ({
  PushNotificationSchedule: () => <div>Push schedule</div>,
}));

vi.mock("@/components/settings/MorningSummarySubscription", () => ({
  MorningSummarySubscription: () => <div>Morning summary</div>,
}));

vi.mock("@/components/settings/ShortcutsSettings", () => ({
  ShortcutsSettings: () => <div>Shortcuts</div>,
}));

vi.mock("@/components/settings/DryHireFolderManager", () => ({
  DryHireFolderManager: () => <div>Dry hire</div>,
}));

vi.mock("@/components/CompanyLogoUploader", () => ({
  CompanyLogoUploader: () => <div>Company logo</div>,
}));

vi.mock("@/components/VersionDisplay", () => ({
  VersionDisplay: () => <div>Version display</div>,
}));

import Settings from "../Settings";

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    useOptimizedAuthMock.mockReturnValue({
      userRole: "management",
      isLoading: false,
    });
    usePushNotificationsMock.mockReturnValue({
      isSupported: true,
      permission: "granted",
      subscription: { endpoint: "push-endpoint" },
      isInitializing: false,
      isEnabling: false,
      isDisabling: false,
      error: null,
      enable: vi.fn().mockResolvedValue(undefined),
      disable: vi.fn().mockResolvedValue(undefined),
      canEnable: true,
    });
    usePushDebugMock.mockReturnValue({
      events: [],
      showLocalTest: vi.fn().mockResolvedValue(undefined),
      getSubscriptionInfo: vi.fn().mockResolvedValue({ endpoint: "https://push.example/device" }),
    });
    mockSupabase.functions.invoke.mockResolvedValue({ data: { status: "sent", results: [{ ok: true }] }, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const openSection = async (title: string, user = userEvent.setup()) => {
    const heading = screen.getByText(title);
    const card = heading.closest(".border");
    expect(card).not.toBeNull();
    await user.click(within(card as HTMLElement).getByRole("button", { name: /expand section/i }));
    return card as HTMLElement;
  };

  it("redirects non-management users away from settings", async () => {
    useOptimizedAuthMock.mockReturnValue({
      userRole: "technician",
      isLoading: false,
    });

    renderWithProviders(<Settings />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/tech-app", { replace: true });
    });
  });

  it("opens the user dialogs and clears filter state", async () => {
    const user = userEvent.setup();

    renderWithProviders(<Settings />);

    await user.click(screen.getByRole("button", { name: /add user/i }));
    await user.click(screen.getByRole("button", { name: /import users/i }));

    expect(screen.getByText("Create User Dialog")).toBeInTheDocument();
    expect(screen.getByText("Import Users Dialog")).toBeInTheDocument();

    const usersCard = await openSection("Users", user);

    await user.click(within(usersCard).getByRole("button", { name: /set search/i }));
    await user.click(within(usersCard).getByRole("button", { name: /set role/i }));
    await user.click(within(usersCard).getByRole("button", { name: /set department/i }));

    expect(within(usersCard).getByText("Filters ana/technician/lights")).toBeInTheDocument();
    expect(within(usersCard).getByText("Users list ana/technician/lights")).toBeInTheDocument();

    await user.click(within(usersCard).getByRole("button", { name: /clear filters/i }));

    expect(within(usersCard).getByText("Filters /all/all")).toBeInTheDocument();
    expect(within(usersCard).getByText("Users list /all/all")).toBeInTheDocument();
  });

  it("shows push status labels and handles sent, skipped, and failed test notifications", async () => {
    const user = userEvent.setup();

    renderWithProviders(<Settings />);
    const pushCard = await openSection("Push notifications", user);

    expect(within(pushCard).getByText((_, element) => element?.textContent === "Permission: Granted")).toBeInTheDocument();
    expect(within(pushCard).getByText((_, element) => element?.textContent === "Subscription: Active on this device")).toBeInTheDocument();

    await user.click(within(pushCard).getByRole("button", { name: /send\s*test/i }));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test notification sent",
      }),
    );

    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: { status: "sent", results: [{ ok: false, skipped: true }] },
      error: null,
    });

    await user.click(within(pushCard).getByRole("button", { name: /send\s*test/i }));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test notification skipped",
      }),
    );

    mockSupabase.functions.invoke.mockRejectedValueOnce(new Error("push failed"));

    await user.click(within(pushCard).getByRole("button", { name: /send\s*test/i }));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Failed to send test",
        variant: "destructive",
      }),
    );
  });

  it("schedules the background push test through the edge function", async () => {
    const user = userEvent.setup();

    renderWithProviders(<Settings />);
    const pushCard = await openSection("Push notifications", user);

    vi.useFakeTimers();
    fireEvent.click(within(pushCard).getByRole("button", { name: /bg test/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Background test scheduled",
      }),
    );

    await vi.advanceTimersByTimeAsync(5000);

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("push", {
      body: { action: "test", url: "/settings" },
    });
  });
});
