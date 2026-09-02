import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTourRootFolders: vi.fn(),
  createTourRootFoldersManual: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/utils/tourFolders", () => ({
  createTourDateFolders: vi.fn(),
  createTourRootFolders: mocks.createTourRootFolders,
  createTourRootFoldersManual: mocks.createTourRootFoldersManual,
}));

vi.mock("@/services/dataLayerClient", () => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  return {
    dataLayerClient: {
      from: vi.fn(() => query),
      storage: {
        from: vi.fn(),
      },
    },
  };
});

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/tours/TourManagementDialog", () => ({
  TourManagementDialog: (): null => null,
}));

import { TourCard } from "@/components/tours/TourCard";

const renderTourCard = (tourOverrides: Record<string, unknown> = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TourCard
          tour={{
            id: "tour-1",
            name: "Gira heredada",
            color: "#123456",
            status: "active",
            flex_folders_created: true,
            flex_main_folder_id: "main-folder-1",
            flex_estructura_folder_id: null,
            tour_dates: [],
            ...tourOverrides,
          }}
          onManageDates={vi.fn()}
          onPrint={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("TourCard Estructura recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTourRootFolders.mockResolvedValue({ success: true });
    mocks.createTourRootFoldersManual.mockResolvedValue({ success: true });
  });

  it("offers and runs a targeted Estructura root backfill for a legacy tour", async () => {
    renderTourCard();

    fireEvent.click(screen.getByRole("button", { name: "Crear carpeta Estructura" }));

    await waitFor(() => {
      expect(mocks.createTourRootFolders).toHaveBeenCalledWith("tour-1");
    });
    expect(mocks.createTourRootFoldersManual).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Carpeta Estructura creada",
    }));
  });

  it("does not offer the recovery action when the Estructura root is already tracked", () => {
    renderTourCard({ flex_estructura_folder_id: "estructura-folder-1" });

    expect(screen.queryByRole("button", { name: "Crear carpeta Estructura" })).not.toBeInTheDocument();
  });

  it("keeps the full root creation path for tours that have no Flex root yet", async () => {
    renderTourCard({
      flex_folders_created: false,
      flex_main_folder_id: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "Crear carpetas raíz de gira" }));

    await waitFor(() => {
      expect(mocks.createTourRootFoldersManual).toHaveBeenCalledWith("tour-1");
    });
    expect(mocks.createTourRootFolders).not.toHaveBeenCalled();
  });
});
