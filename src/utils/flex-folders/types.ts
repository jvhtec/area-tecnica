
import { Department } from "@/types/department";

export interface FlexFolderPayload {
  definitionId: string;
  parentElementId?: string;
  open: boolean;
  locked: boolean;
  name: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  locationId?: string;
  departmentId?: string;
  documentNumber?: string;
  personResponsibleId?: string;
}

export interface FlexFolderResponse {
  elementId: string;
  [key: string]: any;
}

export interface FolderCreationParams {
  job: any;
  formattedStartDate: string;
  formattedEndDate: string;
  documentNumber: string;
}
