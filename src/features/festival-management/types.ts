import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";

import type { Department } from "@/types/department";
import type { JobType } from "@/types/job";

import type { useFestivalAdminActions } from "./hooks/useFestivalAdminActions";
import type { useFestivalDocuments } from "./hooks/useFestivalDocuments";
import type { useFestivalFlexControls } from "./hooks/useFestivalFlexControls";
import type { useFestivalMapPreview } from "./hooks/useFestivalMapPreview";
import type { useFestivalPrintActions } from "./hooks/useFestivalPrintActions";
import type { useFestivalWhatsappActions } from "./hooks/useFestivalWhatsappActions";

export interface FestivalJob {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  created_at: string;
  location_id?: string | null;
  job_type: JobType;
  tour_id?: string | null;
  tour_date_id?: string | null;
  [key: string]: unknown;
}

export interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  profile_complete: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  show_start: string;
  show_end: string;
  technical_info: unknown;
  infrastructure_info: unknown;
  extras: unknown;
  notes?: string;
}

export interface Stage {
  id: string;
  name: string;
  number: number;
}

export interface JobDocumentEntry {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  read_only?: boolean;
  template_type?: string | null;
}

export interface ArtistRiderFile {
  id: string;
  file_name: string;
  file_path: string;
  created_at: string;
  uploaded_at?: string | null;
  artist_id?: string;
  festival_artists?: {
    id: string;
    name: string;
  } | null;
}

export type FestivalStageOption = {
  number: number;
  name: string;
};

export type FestivalVenueData = {
  address?: string;
  coordinates?: { lat: number; lng: number };
};

export type GroupedRiderFiles = Array<{
  artistId: string;
  artistName: string;
  files: ArtistRiderFile[];
}>;

export type FestivalWhatsappDepartment = "sound" | "lights" | "video";

export type FestivalArchiveMode = "by-prefix" | "all-tech";

export type FestivalFlexStatus = {
  label: string;
  variant: "outline" | "destructive" | "secondary";
};

export type FestivalJobDetailsData = {
  artistCount: number;
  festivalStageOptions: FestivalStageOption[];
  job: FestivalJob;
  jobDates: Date[];
  maxStages: number;
  venueData: FestivalVenueData;
};

export type FestivalDocumentsData = {
  artistRiderFiles: ArtistRiderFile[];
  jobDocuments: JobDocumentEntry[];
};

export type FestivalArchiveResult = {
  attempted?: number;
  uploaded?: number;
  skipped?: number;
  failed?: number;
  [key: string]: unknown;
};

export type FestivalBackfillResult = {
  inserted?: number;
  already?: number;
  [key: string]: unknown;
};

export type FestivalLocalFoldersResult = {
  message?: string;
  [key: string]: unknown;
};

type FestivalManagementLocalVm = {
  assignmentDepartment: Department;
  artistCount: number;
  canEdit: boolean;
  departmentOptions: Department[];
  festivalStageOptions: FestivalStageOption[];
  flexError: string | null;
  flexUuid: string | null;
  folderExists: boolean | null;
  handleAssignmentChange: () => void;
  handleNavigateTimesheets: () => void;
  handleOpenAssignments: () => void;
  handleOpenJobDetails: () => void;
  handleOpenRouteSheet: () => void;
  handleRefreshAll: () => void;
  humanizeDepartment: (department: Department) => string;
  isArtistRoute: boolean;
  isAssignmentDialogOpen: boolean;
  isFlexLoading: boolean;
  isGearRoute: boolean;
  isJobDetailsOpen: boolean;
  isJobPresetsOpen: boolean;
  isLoading: boolean;
  isManagementUser?: boolean;
  isRouteSheetOpen: boolean;
  isSchedulingRoute: boolean;
  isSingleJobMode: boolean;
  isViewOnly: boolean;
  job: FestivalJob;
  jobDates: Date[];
  jobId: string;
  maxStages: number;
  navigate: NavigateFunction;
  navigateToCalculator: (type: "pesos" | "consumos") => void;
  setAssignmentDepartment: Dispatch<SetStateAction<Department>>;
  setIsAssignmentDialogOpen: Dispatch<SetStateAction<boolean>>;
  setIsJobDetailsOpen: Dispatch<SetStateAction<boolean>>;
  setIsJobPresetsOpen: Dispatch<SetStateAction<boolean>>;
  setIsRouteSheetOpen: Dispatch<SetStateAction<boolean>>;
  userRole: string | null | undefined;
  venueData: FestivalVenueData;
};

export type FestivalManagementVm = FestivalManagementLocalVm &
  ReturnType<typeof useFestivalAdminActions> &
  ReturnType<typeof useFestivalDocuments> &
  ReturnType<typeof useFestivalFlexControls> &
  ReturnType<typeof useFestivalMapPreview> &
  ReturnType<typeof useFestivalPrintActions> &
  ReturnType<typeof useFestivalWhatsappActions>;
