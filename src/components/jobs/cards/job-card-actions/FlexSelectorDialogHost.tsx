import { FlexElementSelectorDialog } from "@/components/flex/FlexElementSelectorDialog";
import type {
  FlexOpeningState,
  JobCardJob,
} from "@/components/jobs/cards/job-card-actions/types";
import { createTourdateFilterPredicate } from "@/utils/flex-folders";
import type { Department } from "@/types/department";

type FlexSelectorDialogHostProps = {
  department?: Department;
  flexOpening: FlexOpeningState;
  job: JobCardJob;
};

export const FlexSelectorDialogHost = ({
  department,
  flexOpening,
  job,
}: FlexSelectorDialogHostProps) => {
  let selectorMainElementId: string | undefined;

  if (flexOpening.tourdateSelectorInfo) {
    selectorMainElementId = flexOpening.tourdateSelectorInfo.mainElementId;
  } else if (flexOpening.mainFlexInfo?.elementId) {
    selectorMainElementId = flexOpening.mainFlexInfo.elementId;
  }

  if (!selectorMainElementId || job.job_type === "dryhire") {
    return null;
  }

  return (
    <FlexElementSelectorDialog
      open={flexOpening.flexSelectorOpen}
      onOpenChange={(open) => {
        flexOpening.setFlexSelectorOpen(open);
        if (!open) {
          flexOpening.setTourdateSelectorInfo(null);
        }
      }}
      mainElementId={selectorMainElementId}
      onSelect={flexOpening.handleFlexElementSelect}
      defaultElementId={
        job.flex_folders?.find((folder) =>
          folder.department?.toLowerCase() === department?.toLowerCase()
        )?.element_id || flexOpening.mainFlexInfo?.elementId
      }
      filterPredicate={
        flexOpening.tourdateSelectorInfo
          ? createTourdateFilterPredicate(flexOpening.tourdateSelectorInfo.filterDate)
          : undefined
      }
    />
  );
};
