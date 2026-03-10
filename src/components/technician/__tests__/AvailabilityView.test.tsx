// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { createTestQueryClient } from "@/test/createTestQueryClient";
import { renderWithProviders } from "@/test/renderWithProviders";

const { useOptimizedAuthMock } = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

import { AvailabilityView } from "../AvailabilityView";

const theme = {
  bg: "bg-slate-950",
  nav: "bg-slate-900",
  card: "bg-slate-900",
  textMain: "text-white",
  textMuted: "text-slate-400",
  accent: "bg-blue-600",
  input: "bg-slate-800",
  modalOverlay: "bg-black/70",
  divider: "border-slate-800",
  danger: "text-red-500",
  success: "text-green-500",
  warning: "text-yellow-500",
  cluster: "bg-white text-black",
} as const;

describe("AvailabilityView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    vi.setSystemTime(new Date("2026-03-10T09:00:00Z"));
    useOptimizedAuthMock.mockReturnValue({
      user: { id: "tech-1" },
    });
  });

  it("renders the empty state and lets the user navigate between months", async () => {
    const selectBuilder = createMockQueryBuilder({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "technician_availability") {
        return {
          select: vi.fn(() => selectBuilder),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
        };
      }

      return createMockQueryBuilder();
    });

    renderWithProviders(<AvailabilityView theme={theme} isDark={false} />);

    expect(await screen.findByText(/no hay fechas marcadas/i)).toBeInTheDocument();
    expect(screen.getAllByText(/marzo 2026/i)).toHaveLength(2);

    await userEvent.click(screen.getAllByRole("button")[2]);

    expect(screen.getAllByText(/abril 2026/i)).toHaveLength(2);
  });

  it("creates an inclusive date range and invalidates the availability query", async () => {
    const user = userEvent.setup();
    const selectBuilder = createMockQueryBuilder({ data: [], error: null });
    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "technician_availability") {
        return {
          select: vi.fn(() => selectBuilder),
          upsert: upsertMock,
          delete: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
        };
      }

      return createMockQueryBuilder();
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderWithProviders(<AvailabilityView theme={theme} isDark />, { queryClient });

    await screen.findByText(/disponibilidad/i);

    await user.click(screen.getByRole("button", { name: /añadir/i }));
    await screen.findByRole("heading", { name: /marcar no disponible/i });
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const startInput = dateInputs[0] as HTMLInputElement;
    const endInput = dateInputs[1] as HTMLInputElement;

    fireEvent.change(startInput, { target: { value: "2026-03-12" } });
    fireEvent.change(endInput, { target: { value: "2026-03-14" } });
    await user.click(screen.getByRole("button", { name: /marcar no disponible/i }));

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledWith(
        [
          { technician_id: "tech-1", date: "2026-03-12", status: "day_off" },
          { technician_id: "tech-1", date: "2026-03-13", status: "day_off" },
          { technician_id: "tech-1", date: "2026-03-14", status: "day_off" },
        ],
        { onConflict: "technician_id,date" },
      );
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["my-unavailability"] });
  });

  it("renders month-scoped blocks using string date comparisons", async () => {
    const selectBuilder = createMockQueryBuilder({
      data: [
        {
          id: "block-march",
          technician_id: "tech-1",
          date: "2026-03-12",
          status: "day_off",
          created_at: "2026-03-01T09:00:00Z",
        },
        {
          id: "block-april",
          technician_id: "tech-1",
          date: "2026-04-02",
          status: "day_off",
          created_at: "2026-03-01T09:00:00Z",
        },
      ],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "technician_availability") {
        return {
          select: vi.fn(() => selectBuilder),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
        };
      }

      return createMockQueryBuilder();
    });

    renderWithProviders(<AvailabilityView theme={theme} isDark={false} />);

    expect(await screen.findByText("12 de marzo de 2026")).toBeInTheDocument();
    expect(screen.queryByText("2 de abril de 2026")).not.toBeInTheDocument();
  });
});
