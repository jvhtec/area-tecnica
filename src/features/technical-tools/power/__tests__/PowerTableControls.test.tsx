// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  PowerTableControls,
  SPANISH_POWER_TABLE_CONTROL_LABELS,
} from "@/features/technical-tools/power/PowerTableControls";
import type { PowerTable } from "@/features/technical-tools/power/types";

const table: PowerTable = {
  id: 1,
  name: "Main",
  rows: [],
  includesHoist: true,
  pduType: "CEE32A 3P+N+G",
};

describe("PowerTableControls", () => {
  it("renders shared English controls for sound and video tables", () => {
    render(
      <PowerTableControls
        table={table}
        pduTypes={["CEE32A 3P+N+G"]}
        onUpdateSettings={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Requires additional hoist power (CEE32A 3P+N+G)")).toBeChecked();
    expect(screen.getByText("PDU Type Override:")).toBeInTheDocument();
    expect(screen.getByText("Position:")).toBeInTheDocument();
  });

  it("renders Spanish labels and custom PDU input for lights tables", () => {
    render(
      <PowerTableControls
        table={{ ...table, customPduType: "Rack distro" }}
        customPduSelectValue="Custom"
        labels={SPANISH_POWER_TABLE_CONTROL_LABELS}
        pduTypes={["CEE32A 3P+N+G"]}
        onUpdateSettings={vi.fn()}
      />,
    );

    expect(screen.getByText("Anulación de Tipo de PDU:")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ingrese un tipo de PDU personalizado")).toHaveValue("Rack distro");
  });
});
