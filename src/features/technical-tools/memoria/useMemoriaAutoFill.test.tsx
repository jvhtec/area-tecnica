// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findJobDocumentsForStageMock } = vi.hoisted(() => ({
  findJobDocumentsForStageMock: vi.fn(),
}));

vi.mock("@/utils/jobDocuments/stageAwareLookup", () => ({
  findJobDocumentsForStage: findJobDocumentsForStageMock,
}));

import { useMemoriaAutoFill } from "@/features/technical-tools/memoria/useMemoriaAutoFill";

const newestDocument = {
  id: "doc-new",
  file_name: "Lista material extra.pdf",
  file_path: "job-1/calculators/lista-material/sound/new.pdf",
  uploaded_at: "2026-07-21T10:00:00.000Z",
};

const olderDocument = {
  id: "doc-old",
  file_name: "Lista material principal.pdf",
  file_path: "job-1/calculators/lista-material/sound/old.pdf",
  uploaded_at: "2026-07-20T10:00:00.000Z",
};

describe("useMemoriaAutoFill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findJobDocumentsForStageMock.mockResolvedValue([newestDocument, olderDocument]);
  });

  it("exposes every eligible document, defaults to newest, and keeps the user's selection", async () => {
    const { result } = renderHook(() =>
      useMemoriaAutoFill("job-1", null, {
        material: "calculators/lista-material/sound",
      })
    );

    await waitFor(() => {
      expect(result.current.candidates.material).toHaveLength(2);
    });
    expect(result.current.detected.material?.filePath).toBe(newestDocument.file_path);

    act(() => result.current.selectDocument("material", olderDocument.file_path));
    expect(result.current.detected.material?.filePath).toBe(olderDocument.file_path);

    act(() => result.current.refetch());
    await waitFor(() => expect(findJobDocumentsForStageMock).toHaveBeenCalledTimes(2));
    expect(result.current.detected.material?.filePath).toBe(olderDocument.file_path);
  });

  it("selects a newly generated document when a section requests the latest candidate", async () => {
    const { result } = renderHook(() =>
      useMemoriaAutoFill("job-1", null, {
        material: "calculators/lista-material/sound",
      })
    );

    await waitFor(() => expect(result.current.detected.material).not.toBeNull());
    act(() => result.current.selectDocument("material", olderDocument.file_path));

    const generatedDocument = {
      id: "doc-generated",
      file_name: "Lista material presupuesto B.pdf",
      file_path: "job-1/calculators/lista-material/sound/generated.pdf",
      uploaded_at: "2026-07-21T12:00:00.000Z",
    };
    findJobDocumentsForStageMock.mockResolvedValue([
      generatedDocument,
      newestDocument,
      olderDocument,
    ]);

    act(() => result.current.refetch("material"));
    await waitFor(() => {
      expect(result.current.detected.material?.filePath).toBe(generatedDocument.file_path);
    });
  });
});
