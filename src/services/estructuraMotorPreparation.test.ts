import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  pushStrict: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

vi.mock("@/services/flexPullsheets", () => ({
  pushEquipmentToFlexDocumentStrict: mocks.pushStrict,
}));

import {
  buildEstructuraMotorEquipment,
  pushEstructuraMotorQuantities,
  resolveEstructuraPullSheetTargets,
} from "./estructuraMotorPreparation";
import type { StrictGroupedPushResult } from "./flexPullsheets";

const successfulPush: StrictGroupedPushResult = {
  groupsCreated: ["motores_controles"],
  groupsReused: [],
  groupsFailed: [],
  equipmentLinesAdded: 1,
  totalQuantitiesRepresented: 3,
  childrenSkippedBecauseParentFailed: [],
  failedChildItems: [],
  warnings: [],
};

const mockFolderRows = (rows: unknown[]) => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  return query;
};

describe("Estructura motor preparation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pushStrict.mockResolvedValue(successfulPush);
  });

  it("drops zero quantities and maps motors to the approved Flex group", () => {
    expect(buildEstructuraMotorEquipment([
      { modelId: "motor-250", modelName: "Motor 250", quantity: 0 },
      { modelId: "motor-1t", modelName: "Motor 1T", quantity: 3 },
    ])).toEqual([
      {
        resourceId: "motor-1t",
        name: "Motor 1T",
        quantity: 3,
        flexCategoryKey: "motores_controles",
      },
    ]);
  });

  it("resolves only tracked Estructura pull sheets by source department", async () => {
    const query = mockFolderRows([
      { id: "sound-row", element_id: "sound-ps", source_department: "sound" },
      { id: "lights-row", element_id: "lights-ps", source_department: "lights" },
    ]);

    await expect(resolveEstructuraPullSheetTargets("job-1")).resolves.toEqual({
      targets: {
        sound: { id: "sound-row", elementId: "sound-ps", sourceDepartment: "sound" },
        lights: { id: "lights-row", elementId: "lights-ps", sourceDepartment: "lights" },
      },
      missing: [],
    });
    expect(query.eq).toHaveBeenCalledWith("department", "estructura");
    expect(query.eq).toHaveBeenCalledWith("folder_type", "pull_sheet");
    expect(query.in).toHaveBeenCalledWith("source_department", ["sound", "lights"]);
  });

  it("keeps Sound and Lights quantities on their deterministic destinations", async () => {
    mockFolderRows([
      { id: "sound-row", element_id: "sound-ps", source_department: "sound" },
      { id: "lights-row", element_id: "lights-ps", source_department: "lights" },
    ]);

    const result = await pushEstructuraMotorQuantities("job-1", {
      sound: [{ modelId: "motor-s", modelName: "Motor sonido", quantity: 3 }],
      lights: [{ modelId: "motor-l", modelName: "Motor luces", quantity: 7 }],
    });

    expect(mocks.pushStrict).toHaveBeenNthCalledWith(
      1,
      { elementId: "sound-ps", documentType: "pullsheet" },
      [expect.objectContaining({ resourceId: "motor-s", quantity: 3 })],
    );
    expect(mocks.pushStrict).toHaveBeenNthCalledWith(
      2,
      { elementId: "lights-ps", documentType: "pullsheet" },
      [expect.objectContaining({ resourceId: "motor-l", quantity: 7 })],
    );
    expect(result.sound.status).toBe("success");
    expect(result.lights.status).toBe("success");
  });

  it("reports a missing destination independently while pushing the valid side", async () => {
    mockFolderRows([
      { id: "sound-row", element_id: "sound-ps", source_department: "sound" },
    ]);

    const result = await pushEstructuraMotorQuantities("job-1", {
      sound: [{ modelId: "motor-s", modelName: "Motor sonido", quantity: 3 }],
      lights: [{ modelId: "motor-l", modelName: "Motor luces", quantity: 2 }],
    });

    expect(mocks.pushStrict).toHaveBeenCalledTimes(1);
    expect(result.sound.status).toBe("success");
    expect(result.lights).toMatchObject({ status: "error", requestedQuantity: 2 });
  });
});
