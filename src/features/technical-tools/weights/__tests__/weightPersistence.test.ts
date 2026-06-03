import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  autoCompletePesosTasks: vi.fn(),
  uploadJobPdfWithCleanup: vi.fn(),
}));

vi.mock("@/utils/jobDocumentsUpload", () => ({
  uploadJobPdfWithCleanup: mocks.uploadJobPdfWithCleanup,
}));

vi.mock("@/utils/taskAutoCompletion", () => ({
  autoCompletePesosTasks: mocks.autoCompletePesosTasks,
}));

import { uploadWeightReportAndCompleteTasks } from "@/features/technical-tools/weights/weightPersistence";

describe("technical weight report persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads the Pesos PDF and returns completed task count", async () => {
    mocks.uploadJobPdfWithCleanup.mockResolvedValue(undefined);
    mocks.autoCompletePesosTasks.mockResolvedValue({ completedCount: 2 });
    const pdfBlob = new Blob(["pdf"]);

    await expect(uploadWeightReportAndCompleteTasks({
      fileName: "Pesos.pdf",
      jobId: "job-1",
      pdfBlob,
    })).resolves.toBe(2);

    expect(mocks.uploadJobPdfWithCleanup).toHaveBeenCalledWith(
      "job-1",
      pdfBlob,
      "Pesos.pdf",
      "calculators/pesos",
    );
    expect(mocks.autoCompletePesosTasks).toHaveBeenCalledWith("job-1");
  });

  it("scopes Pesos PDF cleanup to the selected stage", async () => {
    mocks.uploadJobPdfWithCleanup.mockResolvedValue(undefined);
    mocks.autoCompletePesosTasks.mockResolvedValue({ completedCount: 1 });
    const pdfBlob = new Blob(["pdf"]);

    await uploadWeightReportAndCompleteTasks({
      fileName: "Pesos - Main Stage.pdf",
      jobId: "job-1",
      pdfBlob,
      stage: { number: 1, name: "Main Stage" },
    });

    expect(mocks.uploadJobPdfWithCleanup).toHaveBeenCalledWith(
      "job-1",
      pdfBlob,
      "Pesos - Main Stage.pdf",
      "calculators/pesos",
      { cleanupScope: "stage-1-main-stage" },
    );
  });


  it("keeps successful uploads non-fatal when Pesos auto-completion fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.uploadJobPdfWithCleanup.mockResolvedValue(undefined);
    mocks.autoCompletePesosTasks.mockRejectedValue(new Error("task failure"));

    await expect(uploadWeightReportAndCompleteTasks({
      fileName: "Pesos.pdf",
      jobId: "job-1",
      pdfBlob: new Blob(["pdf"]),
    })).resolves.toBe(0);

    expect(warnSpy).toHaveBeenCalledWith("Task auto-completion failed:", expect.any(Error));
    warnSpy.mockRestore();
  });

  it("still fails when the Pesos PDF upload fails", async () => {
    mocks.uploadJobPdfWithCleanup.mockRejectedValue(new Error("upload failure"));

    await expect(uploadWeightReportAndCompleteTasks({
      fileName: "Pesos.pdf",
      jobId: "job-1",
      pdfBlob: new Blob(["pdf"]),
    })).rejects.toThrow("upload failure");

    expect(mocks.autoCompletePesosTasks).not.toHaveBeenCalled();
  });
});
