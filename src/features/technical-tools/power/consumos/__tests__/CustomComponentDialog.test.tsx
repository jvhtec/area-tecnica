// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LIGHTS_CONSUMOS_CONFIG } from "../departmentConfigs";
import { CustomComponentDialog } from "../CustomComponentDialog";

describe("CustomComponentDialog", () => {
  it("creates a lighting component with weight, watts and fixture type", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(
      <CustomComponentDialog
        labels={LIGHTS_CONSUMOS_CONFIG.labels}
        showFixtureType
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Agregar componente" }));
    await user.type(screen.getByLabelText("Nombre"), "Arolla custom");
    await user.type(screen.getByLabelText("Vatios"), "880");
    const submit = screen.getByRole("button", { name: "Agregar componente" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("Peso (kg)"), "24.5");
    await user.click(submit);

    expect(onCreate).toHaveBeenCalledWith({
      name: "Arolla custom",
      weightKg: 24.5,
      watts: 880,
      fixtureType: "led",
    });
  });
});
