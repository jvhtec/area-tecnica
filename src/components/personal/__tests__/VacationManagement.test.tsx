// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createVacationRequest } from "@/test/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";

const { useVacationRequestsMock } = vi.hoisted(() => ({
  useVacationRequestsMock: vi.fn(),
}));

vi.mock("@/hooks/useVacationRequests", () => ({
  useVacationRequests: (...args: any[]) => useVacationRequestsMock(...args),
}));

import { VacationManagement } from "../VacationManagement";

describe("VacationManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the loading and empty states", () => {
    useVacationRequestsMock.mockReturnValue({
      pendingRequests: [],
      isLoadingPendingRequests: true,
      approveRequests: vi.fn(),
      rejectRequests: vi.fn(),
      isApproving: false,
      isRejecting: false,
    });

    const { rerender } = renderWithProviders(<VacationManagement />);

    expect(screen.getByText(/loading vacation requests/i)).toBeInTheDocument();

    useVacationRequestsMock.mockReturnValue({
      pendingRequests: [],
      isLoadingPendingRequests: false,
      approveRequests: vi.fn(),
      rejectRequests: vi.fn(),
      isApproving: false,
      isRejecting: false,
    });

    rerender(<VacationManagement />);

    expect(screen.getByText(/no pending vacation requests/i)).toBeInTheDocument();
  });

  it("supports select-all, approve, and reject flows", async () => {
    const user = userEvent.setup();
    const approveRequests = vi.fn();
    const rejectRequests = vi.fn();

    useVacationRequestsMock.mockReturnValue({
      pendingRequests: [
        createVacationRequest({ id: "vac-1", reason: "Festivo" }),
        createVacationRequest({ id: "vac-2", reason: "Descanso" }),
      ],
      isLoadingPendingRequests: false,
      approveRequests,
      rejectRequests,
      isApproving: false,
      isRejecting: false,
    });

    renderWithProviders(<VacationManagement />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    expect(screen.getByRole("button", { name: /approve selected \(2\)/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /reject selected \(2\)/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /approve selected \(2\)/i }));
    expect(approveRequests).toHaveBeenCalledWith(["vac-1", "vac-2"]);

    await user.click(checkboxes[0]);
    await user.click(screen.getByRole("button", { name: /reject selected \(2\)/i }));
    expect(rejectRequests).toHaveBeenCalledWith({ requestIds: ["vac-1", "vac-2"] });
  });
});
