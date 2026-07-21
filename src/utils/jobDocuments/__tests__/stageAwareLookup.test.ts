import { describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: { from: fromMock },
}));

import {
  findJobDocumentsForStage,
  parseStageScopeSegment,
} from "@/utils/jobDocuments/stageAwareLookup";

describe("stage-aware job document lookup helpers", () => {
  it("parses stage scopes from legacy and job-scoped generated document paths", () => {
    expect(
      parseStageScopeSegment(
        "calculators/consumos/job-1/stage-2-main/copy-id-report.pdf",
        "job-1",
        "calculators/consumos"
      )
    ).toBe("stage-2-main");

    expect(
      parseStageScopeSegment(
        "job-1/calculators/consumos/stage-2-main/copy-id-report.pdf",
        "job-1",
        "calculators/consumos"
      )
    ).toBe("stage-2-main");

    expect(
      parseStageScopeSegment(
        "job-1/calculators/consumos/copy-id-report.pdf",
        "job-1",
        "calculators/consumos"
      )
    ).toBeNull();
  });

  it("returns every matching stage document in server-provided newest-first order", async () => {
    const documents = [
      {
        id: "new",
        file_name: "new.pdf",
        file_path: "job-1/calculators/pesos/new.pdf",
        uploaded_at: "2026-07-21T10:00:00Z",
      },
      {
        id: "old",
        file_name: "old.pdf",
        file_path: "calculators/pesos/job-1/old.pdf",
        uploaded_at: "2026-07-20T10:00:00Z",
      },
      {
        id: "other-stage",
        file_name: "stage.pdf",
        file_path: "job-1/calculators/pesos/stage-2-main/stage.pdf",
        uploaded_at: "2026-07-22T10:00:00Z",
      },
    ];
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      or: vi.fn(),
      order: vi.fn().mockResolvedValue({ data: documents, error: null }),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.or.mockReturnValue(builder);
    fromMock.mockReturnValue(builder);

    const matches = await findJobDocumentsForStage("job-1", "calculators/pesos");

    expect(matches.map((document) => document.id)).toEqual(["new", "old"]);
  });
});
