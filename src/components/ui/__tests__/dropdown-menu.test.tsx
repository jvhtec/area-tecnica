import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

describe("DropdownMenuContent", () => {
  it("leaves fixed positioning to the Radix collision-aware wrapper", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger asChild>
          <button type="button">Abrir acciones</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Editar artista</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const menu = screen.getByRole("menu");
    const positioningWrapper = menu.closest("[data-radix-popper-content-wrapper]");

    expect(positioningWrapper).not.toBeNull();
    expect(positioningWrapper).toHaveStyle({ position: "fixed" });
    expect(menu).not.toHaveStyle({ position: "fixed" });
  });
});
