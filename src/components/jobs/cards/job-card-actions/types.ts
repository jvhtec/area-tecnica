import type React from "react";

import type { Department } from "@/types/department";
import type { Job } from "@/types/job";
import type { FlatElementNode } from "@/utils/flex-folders";
import type { TechnicalPowerSummaryAvailability } from "@/utils/technicalPowerTypes";

export type JobCardLocationObject = {
  name?: string | null;
  formatted_address?: string | null;
};

export type JobCardLocation = string | JobCardLocationObject | null | undefined;

export type JobCardFlexFolder = {
  department: string | null;
  element_id: string;
  elementId?: string | null;
  folder_type: string;
  id: string;
  key?: string | null;
  name?: string | null;
};

export interface JobCardJob extends Job {
  date?: string | null;
  dryhire_presupuesto_element_id?: string | null;
  dryhirePresupuestoElementId?: string | null;
  flex_budget_element_id?: string | null;
  flexBudgetElementId?: string | null;
  flex_folders?: JobCardFlexFolder[] | null;
  flex_presupuesto_element_id?: string | null;
  flexPresupuestoElementId?: string | null;
  job_name?: string | null;
  job_date_types?: Array<{ date?: string | null; type?: string | null }> | null;
  location?: JobCardLocation;
  location_data?: JobCardLocationObject | null;
  name?: string | null;
  presupuesto_element_id?: string | null;
  presupuestoElementId?: string | null;
  tour?: {
    id: string;
    flex_main_folder_id?: string | null;
    flex_sound_folder_id?: string | null;
    flex_lights_folder_id?: string | null;
    flex_video_folder_id?: string | null;
    flex_production_folder_id?: string | null;
    flex_personnel_folder_id?: string | null;
  } | null;
  tour_id?: string | null;
}

export type JobWhatsappGroup = {
  id: string;
  wa_group_id?: string | null;
};

export type JobWhatsappRequest = {
  id: string;
  created_at?: string | null;
  status?: string | null;
};

export interface JobCardActionsProps {
  job: JobCardJob;
  userRole: string | null;
  foldersAreCreated: boolean;
  isProjectManagementPage: boolean;
  isHouseTech: boolean;
  showUpload: boolean;
  canEditJobs: boolean;
  canCreateFlexFolders: boolean;
  canUploadDocuments: boolean;
  canManageArtists: boolean;
  department?: Department;
  isCreatingFolders?: boolean;
  isCreatingLocalFolders?: boolean;
  folderStateLoading?: boolean;
  currentFolderStep?: string;
  techName?: string;
  onRefreshData: (e: React.MouseEvent) => void;
  onEditButtonClick: (e: React.MouseEvent) => void;
  onDeleteClick: (e: React.MouseEvent) => void;
  onCreateFlexFolders: (e: React.MouseEvent) => void;
  onAddFlexFolders?: (e: React.MouseEvent) => void;
  onCreateLocalFolders: (e: React.MouseEvent) => void;
  onFestivalArtistsClick: (e: React.MouseEvent) => void;
  onAssignmentDialogOpen: (e: React.MouseEvent) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onJobDetailsClick?: () => void;
  onOpenTasks?: (e: React.MouseEvent) => void;
  canSyncFlex?: boolean;
  onSyncFlex?: (e: React.MouseEvent) => void;
  onOpenFlexLogs?: (e: React.MouseEvent) => void;
  transportButtonLabel?: string;
  transportButtonTone?: "default" | "outline" | "secondary" | "ghost";
  onTransportClick?: (e: React.MouseEvent) => void;
  onCreateWhatsappGroup?: (e: React.MouseEvent) => void;
  onRetryWhatsappGroup?: (e: React.MouseEvent) => void;
  whatsappDisabled?: boolean;
  whatsappGroup?: JobWhatsappGroup | null;
  whatsappRequest?: JobWhatsappRequest | null;
}

export type JobAssignmentRow = {
  id: string;
  technician_id: string;
  single_day: boolean;
  assignment_date: string | null;
  profiles:
    | { first_name: string | null; last_name: string | null; phone: string | null }
    | { first_name: string | null; last_name: string | null; phone: string | null }[]
    | null;
};

export type WaProdAssignment = {
  id: string;
  technician_id: string;
  single_day: boolean;
  assignment_date: string | null;
  profile: { first_name: string | null; last_name: string | null; phone: string | null } | null;
};

export type WaProdTimesheetRow = {
  technician_id: string;
  date: string | null;
};

export type WaSendResult = {
  success: boolean;
  sentCount: number;
  failed: Array<{ recipient_id: string; reason: string }>;
  job_id: string | null;
};

export type TourdateSelectorInfo = {
  mainElementId: string;
  filterDate: string;
} | null;

export type MainFlexInfo = {
  elementId: string;
  department?: string | null;
} | null;

export type TechnicalPowerPackState = {
  canGenerateTechnicalPowerPack: boolean;
  isGeneratingTechnicalPowerPack: boolean;
  isTechnicalPowerDepartmentsLoading: boolean;
  isTechnicalPowerSummaryPreviewLoading: boolean;
  canRetryTechnicalPowerPack: boolean;
  hasRequiredTechnicalPowerDepartments: boolean;
  hasAvailableTechnicalPowerDepartments: boolean;
  technicalPowerSummaryStatus: TechnicalPowerSummaryAvailability;
  getTechnicalPowerPackTooltip: () => string;
  handleGenerateTechnicalPowerPack: (e: React.MouseEvent) => Promise<void>;
};

export type FlexOpeningState = {
  canOpenFlex: boolean;
  flexSelectorOpen: boolean;
  flexUuid: string | null;
  isFlexLoading: boolean;
  mainFlexInfo: MainFlexInfo;
  tourdateSelectorInfo: TourdateSelectorInfo;
  getFlexButtonTitle: () => string;
  handleOpenFlex: (e: React.MouseEvent) => Promise<void>;
  handleFlexElementSelect: (elementId: string, node?: FlatElementNode) => void;
  setFlexSelectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTourdateSelectorInfo: React.Dispatch<React.SetStateAction<TourdateSelectorInfo>>;
};

export const MADRID_TIME_ZONE = "Europe/Madrid" as const;
