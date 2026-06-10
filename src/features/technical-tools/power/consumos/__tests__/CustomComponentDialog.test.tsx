// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LIGHTS_CONSUMOS_CONFIG } from "../departmentConfigs";
import { CustomComponentDialog } from "../CustomComponentDialog";

describe("CustomComponentDialog", () => {
  it("creates a lighting component with watts and fixture type", async () => {
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
    const submit = screen.getByRole("button", { name: "Agregar componente" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("Vatios"), "880");
    await user.click(submit);

    expect(onCreate).toHaveBeenCalledWith({
      name: "Arolla custom",
      watts: 880,
      fixtureType: "led",
    });
  });
});
