import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";
import { getTechnicalStageStorageScope } from "@/features/technical-tools/stage/stageUtils";

export const uploadWeightReportAndCompleteTasks = async ({
  fileName,
  jobId,
  pdfBlob,
  stage,
}: {
  fileName: string;
  jobId: string;
  pdfBlob: Blob;
  stage?: TechnicalStage | null;
}) => {
  const { uploadJobPdfWithCleanup } = await import("@/utils/jobDocumentsUpload");
  const cleanupScope = getTechnicalStageStorageScope(stage);

  if (cleanupScope) {
    await uploadJobPdfWithCleanup(jobId, pdfBlob, fileName, "calculators/pesos", { cleanupScope });
  } else {
    await uploadJobPdfWithCleanup(jobId, pdfBlob, fileName, "calculators/pesos");
  }

  try {
    const { autoCompletePesosTasks } = await import("@/utils/taskAutoCompletion");
    const result = await autoCompletePesosTasks(jobId);

    return result.completedCount;
  } catch (error) {
    console.warn("Task auto-completion failed:", error);
    return 0;
  }
};
