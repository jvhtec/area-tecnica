export const uploadWeightReportAndCompleteTasks = async ({
  fileName,
  jobId,
  pdfBlob,
}: {
  fileName: string;
  jobId: string;
  pdfBlob: Blob;
}) => {
  const { uploadJobPdfWithCleanup } = await import("@/utils/jobDocumentsUpload");
  await uploadJobPdfWithCleanup(jobId, pdfBlob, fileName, "calculators/pesos");

  try {
    const { autoCompletePesosTasks } = await import("@/utils/taskAutoCompletion");
    const result = await autoCompletePesosTasks(jobId);

    return result.completedCount;
  } catch (error) {
    console.warn("Task auto-completion failed:", error);
    return 0;
  }
};
