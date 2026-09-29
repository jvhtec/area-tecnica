import { generateStageGearPDF } from "@/utils/gearSetupPdfExport";
import { isNonEmptyBlob } from "@/utils/pdf/festivalPdfSupport";
import { runProgressJobs, type FestivalSectionContext } from "./context";

export interface GearSection {
  pdfs: Blob[];
  /** The stages that produced a page, in order (stages without a gear setup are skipped). */
  stages: number[];
}

export async function generateGearSection(context: FestivalSectionContext): Promise<GearSection> {
  const { options, jobId, logoUrl, getStageNameByNumber } = context;
  if (!options.includeGearSetup || options.gearSetupStages.length === 0) return { pdfs: [], stages: [] };

  const generated = await runProgressJobs(
    context,
    "gear-setup",
    { preparing: "Preparando dotacion tecnica", running: "Generando dotacion tecnica" },
    options.gearSetupStages,
    async (stageNumber) => {
      const pdf = await generateStageGearPDF(jobId, stageNumber, getStageNameByNumber(stageNumber), logoUrl, {
        paginate: false,
      });
      return isNonEmptyBlob(pdf) ? pdf : null;
    },
  );

  // `generated` is ordered like the stages, so a null entry is a stage with no gear setup.
  return {
    pdfs: generated.filter(isNonEmptyBlob),
    stages: options.gearSetupStages.filter((_, index) => isNonEmptyBlob(generated[index])),
  };
}
