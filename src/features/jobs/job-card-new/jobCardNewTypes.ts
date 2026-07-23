import type { QueryClient } from "@tanstack/react-query";

import type { Department } from "@/types/department";
import type {
  JobAssignmentForCard,
  JobDateTypeForCard,
  JobDocumentRow,
  OptimizedJobCardJob,
  useOptimizedJobCard,
} from "@/hooks/useOptimizedJobCard";
import type { Database } from "@/integrations/supabase/types";
import type { CreateFoldersOptions } from "@/utils/flex-folders";
import type { FlexFolderJob } from "@/utils/flex-folders/folder-creation/types";
import type { TourDateLike } from "@/utils/assignmentWorkDates";
import type { CalendarArtist } from "@/utils/calendarArtists";
import type { JobCardJob as JobCardActionsJob } from "@/components/jobs/cards/job-card-actions/types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type TransportRequestRow = Database["public"]["Tables"]["transport_requests"]["Row"];
type TransportRequestItemRow = Database["public"]["Tables"]["transport_request_items"]["Row"];
type WhatsappGroupRow = Database["public"]["Tables"]["job_whatsapp_groups"]["Row"];
type WhatsappRequestRow = Database["public"]["Tables"]["job_whatsapp_group_requests"]["Row"];

export type JobDepartmentRef = {
  department?: string | null;
};

export type JobTourRef = {
  id?: string | null;
};

export type JobTourDateRef = TourDateLike & {
  tour?: JobTourRef | null;
  [key: string]: unknown;
};

export type JobCardJob = OptimizedJobCardJob &
  FlexFolderJob & {
    created_at: JobCardActionsJob["created_at"];
    color?: string | null;
    darkColor?: string | null;
    flex_folders_created?: boolean | null;
    flex_folders_exist?: boolean | null;
    festival_artists?: CalendarArtist[] | null;
    job_date_types?: JobDateTypeForCard[] | null;
    job_departments?: JobDepartmentRef[] | null;
    job_name?: JobCardActionsJob["job_name"];
    job_type: JobCardActionsJob["job_type"];
    location?: JobCardActionsJob["location"];
    location_data?: JobCardActionsJob["location_data"];
    name?: JobCardActionsJob["name"];
    status?: string | null;
    title: JobCardActionsJob["title"];
    tour_date?: JobTourDateRef | null;
    venue_name?: string | null;
  };

export type TransportRequestItem = Pick<
  TransportRequestItemRow,
  "id" | "leftover_space_meters"
> & {
  transport_type: Database["public"]["Enums"]["transport_type"];
};

export type TransportRequestSummary = Omit<
  Pick<
  TransportRequestRow,
  "id" | "department" | "status" | "note" | "description" | "created_at"
  >,
  "department"
> & {
  department: Department;
  items: TransportRequestItem[] | null;
};

export type SelectedTransportRequest = TransportRequestSummary & {
  selectedItem?: TransportRequestItem;
};

export type JobTimesheetStatus = {
  technician_id: string;
  status: string;
  date: string | null;
};

export type WhatsappGroupSummary = Pick<WhatsappGroupRow, "id" | "wa_group_id">;
export type WhatsappRequestSummary = Pick<WhatsappRequestRow, "id" | "created_at">;

export type TransportButtonTone = "default" | "secondary" | "outline";
export type FlexPickerMode = "create" | "add";

type OptimizedJobCardResult = ReturnType<typeof useOptimizedJobCard>;

export type JobCardAssignmentRows = JobAssignmentForCard[];
export type JobCardDocuments = JobDocumentRow[];
export type JobCardRequiredSummary = OptimizedJobCardResult["reqSummary"];
export type JobCardRequiredVsAssigned = OptimizedJobCardResult["requiredVsAssigned"];
export type JobCardSoundTasks = OptimizedJobCardResult["soundTasks"];

export type JobCardTransportState = {
  allRequests: TransportRequestSummary[];
  checkAndFulfillRequest: (requestId: string, department: string) => Promise<void>;
  handleCreateWhatsappGroup: (event: React.MouseEvent) => Promise<void>;
  handleRetryWhatsappGroup: (event: React.MouseEvent) => Promise<void>;
  handleTransportClick: (event: React.MouseEvent) => void;
  isTechDept: boolean;
  jobTimesheets: JobTimesheetStatus[];
  myTransportRequest: TransportRequestSummary | null | undefined;
  transportButtonLabel: string | undefined;
  transportButtonTone: TransportButtonTone;
  waGroup: WhatsappGroupSummary | null | undefined;
  waRequest: WhatsappRequestSummary | null | undefined;
};

export type JobCardFolderActions = {
  addFlexFoldersHandler: (event: React.MouseEvent) => void;
  createFlexFoldersHandler: (event: React.MouseEvent) => void;
  createLocalFoldersHandler: (event: React.MouseEvent) => Promise<void>;
  handleDeleteClick: (event: React.MouseEvent) => Promise<void>;
  handleFlexPickerConfirm: (
    options?: CreateFoldersOptions,
    modeOverride?: FlexPickerMode,
  ) => Promise<void>;
  syncStatusToFlex: (event: React.MouseEvent) => Promise<void>;
};

export type JobCardTransportDependencies = {
  assignments: JobCardAssignmentRows;
  confirm: ReturnType<typeof import("@/components/ui/confirm-dialog").useConfirm>;
  currentUserDepartment: string | null;
  department: Department;
  isFestivalLike: boolean;
  isManagementUser: boolean;
  job: JobCardJob;
  queryClient: QueryClient;
  setLogisticsDialogOpen: (open: boolean) => void;
  setLogisticsInitialEventType: (value: "load" | "unload" | undefined) => void;
  setSelectedTransportRequest: (request: SelectedTransportRequest | null) => void;
  setTransportDialogOpen: (open: boolean) => void;
  toast: ReturnType<typeof import("@/hooks/use-toast").useToast>["toast"];
};

export type JobCardFolderDependencies = {
  actualFoldersExist: boolean;
  addDeletingJob: (jobId: string) => void;
  confirm: ReturnType<typeof import("@/components/ui/confirm-dialog").useConfirm>;
  flexPickerMode: FlexPickerMode;
  isCreatingFolders: boolean;
  isCreatingLocalFolders: boolean;
  isJobBeingDeleted: boolean;
  isManagementUser: boolean;
  job: JobCardJob;
  onDeleteClick: (jobId: string) => void;
  queryClient: QueryClient;
  removeDeletingJob: (jobId: string) => void;
  setFlexPickerMode: (mode: FlexPickerMode) => void;
  setFlexPickerOpen: (open: boolean) => void;
  setFlexPickerOptions: (options: CreateFoldersOptions | undefined) => void;
  setIsCreatingFolders: (creating: boolean) => void;
  setIsCreatingLocalFolders: (creating: boolean) => void;
  toast: ReturnType<typeof import("@/hooks/use-toast").useToast>["toast"];
};
