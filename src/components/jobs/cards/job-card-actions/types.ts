import type React from "react";

import type { Department } from "@/types/department";
import type { FlatElementNode } from "@/utils/flex-folders";
import type { TechnicalPowerSummaryAvailability } from "@/utils/technicalPowerTypes";

export interface JobCardActionsProps {
  job: any;
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
  whatsappGroup?: any;
  whatsappRequest?: any;
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
