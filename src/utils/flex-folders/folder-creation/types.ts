import type { Database } from "@/integrations/supabase/types";
import type { CreateFoldersOptions } from "@/utils/flex-folders/types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

export type FlexFolderLocation =
  | string
  | {
      name?: string | null;
      formatted_address?: string | null;
    }
  | null
  | undefined;

export type FlexFolderJob = Pick<
  JobRow,
  "id" | "title" | "start_time" | "end_time"
> & {
  job_type?: JobRow["job_type"] | string;
  job_departments?: Array<{ department?: string | null }> | null;
  location?: FlexFolderLocation;
  location_data?: FlexFolderLocation;
  timezone?: JobRow["timezone"];
  tour_date_id?: JobRow["tour_date_id"];
  tour_id?: JobRow["tour_id"];
  venue_name?: string | null;
};

export type FlexFolderRow = {
  id: string;
  element_id: string;
  parent_id: string | null;
  folder_type: string | null;
  department: string | null;
};

export type FolderCreationBaseArgs = {
  job: FlexFolderJob;
  formattedStartDate: string;
  formattedEndDate: string;
  documentNumber: string;
  options?: CreateFoldersOptions;
  safeJobTitle: string;
};

export type ExistingFolderMaps = {
  existingDepartmentMap: Map<string, FlexFolderRow>;
  existingTourDateDepartmentMap: Map<string, FlexFolderRow>;
  existingWorkOrderMap: Map<string, FlexFolderRow>;
};

export type PullsheetTemplate = {
  name: string;
  suffix: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
};

export type PullsheetMetadataEntry = {
  name?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
};

export type DryhireCreatedElement = {
  label: string;
  elementId: string;
  documentNumber: string;
};

export type DryhireHeaderFields = DryhireCreatedElement & {
  plannedStartDate: string;
  plannedEndDate: string;
};
