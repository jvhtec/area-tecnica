import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

const viewport = vi.hoisted(() => ({ isMobile: false }));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => viewport.isMobile,
}));

const Example = () => (
  <ResponsiveDialog open>
    <ResponsiveDialogContent>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Editar trabajo</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>Actualiza los datos principales.</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
    </ResponsiveDialogContent>
  </ResponsiveDialog>
);

describe("ResponsiveDialog", () => {
  beforeEach(() => {
    viewport.isMobile = false;
  });

  it("renders the desktop dialog at the md breakpoint and above", () => {
    render(<Example />);

    expect(screen.getByRole("dialog")).toHaveAttribute("data-responsive-mode", "desktop");
    expect(screen.getByRole("heading", { name: "Editar trabajo" })).toBeVisible();
  });

  it("renders a bottom drawer below the md breakpoint", () => {
    viewport.isMobile = true;
    render(<Example />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-responsive-mode", "mobile");
    expect(dialog.querySelector("[data-responsive-scroll-container]")).toHaveClass(
      "overflow-y-auto",
    );
    expect(dialog).toHaveClass("overflow-hidden");
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeVisible();
  });
});
