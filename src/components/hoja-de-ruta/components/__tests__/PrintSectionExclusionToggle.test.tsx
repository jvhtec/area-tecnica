// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PrintSectionExclusionToggle } from "@/components/hoja-de-ruta/components/PrintSectionExclusionToggle";

describe("PrintSectionExclusionToggle", () => {
  it("calls back with the section id and checked state", async () => {
    const user = userEvent.setup();
    const onExcludedChange = vi.fn();

    render(
      <PrintSectionExclusionToggle
        sectionId="power"
        isExcluded={false}
        onExcludedChange={onExcludedChange}
      />
    );

    await user.click(screen.getByRole("checkbox", { name: "Excluir al imprimir" }));

    expect(onExcludedChange).toHaveBeenCalledWith("power", true);
  });

  it("explains when a section is excluded", () => {
    render(
      <PrintSectionExclusionToggle
        sectionId="staff"
        isExcluded
        onExcludedChange={vi.fn()}
      />
    );

    expect(screen.getByRole("checkbox", { name: "Excluir al imprimir" })).toBeChecked();
  });
});
