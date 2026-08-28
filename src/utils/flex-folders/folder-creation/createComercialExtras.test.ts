import { beforeEach, describe, expect, it, vi } from "vitest";

const { createFlexFolderMock, insertMock } = vi.hoisted(() => ({
  createFlexFolderMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock("@/utils/flex-folders/api", () => ({
  createFlexFolder: createFlexFolderMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({ insert: insertMock })),
  },
}));

import { createComercialExtras } from "./createComercialExtras";

describe("createComercialExtras document numbers", () => {
  beforeEach(() => {
    createFlexFolderMock.mockReset();
    createFlexFolderMock
      .mockResolvedValueOnce({ elementId: "sound-quote" })
      .mockResolvedValueOnce({ elementId: "lights-quote" });
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
  });

  it("replaces the commercial QT suffix with the specific quote type", async () => {
    await createComercialExtras({
      formattedEndDate: "2026-10-22T00:00:00.000Z",
      formattedStartDate: "2026-10-21T00:00:00.000Z",
      job: {
        id: "job-1",
        title: "Test Job",
        start_time: "2026-10-21T00:00:00.000Z",
        end_time: "2026-10-22T00:00:00.000Z",
      },
      jobTitle: "Test Job",
      options: {
        comercial: {
          subfolders: ["presupuestoSound", "presupuestoLights"],
        },
      },
      parentDocumentNumber: "261021QT",
      parentElementId: "commercial-folder",
      parentName: "Test Job - Comercial",
    });

    expect(createFlexFolderMock.mock.calls.map(([payload]) => payload.documentNumber)).toEqual([
      "261021SQT",
      "261021LQT",
    ]);
  });

  it("keeps the specific quote type before multi-quote ordinals", async () => {
    await createComercialExtras({
      formattedEndDate: "2026-10-22T00:00:00.000Z",
      formattedStartDate: "2026-10-21T00:00:00.000Z",
      job: {
        id: "job-1",
        title: "Test Job",
        start_time: "2026-10-21T00:00:00.000Z",
        end_time: "2026-10-22T00:00:00.000Z",
      },
      jobTitle: "Test Job",
      options: {
        comercial: {
          subfolders: ["presupuestoLights"],
          extrasPresupuesto: {
            entries: [{ name: "Main" }, { name: "Backup" }],
          },
        },
      },
      parentDocumentNumber: "261021QT",
      parentElementId: "commercial-folder",
      parentName: "Test Job - Comercial",
    });

    expect(createFlexFolderMock.mock.calls.map(([payload]) => payload.documentNumber)).toEqual([
      "261021LQTPR01",
      "261021LQTPR02",
    ]);
  });
});
