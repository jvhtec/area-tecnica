import { describe, expect, it } from "vitest";

import { SOUND_CONSUMOS_CONFIG } from "../departmentConfigs";
import { createPrebuiltMonitorPdu } from "../monitorPduPreset";

describe("createPrebuiltMonitorPdu", () => {
  it("creates the requested unpositioned Monitores PDU for the active stage", () => {
    const table = createPrebuiltMonitorPdu({
      components: SOUND_CONSUMOS_CONFIG.components,
      id: 123,
      pduOptions: ["CEE16A 3P+N+G", "CEE32A 3P+N+G"],
      settings: {
        safetyMargin: 20,
        phaseMode: "three",
        voltage: 400,
        powerFactor: 0.95,
      },
      stage: { name: "Escenario B", number: 2 },
    });

    expect(table).toEqual(
      expect.objectContaining({
        id: 123,
        name: "Monitores",
        position: undefined,
        includesHoist: false,
        stageName: "Escenario B",
        stageNumber: 2,
      }),
    );
    expect(table.rows).toEqual([
      expect.objectContaining({ componentName: "Control Mon (L)", quantity: "1" }),
      expect.objectContaining({ componentName: "RF Rack", quantity: "1" }),
      expect.objectContaining({ componentName: "Backline", quantity: "1" }),
      expect.objectContaining({ componentName: "Varios", quantity: "1" }),
    ]);
  });

  it("fails loudly instead of creating a partial preset when a required component is missing", () => {
    expect(() =>
      createPrebuiltMonitorPdu({
        components: SOUND_CONSUMOS_CONFIG.components.filter(
          (component) => component.name !== "RF Rack",
        ),
        id: 123,
        pduOptions: ["CEE16A 3P+N+G"],
        settings: {
          safetyMargin: 20,
          phaseMode: "three",
          voltage: 400,
          powerFactor: 0.95,
        },
        stage: null,
      }),
    ).toThrow('Falta el componente "RF Rack"');
  });
});
