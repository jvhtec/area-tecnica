import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { MobileActionSheet } from "@/components/ui/mobile-action-sheet";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

describe("MobileActionSheet", () => {
  it("renders grouped labels and closes after selecting an action", async () => {
    const onDelete = vi.fn();
    render(
      <MobileActionSheet
        title="Más acciones"
        description="Acciones del trabajo"
        trigger={<button type="button">Abrir acciones</button>}
        groups={[
          {
            id: "danger",
            label: "Peligro",
            actions: [
              {
                id: "delete",
                label: "Eliminar trabajo",
                icon: Trash2,
                destructive: true,
                onSelect: onDelete,
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir acciones" }));
    expect(screen.getByRole("heading", { name: "Más acciones" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Peligro" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar trabajo" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps disabled actions unavailable", () => {
    render(
      <MobileActionSheet
        title="Más acciones"
        trigger={<button type="button"><MoreHorizontal /> Abrir</button>}
        groups={[
          {
            id: "documents",
            actions: [
              {
                id: "upload",
                label: "Subir documento",
                disabled: true,
                onSelect: vi.fn(),
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /abrir/i }));
    expect(screen.getByRole("button", { name: "Subir documento" })).toBeDisabled();
  });
});
