import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  dbDeleteEq: vi.fn(),
  dbDeleteIn: vi.fn(),
  dbInsert: vi.fn(),
  dbSelectOr: vi.fn(),
  functionsInvoke: vi.fn(),
  storageFrom: vi.fn(),
  storageList: vi.fn(),
  storageRemove: vi.fn(),
  storageUpload: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: mocks.authGetUser,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          or: mocks.dbSelectOr,
        })),
      })),
      delete: vi.fn(() => ({
        in: mocks.dbDeleteIn,
      })),
      insert: mocks.dbInsert,
    })),
    functions: {
      invoke: mocks.functionsInvoke,
    },
    storage: {
      from: mocks.storageFrom,
    },
  },
}));

import { uploadJobPdfWithCleanup } from "@/utils/jobDocumentsUpload";

describe("job document PDF upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.dbDeleteEq.mockResolvedValue({ error: null });
    mocks.dbDeleteIn.mockReturnValue({ eq: mocks.dbDeleteEq });
    mocks.dbInsert.mockResolvedValue({ error: null });
    mocks.dbSelectOr.mockResolvedValue({ data: [], error: null });
    mocks.functionsInvoke.mockResolvedValue({ data: null, error: null });
    mocks.storageFrom.mockReturnValue({
      list: mocks.storageList,
      remove: mocks.storageRemove,
      upload: mocks.storageUpload,
    });
    mocks.storageList.mockResolvedValue({ data: [], error: null });
    mocks.storageRemove.mockResolvedValue({ error: null });
    mocks.storageUpload.mockResolvedValue({ error: null });
  });

  it("stores regenerated PDFs under a fresh object path while cleaning both storage layouts", async () => {
    const pdfBlob = new Blob(["pdf"]);
    mocks.dbSelectOr.mockResolvedValue({
      data: [
        {
          id: "row-legacy",
          file_name: "old.pdf",
          file_path: "calculators/pesos/job-1/old.pdf",
        },
        {
          id: "row-copy",
          file_name: "copy.pdf",
          file_path: "job-1/calculators/pesos/copy.pdf",
        },
        {
          // Stage-scoped sibling: belongs to another slot, must be kept.
          id: "row-stage",
          file_name: "stage.pdf",
          file_path: "calculators/pesos/job-1/stage-2-main/stage.pdf",
        },
      ],
      error: null,
    });
    mocks.storageList
      .mockResolvedValueOnce({
        data: [
          { name: "old.pdf" },
          { name: "orphan.pdf" },
          { name: "stage-2-main", id: null },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [{ name: "copy.pdf" }], error: null });

    await uploadJobPdfWithCleanup(
      "job-1",
      pdfBlob,
      "Pesos Report - Show.pdf",
      "calculators/pesos"
    );

    expect(mocks.dbSelectOr).toHaveBeenCalledWith(
      "file_path.like.calculators/pesos/job-1/%,file_path.like.job-1/calculators/pesos/%"
    );
    expect(mocks.storageList).toHaveBeenNthCalledWith(1, "calculators/pesos/job-1");
    expect(mocks.storageList).toHaveBeenNthCalledWith(2, "job-1/calculators/pesos");

    const removedPaths = mocks.storageRemove.mock.calls[0][0] as string[];
    expect(removedPaths).toHaveLength(3);
    expect(removedPaths).toEqual(
      expect.arrayContaining([
        "calculators/pesos/job-1/old.pdf",
        "calculators/pesos/job-1/orphan.pdf",
        "job-1/calculators/pesos/copy.pdf",
      ])
    );

    expect(mocks.dbDeleteIn).toHaveBeenCalledWith("id", ["row-legacy", "row-copy"]);
    expect(mocks.dbDeleteEq).toHaveBeenCalledWith("job_id", "job-1");

    const [objectPath, uploadedBlob, uploadOptions] = mocks.storageUpload.mock.calls[0];
    expect(objectPath).toMatch(
      /^calculators\/pesos\/job-1\/[a-zA-Z0-9-]+-Pesos_Report_-_Show\.pdf$/
    );
    expect(uploadedBlob).toBe(pdfBlob);
    expect(uploadOptions).toMatchObject({
      cacheControl: "0",
      contentType: "application/pdf",
      upsert: false,
    });

    expect(mocks.dbInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        file_name: "Pesos_Report_-_Show.pdf",
        file_path: objectPath,
        job_id: "job-1",
      })
    );
  });

  it("keeps documents rejected by the cleanup filter (shared category folders)", async () => {
    mocks.dbSelectOr.mockResolvedValue({
      data: [
        {
          id: "row-sound",
          file_name: "Sound_Power_Report_-_Show.pdf",
          file_path: "calculators/consumos/job-1/Sound_Power_Report_-_Show.pdf",
        },
        {
          id: "row-video",
          file_name: "Video_Power_Report_-_Show.pdf",
          file_path: "calculators/consumos/job-1/Video_Power_Report_-_Show.pdf",
        },
      ],
      error: null,
    });
    mocks.storageList
      .mockResolvedValueOnce({
        data: [
          { name: "Sound_Power_Report_-_Show.pdf" },
          { name: "Video_Power_Report_-_Show.pdf" },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    await uploadJobPdfWithCleanup(
      "job-1",
      new Blob(["pdf"]),
      "Sound Power Report - Show.pdf",
      "calculators/consumos",
      {
        cleanupFilter: ({ fileName }) => !fileName.toLowerCase().includes("video"),
      }
    );

    expect(mocks.storageRemove).toHaveBeenCalledWith([
      "calculators/consumos/job-1/Sound_Power_Report_-_Show.pdf",
    ]);
    expect(mocks.dbDeleteIn).toHaveBeenCalledWith("id", ["row-sound"]);
  });

  it("skips cleanup entirely when the row lookup fails, so storage and DB stay consistent", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.dbSelectOr.mockResolvedValue({ data: null, error: { message: "boom" } });

    await uploadJobPdfWithCleanup(
      "job-1",
      new Blob(["pdf"]),
      "Pesos Report - Show.pdf",
      "calculators/pesos"
    );

    // No storage files may be deleted without their matching DB rows.
    expect(mocks.storageList).not.toHaveBeenCalled();
    expect(mocks.storageRemove).not.toHaveBeenCalled();
    expect(mocks.dbDeleteIn).not.toHaveBeenCalled();

    // The new version still gets uploaded and recorded.
    expect(mocks.storageUpload).toHaveBeenCalledTimes(1);
    expect(mocks.dbInsert).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("scopes cleanup to the stage folder when a cleanup scope is provided", async () => {
    await uploadJobPdfWithCleanup(
      "job-1",
      new Blob(["pdf"]),
      "Pesos Report - Show.pdf",
      "calculators/pesos",
      { cleanupScope: "stage-1-main" }
    );

    expect(mocks.dbSelectOr).toHaveBeenCalledWith(
      "file_path.like.calculators/pesos/job-1/stage-1-main/%,file_path.like.job-1/calculators/pesos/stage-1-main/%"
    );
    expect(mocks.storageList).toHaveBeenNthCalledWith(1, "calculators/pesos/job-1/stage-1-main");
    expect(mocks.storageList).toHaveBeenNthCalledWith(2, "job-1/calculators/pesos/stage-1-main");
    expect(mocks.storageRemove).not.toHaveBeenCalled();
    expect(mocks.dbDeleteIn).not.toHaveBeenCalled();

    const [objectPath] = mocks.storageUpload.mock.calls[0];
    expect(objectPath).toMatch(
      /^calculators\/pesos\/job-1\/stage-1-main\/[a-zA-Z0-9-]+-Pesos_Report_-_Show\.pdf$/
    );
  });
});
