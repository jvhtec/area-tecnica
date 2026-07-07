import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";

import type { useFestivalAdminActions } from "@/features/festival-management/hooks/useFestivalAdminActions";
import type { useFestivalDocuments } from "@/features/festival-management/hooks/useFestivalDocuments";
import type { useFestivalFlexControls } from "@/features/festival-management/hooks/useFestivalFlexControls";
import type { useFestivalMapPreview } from "@/features/festival-management/hooks/useFestivalMapPreview";
import type { useFestivalPrintActions } from "@/features/festival-management/hooks/useFestivalPrintActions";
import type { useFestivalWhatsappActions } from "@/features/festival-management/hooks/useFestivalWhatsappActions";
import type { Department } from "@/types/department";
import type { Job, JobType } from "@/types/job";

export interface FestivalJob extends Omit<Job, "location_id" | "tour_date_id"> {
  location_id?: string;
  job_type: JobType;
  tour_id?: string | null;
  tour_date_id?: string;
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
  file_size?: number | null;
  file_type?: string | null;
  created_at?: string | null;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
  artist_id?: string;
  festival_artists?: {
    id: string;
    name: string;
  } | null;
}

export type RiderStatus = "missing" | "outdated" | "complete";

export type RiderFreshnessArtist = {
  rider_copied_from_date?: string | null;
  rider_missing?: boolean | null;
  rider_outdated?: boolean | null;
  rider_outdated_dismissed?: boolean | null;
};

export type RiderLibraryFile = {
  id: string;
  artist_id: string;
  created_at?: string | null;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  file_type?: string | null;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
};

export type RiderLibrarySourceArtist = {
  id: string;
  date?: string | null;
  job_id?: string | null;
  name: string;
  stage?: number | null;
};

export type RiderLibrarySourceJob = {
  id: string;
  end_time?: string | null;
  job_type?: JobType | string | null;
  start_time?: string | null;
  title?: string | null;
};

export type RiderLibraryEntry = {
  alreadyImported: boolean;
  artistId: string;
  artistName: string;
  duplicateFilePaths: string[];
  files: RiderLibraryFile[];
  latestUploadedAt: string | null;
  sourceDate: string | null;
  sourceJobId: string | null;
  sourceJobTitle: string;
  sourceJobType: JobType | string | null;
  sourceStage: number | null;
};

export type RiderLibraryImportInput = {
  sourceArtistId: string;
  targetDate: string;
  targetJobId: string;
  targetStage: number;
};

export type RiderLibraryImportResult = {
  imported_artist_id: string;
  imported_file_count: number;
  target_date: string;
  target_stage: number;
};

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
  canUploadDocuments: boolean;
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
  handleOpenRiderLibrary: (initialDate?: string | null) => void;
  handleRefreshAll: () => void;
  humanizeDepartment: (department: Department) => string;
  isArtistRoute: boolean;
  isAssignmentDialogOpen: boolean;
  isFlexLoading: boolean;
  isGearRoute: boolean;
  isHouseTech: boolean;
  isJobDetailsOpen: boolean;
  isJobPresetsOpen: boolean;
  isLoading: boolean;
  isManagementUser?: boolean;
  isPlanningViewOnly: boolean;
  isRouteSheetOpen: boolean;
  isRiderLibraryOpen: boolean;
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
  setIsRiderLibraryOpen: Dispatch<SetStateAction<boolean>>;
  riderLibraryInitialDate: string | null;
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
