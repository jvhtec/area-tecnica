// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEquipmentStockEntry, createAuthState } from "@/test/fixtures";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { renderWithProviders } from "@/test/renderWithProviders";
import { getCategoriesForDepartment } from "@/types/equipment";

const { useOptimizedAuthMock, toastMock } = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/components/disponibilidad/StockCreationManager", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    StockCreationManager: ({
      stock,
      department,
      onStockUpdate,
    }: {
      stock: any[];
      department: string;
      onStockUpdate: (stock: any[]) => void;
    }) =>
      React.createElement(
        "div",
        null,
        React.createElement("div", null, `Stock rows: ${stock.length}`),
        React.createElement("div", null, `Department: ${department}`),
        React.createElement(
          "button",
          { onClick: () => onStockUpdate(stock) },
          "Guardar inventario",
        ),
      ),
  };
});

import { EquipmentManagement } from "../EquipmentManagement";

beforeEach(() => {
  resetMockSupabase();
  vi.clearAllMocks();
  useOptimizedAuthMock.mockReturnValue(
    createAuthState({
      session: { user: { id: "manager-1" } },
      userDepartment: "sound",
    }),
  );
});

describe("EquipmentManagement", () => {
  it("shows a department warning when the user has no assigned department", () => {
    useOptimizedAuthMock.mockReturnValue(
      createAuthState({
        session: { user: { id: "manager-1" } },
        userDepartment: null,
      }),
    );

    renderWithProviders(<EquipmentManagement />);

    expect(screen.getByText(/departamento no asignado/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no tienes un departamento asignado/i),
    ).toBeInTheDocument();
  });

  it("loads stock entries filtered by the signed-in department", async () => {
    const stockEntry = createEquipmentStockEntry({
      id: "stock-1",
      equipment_id: "wireless-1",
      base_quantity: 6,
    });
    const selectBuilder = createMockQueryBuilder({
      data: [stockEntry],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "global_stock_entries") {
        return {
          select: vi.fn(() => selectBuilder),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return createMockQueryBuilder();
    });

    renderWithProviders(<EquipmentManagement />);

    expect(await screen.findByText("Stock rows: 1")).toBeInTheDocument();
    expect(screen.getByText("Department: sound")).toBeInTheDocument();
    expect(selectBuilder.in).toHaveBeenCalledWith(
      "equipment.category",
      getCategoriesForDepartment("sound"),
    );
  });

  it("upserts edited stock rows and shows a success toast", async () => {
    const user = userEvent.setup();
    const stockEntry = createEquipmentStockEntry({
      id: "stock-1",
      equipment_id: "wireless-1",
      base_quantity: 6,
    });
    const selectBuilder = createMockQueryBuilder({
      data: [stockEntry],
      error: null,
    });
    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "global_stock_entries") {
        return {
          select: vi.fn(() => selectBuilder),
          upsert: upsertMock,
        };
      }
      return createMockQueryBuilder();
    });

    renderWithProviders(<EquipmentManagement />);

    await screen.findByText("Stock rows: 1");
    await user.click(screen.getByRole("button", { name: /guardar inventario/i }));

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledWith({
        id: "stock-1",
        equipment_id: "wireless-1",
        base_quantity: 6,
      });
    });
    expect((toastMock as Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        title: "Éxito",
        description: "Inventario actualizado correctamente",
      }),
    );
  });
});
