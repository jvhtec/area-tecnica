// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { createTestQueryClient } from "@/test/createTestQueryClient";
import { renderWithProviders } from "@/test/renderWithProviders";

const { useOptimizedAuthMock, useIsMobileMock } = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
  useIsMobileMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: (...args: any[]) => useIsMobileMock(...args),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

import TechnicianUnavailability from "../TechnicianUnavailability";

describe("TechnicianUnavailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    useOptimizedAuthMock.mockReturnValue({ user: { id: "tech-1" } });
    useIsMobileMock.mockReturnValue(false);
  });

  const configureSupabase = (blocks: any[] = []) => {
    const selectBuilder = createMockQueryBuilder({ data: blocks, error: null });
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const deleteBuilder = createMockQueryBuilder({ data: null, error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "technician_availability") {
        return {
          select: vi.fn(() => selectBuilder),
          upsert: upsertMock,
          delete: vi.fn(() => deleteBuilder),
        };
      }

      return createMockQueryBuilder();
    });

    return { upsertMock, deleteBuilder };
  };

  it("validates missing dates and invalid ranges before creating a block", async () => {
    const user = userEvent.setup();
    const { upsertMock } = configureSupabase();

    renderWithProviders(<TechnicianUnavailability />);

    await screen.findByText(/todavía no tienes bloqueos/i);
    await user.click(screen.getAllByRole("button", { name: /añadir bloqueo/i })[0]);
    await screen.findByText(/rango de fechas/i);
    await user.click(screen.getByRole("button", { name: /^crear$/i }));

    expect(screen.getByText(/la fecha de inicio es obligatoria/i)).toBeInTheDocument();
    expect(screen.getByText(/la fecha de fin es obligatoria/i)).toBeInTheDocument();
    expect(upsertMock).not.toHaveBeenCalled();

    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "2026-03-12" } });
    fireEvent.change(inputs[1], { target: { value: "2026-03-10" } });
    await user.click(screen.getByRole("button", { name: /^crear$/i }));

    expect(screen.getByText(/debe ser posterior o igual/i)).toBeInTheDocument();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("switches the date inputs when all-day mode is disabled", async () => {
    const user = userEvent.setup();
    configureSupabase();

    renderWithProviders(<TechnicianUnavailability />);

    await screen.findByText(/todavía no tienes bloqueos/i);
    await user.click(screen.getAllByRole("button", { name: /añadir bloqueo/i })[0]);
    await screen.findByText(/rango de fechas/i);

    let inputs = document.querySelectorAll("input");
    expect(inputs[0]).toHaveAttribute("type", "date");
    expect(inputs[1]).toHaveAttribute("type", "date");

    await user.click(screen.getByRole("switch", { name: /todo el día/i }));

    inputs = document.querySelectorAll("input");
    expect(inputs[0]).toHaveAttribute("type", "datetime-local");
    expect(inputs[1]).toHaveAttribute("type", "datetime-local");
  });

  it("creates inclusive rows for the selected date range and invalidates my-unavailability", async () => {
    const user = userEvent.setup();
    const { upsertMock } = configureSupabase();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderWithProviders(<TechnicianUnavailability />, { queryClient });

    await screen.findByText(/todavía no tienes bloqueos/i);
    await user.click(screen.getAllByRole("button", { name: /añadir bloqueo/i })[0]);
    await screen.findByText(/rango de fechas/i);
    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "2026-03-12" } });
    fireEvent.change(inputs[1], { target: { value: "2026-03-14" } });
    await user.click(screen.getByRole("button", { name: /^crear$/i }));

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

  it("deletes a single block and invalidates my-unavailability", async () => {
    const user = userEvent.setup();
    const { deleteBuilder } = configureSupabase([
      {
        id: "block-1",
        technician_id: "tech-1",
        date: "2026-03-12",
        status: "day_off",
        created_at: "2026-03-01T09:00:00Z",
        updated_at: "2026-03-01T09:00:00Z",
      },
    ]);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderWithProviders(<TechnicianUnavailability />, { queryClient });

    const dateLabel = await screen.findByText("12 de marzo de 2026");
    const card = dateLabel.closest("div.rounded-lg");
    expect(card).not.toBeNull();

    await user.click(within(card as HTMLElement).getByRole("button"));

    await waitFor(() => {
      expect(deleteBuilder.eq).toHaveBeenCalledWith("id", "block-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["my-unavailability"] });
  });
});
