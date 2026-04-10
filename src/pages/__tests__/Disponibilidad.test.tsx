// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { createRouteShellAuthState } from "@/test/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";

const {
  useOptimizedAuthMock,
  toastMock,
  useJobsDataMock,
  useIsMobileMock,
  fetchJobLogoMock,
} = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
  toastMock: vi.fn(),
  useJobsDataMock: vi.fn(),
  useIsMobileMock: vi.fn(),
  fetchJobLogoMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/hooks/useJobsData", () => ({
  useJobsData: (...args: any[]) => useJobsDataMock(...args),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: (...args: any[]) => useIsMobileMock(...args),
}));

vi.mock("@/utils/pdf/logoUtils", () => ({
  fetchJobLogo: (...args: any[]) => fetchJobLogoMock(...args),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/components/disponibilidad/WeeklySummary", () => ({
  WeeklySummary: ({ selectedDate }: { selectedDate: Date }) => <div>Weekly summary {selectedDate.toISOString().slice(0, 10)}</div>,
}));

vi.mock("@/components/disponibilidad/DisponibilidadCalendar", () => ({
  DisponibilidadCalendar: ({ selectedDate }: { selectedDate: Date }) => <div>Calendar {selectedDate.toISOString().slice(0, 10)}</div>,
}));

vi.mock("@/components/disponibilidad/MobileAvailabilityView", () => ({
  MobileAvailabilityView: ({ department }: { department: string }) => <div>Mobile {department}</div>,
}));

vi.mock("@/components/disponibilidad/QuickPresetAssignment", () => ({
  QuickPresetAssignment: () => <div>Quick preset assignment</div>,
}));

vi.mock("@/components/equipment/InventoryManagementDialog", () => ({
  InventoryManagementDialog: () => <button type="button">Inventory Dialog</button>,
}));

vi.mock("@/components/equipment/PresetManagementDialog", () => ({
  PresetManagementDialog: ({ open }: { open: boolean }) => (open ? <div>Preset dialog</div> : null),
}));

vi.mock("@/components/equipment/SubRentalDialog", () => ({
  SubRentalDialog: () => <div>Subrental dialog</div>,
}));

import Disponibilidad from "../Disponibilidad";

describe("Disponibilidad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    useIsMobileMock.mockReturnValue(false);
    fetchJobLogoMock.mockResolvedValue("https://example.com/logo.png");
    useJobsDataMock.mockReturnValue({ data: [] });
    useOptimizedAuthMock.mockReturnValue(
      createRouteShellAuthState("management", {
        userDepartment: "sound",
      }),
    );
  });

  const configurePresetQuery = (result: { data: any; error: any }) => {
    const presetBuilder = createMockQueryBuilder(result);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "day_preset_assignments") {
        return presetBuilder;
      }

      return createMockQueryBuilder();
    });
  };

  it("shows the restricted-access state for management users outside sound and lights", () => {
    useOptimizedAuthMock.mockReturnValue(
      createRouteShellAuthState("management", {
        userDepartment: "video",
      }),
    );
    configurePresetQuery({ data: [], error: null });

    renderWithProviders(<Disponibilidad />);

    expect(screen.getByText(/acceso restringido/i)).toBeInTheDocument();
    expect(screen.getByText(/solo está disponible para los departamentos de sonido y luces/i)).toBeInTheDocument();
  });

  it("renders the mobile branch when the viewport is mobile", () => {
    useIsMobileMock.mockReturnValue(true);
    configurePresetQuery({ data: [], error: null });

    renderWithProviders(<Disponibilidad />);

    expect(screen.getByText("Mobile sound")).toBeInTheDocument();
  });

  it("lets admins switch departments and updates the selected-day jobs", async () => {
    const user = userEvent.setup();
    useOptimizedAuthMock.mockReturnValue(
      createRouteShellAuthState("admin", {
        userDepartment: "sound",
      }),
    );
    useJobsDataMock.mockImplementation((options?: { department?: string }) => ({
      data: options?.department === "lights"
        ? [{ id: "job-lights", title: "Lights Job", location: { name: "Arena" } }]
        : [{ id: "job-sound", title: "Sound Job", location: { name: "Sala 1" } }],
    }));
    configurePresetQuery({ data: [], error: null });

    renderWithProviders(<Disponibilidad />);

    expect(await screen.findByText("Sound Job")).toBeInTheDocument();
    expect(screen.getByText("Sala 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /luces/i }));

    expect(screen.getByText("Lights Job")).toBeInTheDocument();
    expect(screen.getByText("Arena")).toBeInTheDocument();
  });

  it("falls back to assigned presets when there are no jobs for the selected date", async () => {
    useJobsDataMock.mockReturnValue({ data: [] });
    configurePresetQuery({
      data: [
        {
          id: "assignment-1",
          preset: {
            id: "preset-1",
            name: "Preset principal",
            job: {
              id: "job-1",
              title: "Preset Job",
              location: { name: "Teatro" },
            },
          },
        },
      ],
      error: null,
    });

    renderWithProviders(<Disponibilidad />);

    expect(await screen.findByText("Preset Job")).toBeInTheDocument();
    expect(screen.getByText("Teatro")).toBeInTheDocument();
  });

  it("emits a destructive toast when the preset query fails", async () => {
    configurePresetQuery({
      data: null,
      error: new Error("preset failure"),
    });

    renderWithProviders(<Disponibilidad />);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Error",
        }),
      );
    });
  });
});
