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
        file_name: "Pesos Report - Show.pdf",
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

  it("keeps the previous document when the replacement upload fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.dbSelectOr.mockResolvedValue({
      data: [
        {
          id: "row-old",
          file_name: "old.pdf",
          file_path: "calculators/pesos/job-1/old.pdf",
        },
      ],
      error: null,
    });
    mocks.storageList
      .mockResolvedValueOnce({ data: [{ name: "old.pdf" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    mocks.storageUpload.mockResolvedValue({ error: { message: "upload failed" } });

    await expect(
      uploadJobPdfWithCleanup(
        "job-1",
        new Blob(["pdf"]),
        "Pesos Report - Show.pdf",
        "calculators/pesos"
      )
    ).rejects.toEqual({ message: "upload failed" });

    expect(mocks.storageRemove).not.toHaveBeenCalled();
    expect(mocks.dbDeleteIn).not.toHaveBeenCalled();
    expect(mocks.dbInsert).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("removes only the untracked replacement object when its DB insert fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.dbSelectOr.mockResolvedValue({
      data: [
        {
          id: "row-old",
          file_name: "old.pdf",
          file_path: "calculators/pesos/job-1/old.pdf",
        },
      ],
      error: null,
    });
    mocks.storageList
      .mockResolvedValueOnce({ data: [{ name: "old.pdf" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    mocks.dbInsert.mockResolvedValue({ error: { message: "insert failed" } });

    await expect(
      uploadJobPdfWithCleanup(
        "job-1",
        new Blob(["pdf"]),
        "Pesos Report - Show.pdf",
        "calculators/pesos"
      )
    ).rejects.toEqual({ message: "insert failed" });

    expect(mocks.storageRemove).toHaveBeenCalledTimes(1);
    const replacementPath = mocks.storageRemove.mock.calls[0][0][0] as string;
    expect(replacementPath).toMatch(
      /^calculators\/pesos\/job-1\/[a-zA-Z0-9-]+-Pesos_Report_-_Show\.pdf$/
    );
    expect(replacementPath).not.toBe("calculators/pesos/job-1/old.pdf");
    expect(mocks.dbDeleteIn).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("retains old DB rows when their storage cleanup fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.dbSelectOr.mockResolvedValue({
      data: [
        {
          id: "row-old",
          file_name: "old.pdf",
          file_path: "calculators/pesos/job-1/old.pdf",
        },
      ],
      error: null,
    });
    mocks.storageList
      .mockResolvedValueOnce({ data: [{ name: "old.pdf" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    mocks.storageRemove.mockResolvedValue({ error: { message: "remove failed" } });

    await uploadJobPdfWithCleanup(
      "job-1",
      new Blob(["pdf"]),
      "Pesos Report - Show.pdf",
      "calculators/pesos"
    );

    expect(mocks.storageRemove).toHaveBeenCalledWith([
      "calculators/pesos/job-1/old.pdf",
    ]);
    expect(mocks.dbDeleteIn).not.toHaveBeenCalled();
    expect(mocks.dbInsert).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("serializes concurrent replacements of the same logical document slot", async () => {
    let resolveFirstUpload!: (value: { error: null }) => void;
    const firstUpload = new Promise<{ error: null }>((resolve) => {
      resolveFirstUpload = resolve;
    });
    mocks.storageUpload
      .mockImplementationOnce(() => firstUpload)
      .mockResolvedValue({ error: null });

    const firstRun = uploadJobPdfWithCleanup(
      "job-1",
      new Blob(["first"]),
      "Pesos Report - First.pdf",
      "calculators/pesos"
    );
    await vi.waitFor(() => expect(mocks.storageUpload).toHaveBeenCalledTimes(1));

    const secondRun = uploadJobPdfWithCleanup(
      "job-1",
      new Blob(["second"]),
      "Pesos Report - Second.pdf",
      "calculators/pesos"
    );
    await Promise.resolve();

    // The second run must not even discover/clean the slot until the first
    // replacement is fully published.
    expect(mocks.dbSelectOr).toHaveBeenCalledTimes(1);
    expect(mocks.storageUpload).toHaveBeenCalledTimes(1);

    resolveFirstUpload({ error: null });
    await firstRun;
    await secondRun;

    expect(mocks.dbSelectOr).toHaveBeenCalledTimes(2);
    expect(mocks.storageUpload).toHaveBeenCalledTimes(2);
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
