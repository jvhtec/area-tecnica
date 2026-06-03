import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  autoCompleteConsumosTasks: vi.fn(),
  uploadJobPdfWithCleanup: vi.fn(),
}));

vi.mock("@/utils/jobDocumentsUpload", () => ({
  uploadJobPdfWithCleanup: mocks.uploadJobPdfWithCleanup,
}));

vi.mock("@/utils/taskAutoCompletion", () => ({
  autoCompleteConsumosTasks: mocks.autoCompleteConsumosTasks,
}));

import { uploadPowerReportAndCompleteTask } from "@/features/technical-tools/power/powerPersistence";

describe("technical power report persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads department-specific Consumos PDFs and returns completed task count", async () => {
    mocks.uploadJobPdfWithCleanup.mockResolvedValue(undefined);
    mocks.autoCompleteConsumosTasks.mockResolvedValue({ completedCount: 3 });
    const pdfBlob = new Blob(["pdf"]);

    await expect(uploadPowerReportAndCompleteTask({
      department: "lights",
      fileName: "Lights.pdf",
      jobId: "job-1",
      pdfBlob,
    })).resolves.toBe(3);

    expect(mocks.uploadJobPdfWithCleanup).toHaveBeenCalledWith(
      "job-1",
      pdfBlob,
      "Lights.pdf",
      "calculators/lights-consumos",
    );
    expect(mocks.autoCompleteConsumosTasks).toHaveBeenCalledWith("job-1", "lights");
  });

  it("scopes Consumos PDF cleanup to the selected stage", async () => {
    mocks.uploadJobPdfWithCleanup.mockResolvedValue(undefined);
    mocks.autoCompleteConsumosTasks.mockResolvedValue({ completedCount: 1 });
    const pdfBlob = new Blob(["pdf"]);

    await uploadPowerReportAndCompleteTask({
      department: "sound",
      fileName: "Sound - Main Stage.pdf",
      jobId: "job-1",
      pdfBlob,
      stage: { number: 1, name: "Main Stage" },
    });

    expect(mocks.uploadJobPdfWithCleanup).toHaveBeenCalledWith(
      "job-1",
      pdfBlob,
      "Sound - Main Stage.pdf",
      "calculators/consumos",
      { cleanupScope: "stage-1-main-stage" },
    );
  });


  it("keeps successful power uploads non-fatal when auto-completion fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.uploadJobPdfWithCleanup.mockResolvedValue(undefined);
    mocks.autoCompleteConsumosTasks.mockRejectedValue(new Error("task failure"));

    await expect(uploadPowerReportAndCompleteTask({
      department: "sound",
      fileName: "Sound.pdf",
      jobId: "job-1",
      pdfBlob: new Blob(["pdf"]),
    })).resolves.toBe(0);

    expect(warnSpy).toHaveBeenCalledWith("Task auto-completion failed:", expect.any(Error));
    warnSpy.mockRestore();
  });

  it("still fails when the power PDF upload fails", async () => {
    mocks.uploadJobPdfWithCleanup.mockRejectedValue(new Error("upload failure"));

    await expect(uploadPowerReportAndCompleteTask({
      department: "video",
      fileName: "Video.pdf",
      jobId: "job-1",
      pdfBlob: new Blob(["pdf"]),
    })).rejects.toThrow("upload failure");

    expect(mocks.autoCompleteConsumosTasks).not.toHaveBeenCalled();
  });
});
