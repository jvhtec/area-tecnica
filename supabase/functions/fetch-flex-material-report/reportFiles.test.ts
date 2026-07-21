import { describe, expect, it } from "vitest";

import {
  buildFlexReportFileIdentity,
  isFlexReportPredecessorObject,
} from "./reportFiles.ts";

describe("Flex material report file identity", () => {
  it("builds readable names while keeping each Flex element in a distinct replacement slot", () => {
    const first = buildFlexReportFileIdentity({
      department: "sound",
      displayName: "Extra Escenario Ágora",
      documentNumber: "Q-100",
      elementId: "11111111-aaaa-bbbb-cccc-111111111111",
      fileNamePrefix: "Presupuesto",
      versionKey: "version-1",
    });
    const second = buildFlexReportFileIdentity({
      department: "sound",
      displayName: "Extra Escenario Ágora",
      documentNumber: "Q-100",
      elementId: "22222222-aaaa-bbbb-cccc-222222222222",
      fileNamePrefix: "Presupuesto",
      versionKey: "version-1",
    });

    expect(first.fileName).toBe("Presupuesto - Sonido - Extra_Escenario_Agora - Q-100 - 11111111.pdf");
    expect(second.fileName).not.toBe(first.fileName);
    expect(first.elementStoragePrefix).toBe("11111111-aaaa-bbbb-cccc-111111111111--");
    expect(first.objectName).toContain("--version-1--");
  });

  it("matches only predecessors for the selected element plus the one legacy shared slot", () => {
    expect(isFlexReportPredecessorObject(
      "quote-a--old--Presupuesto.pdf",
      "quote-a--",
      "Presupuesto - sound.pdf",
    )).toBe(true);
    expect(isFlexReportPredecessorObject(
      "Presupuesto - sound.pdf",
      "quote-a--",
      "Presupuesto - sound.pdf",
    )).toBe(true);
    expect(isFlexReportPredecessorObject(
      "quote-b--old--Presupuesto.pdf",
      "quote-a--",
      "Presupuesto - sound.pdf",
    )).toBe(false);
  });
});
