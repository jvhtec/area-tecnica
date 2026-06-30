import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  dbDeleteEq: vi.fn(),
  dbDeleteLike: vi.fn(),
  dbInsert: vi.fn(),
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
      delete: vi.fn(() => ({
        like: mocks.dbDeleteLike,
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
    mocks.dbDeleteLike.mockReturnValue({ eq: mocks.dbDeleteEq });
    mocks.dbInsert.mockResolvedValue({ error: null });
    mocks.functionsInvoke.mockResolvedValue({ data: null, error: null });
    mocks.storageFrom.mockReturnValue({
      list: mocks.storageList,
      remove: mocks.storageRemove,
      upload: mocks.storageUpload,
    });
    mocks.storageList.mockResolvedValue({ data: [{ name: "old.pdf" }], error: null });
    mocks.storageRemove.mockResolvedValue({ error: null });
    mocks.storageUpload.mockResolvedValue({ error: null });
  });

  it("stores regenerated PDFs under a fresh object path while cleaning the stable job/category folder", async () => {
    const pdfBlob = new Blob(["pdf"]);

    await uploadJobPdfWithCleanup(
      "job-1",
      pdfBlob,
      "Pesos Report - Show.pdf",
      "calculators/pesos"
    );

    expect(mocks.storageList).toHaveBeenCalledWith("calculators/pesos/job-1");
    expect(mocks.storageRemove).toHaveBeenCalledWith([
      "calculators/pesos/job-1/old.pdf",
    ]);
    expect(mocks.dbDeleteLike).toHaveBeenCalledWith(
      "file_path",
      "calculators/pesos/job-1/%"
    );
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
});
