import type React from "react";

export type TechSortMethod =
  | "default"
  | "location"
  | "name-asc"
  | "name-desc"
  | "surname-asc"
  | "surname-desc";

export type MatrixCellActionType =
  | "select-job"
  | "select-job-for-staffing"
  | "assign"
  | "unavailable"
  | "confirm"
  | "decline"
  | "offer-details"
  | "offer-details-wa"
  | "offer-details-email"
  | "availability-wa"
  | "availability-email"
  | "toggle-unavailable";

export type StaffingIntentPhase = "availability" | "offer";
export type StaffingChannel = "email" | "whatsapp";
export type StaffingMatrixStatus = "confirmed" | "declined" | "expired" | "requested" | "sent" | null;

export interface MatrixSkill {
  name?: string;
  category?: string | null;
  proficiency?: number | null;
  is_primary?: boolean | null;
}

export interface MatrixTechnician {
  id: string;
  first_name: string;
  nickname?: string | null;
  last_name: string;
  email: string;
  phone?: string | null;
  dni?: string | null;
  department: string;
  role: string;
  bg_color?: string | null;
  profile_picture_url?: string | null;
  assignable_as_tech?: boolean | null;
  soundvision_access_enabled?: boolean | null;
  skills?: MatrixSkill[];
}

export interface MatrixJob {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  status: string;
  job_type: string;
  assigned_count?: number;
  worked_count?: number;
  total_cost_eur?: number;
  approved_cost_eur?: number;
  _assigned_count?: number;
}

export interface MatrixAvailability {
  user_id: string;
  date: string;
  status: string;
  notes?: string;
  reason?: string;
}

export interface MatrixAssignmentMetadata {
  job_id: string;
  technician_id: string;
  status: string | null;
  response_time?: string | null;
  assigned_at: string | null;
  assigned_by?: string | null;
  single_day?: boolean | null;
  assignment_date?: string | null;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
}

export interface MatrixTimesheetAssignment extends MatrixAssignmentMetadata {
  date: string;
  job: MatrixJob;
  is_schedule_only?: boolean | null;
  source?: string | null;
}

export interface MatrixStaffingByJobStatus {
  availability_status: StaffingMatrixStatus;
  offer_status: StaffingMatrixStatus;
}

export interface MatrixStaffingByDateStatus extends MatrixStaffingByJobStatus {
  availability_job_id?: string | null;
  offer_job_id?: string | null;
  availability_requested_by?: string | null;
  availability_created_at?: string | null;
  offer_requested_by?: string | null;
  offer_created_at?: string | null;
  pending_availability_job_ids?: string[];
  pending_offer_job_ids?: string[];
}

export interface MatrixStaffingMaps {
  byJob: Map<string, MatrixStaffingByJobStatus>;
  byDate: Map<string, MatrixStaffingByDateStatus>;
}

export interface CellAction {
  type: MatrixCellActionType;
  technicianId: string;
  date: Date;
  assignment?: MatrixTimesheetAssignment;
  selectedJobId?: string;
  singleDay?: boolean;
  intendedPhase?: StaffingIntentPhase;
  intendedChannel?: StaffingChannel;
}

export interface MatrixConflictDialogState {
  open: boolean;
  details: {
    conflicts?: Array<{
      job_name?: string;
      job_type?: string;
      start_time?: string;
      end_time?: string;
      role?: string;
    }>;
    unavailability?: Array<{
      date?: string;
      start_date?: string;
      end_date?: string;
      reason?: string;
    }>;
  };
  originalPayload: Record<string, unknown>;
}

export interface MatrixAvailabilityDialogState {
  open: boolean;
  jobId: string;
  profileId: string;
  dateIso: string;
  singleDay: boolean;
  channel: StaffingChannel;
}

export interface OptimizedAssignmentMatrixProps {
  technicians: MatrixTechnician[];
  dates: Date[];
  jobs: MatrixJob[];
}

export interface OptimizedAssignmentMatrixExtendedProps extends OptimizedAssignmentMatrixProps {
  onNearEdgeScroll?: (direction: "before" | "after") => void;
  canExpandBefore?: boolean;
  canExpandAfter?: boolean;
  allowDirectAssign?: boolean;
  allowMarkUnavailable?: boolean;
  fridgeSet?: Set<string>;
  cellWidth?: number;
  cellHeight?: number;
  technicianWidth?: number;
  headerHeight?: number;
  mobile?: boolean;
}

export interface MatrixViewportState {
  TECHNICIAN_WIDTH: number;
  HEADER_HEIGHT: number;
  CELL_WIDTH: number;
  CELL_HEIGHT: number;
  matrixWidth: number;
  matrixHeight: number;
  dateHeadersRef: React.RefObject<HTMLDivElement>;
  technicianScrollRef: React.RefObject<HTMLDivElement>;
  mainScrollRef: React.RefObject<HTMLDivElement>;
  visibleCols: { start: number; end: number };
  visibleRows: { start: number; end: number };
  canNavLeft: boolean;
  canNavRight: boolean;
  handleMobileNav: (dir: "left" | "right") => void;
  handleDateHeadersScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleTechnicianScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleMainScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

export interface MatrixSortingState {
  isManagementUser: boolean;
  cycleTechSort: () => void;
  getSortLabel: () => string;
  setSortJobId: React.Dispatch<React.SetStateAction<string | null>>;
  createUserOpen: boolean;
  setCreateUserOpen: (open: boolean) => void;
  techMedalRankings: Map<string, "gold" | "silver" | "bronze">;
  techLastYearMedalRankings: Map<string, "gold" | "silver" | "bronze">;
}

export interface MatrixDataState {
  isFetching: boolean;
  isInitialLoading: boolean;
  dates: Date[];
  technicians: MatrixTechnician[];
  orderedTechnicians: MatrixTechnician[];
  jobs: MatrixJob[];
  fridgeSet?: Set<string>;
  allowDirectAssign: boolean;
  allowMarkUnavailable?: boolean;
  mobile: boolean;
  selectedCells: Set<string>;
  staffingMaps: MatrixStaffingMaps;
  profileNamesMap: Map<string, string>;
  declinedJobsByTech: Map<string, Set<string>>;
  getJobsForDate: (date: Date) => MatrixJob[];
  getAssignmentForCell: (technicianId: string, date: Date) => MatrixTimesheetAssignment | undefined;
  getAvailabilityForCell: (technicianId: string, date: Date) => MatrixAvailability | undefined;
}

export interface MatrixActionsState {
  handleCellSelect: (technicianId: string, date: Date, selected: boolean) => void;
  handleCellClick: (technicianId: string, date: Date, action: MatrixCellActionType, selectedJobId?: string) => void;
  handleCellPrefetch: (technicianId: string) => void;
  handleOptimisticUpdate: (technicianId: string, jobId: string, status: string) => void;
  incrementCellRender: () => void;
  handleUserCreated: () => void;
}

export interface MatrixDialogsState {
  cellAction: CellAction | null;
  currentTechnician: MatrixTechnician | null;
  closeDialogs: () => void;
  handleJobSelected: (jobId: string) => void;
  handleStaffingActionSelected: (jobId: string, action: StaffingIntentPhase, options?: { singleDay?: boolean }) => void;
  forcedStaffingAction?: StaffingIntentPhase;
  forcedStaffingChannel?: StaffingChannel;
  availabilityDialog: MatrixAvailabilityDialogState | null;
  setAvailabilityDialog: (value: MatrixAvailabilityDialogState | null) => void;
  availabilityCoverage: "full" | "single" | "multi";
  setAvailabilityCoverage: (value: "full" | "single" | "multi") => void;
  availabilitySingleDate: Date | null;
  setAvailabilitySingleDate: (value: Date | null) => void;
  availabilityMultiDates: Date[];
  setAvailabilityMultiDates: (value: Date[]) => void;
  availabilitySending: boolean;
  setAvailabilitySending: (value: boolean) => void;
  conflictDialog: MatrixConflictDialogState | null;
  setConflictDialog: (value: MatrixConflictDialogState | null) => void;
  handleEmailError: (error: unknown, payload: Record<string, unknown>) => void;
  offerChannel: StaffingChannel;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  sendStaffingEmail: (
    payload: Record<string, unknown>,
    options?: {
      onSuccess?: (data: { channel?: string }) => void;
      onError?: (error: Error) => void;
    }
  ) => void;
  checkTimeConflictEnhanced: (
    technicianId: string,
    jobId: string,
    options: { includePending: boolean; targetDateIso?: string; singleDayOnly?: boolean }
  ) => Promise<{
    hasHardConflict: boolean;
    hasSoftConflict?: boolean;
    unavailabilityConflicts?: unknown[];
    hardConflicts: Array<{
      title: string;
      start_time?: string;
      end_time?: string;
    }>;
    softConflicts?: Array<{
      title: string;
      start_time?: string;
      end_time?: string;
    }>;
  }>;
}

export interface GroupedOptimizedAssignmentMatrixViewProps {
  viewport: MatrixViewportState;
  data: MatrixDataState;
  actions: MatrixActionsState;
  dialogs: MatrixDialogsState;
  sorting: MatrixSortingState;
}

/**
 * @deprecated Backward-compatibility shape for legacy matrix view consumers.
 * Prefer GroupedOptimizedAssignmentMatrixViewProps for all new code.
 */
export interface LegacyOptimizedAssignmentMatrixViewProps {
  isFetching: boolean;
  isInitialLoading: boolean;
  TECHNICIAN_WIDTH: number;
  HEADER_HEIGHT: number;
  CELL_WIDTH: number;
  CELL_HEIGHT: number;
  matrixWidth: number;
  matrixHeight: number;
  dateHeadersRef: React.RefObject<HTMLDivElement>;
  technicianScrollRef: React.RefObject<HTMLDivElement>;
  mainScrollRef: React.RefObject<HTMLDivElement>;
  visibleCols: { start: number; end: number };
  visibleRows: { start: number; end: number };
  dates: Date[];
  technicians: MatrixTechnician[];
  orderedTechnicians: MatrixTechnician[];
  fridgeSet?: Set<string>;
  allowDirectAssign: boolean;
  allowMarkUnavailable?: boolean;
  mobile: boolean;
  canNavLeft: boolean;
  canNavRight: boolean;
  handleMobileNav: (dir: "left" | "right") => void;
  handleDateHeadersScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleTechnicianScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleMainScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  cycleTechSort: () => void;
  getSortLabel: () => string;
  isManagementUser: boolean;
  setCreateUserOpen: (open: boolean) => void;
  createUserOpen: boolean;
  qc?: { invalidateQueries: (options: { queryKey: readonly unknown[] | unknown[] }) => Promise<unknown> | unknown };
  setSortJobId: React.Dispatch<React.SetStateAction<string | null>>;
  getJobsForDate: (date: Date) => MatrixJob[];
  getAssignmentForCell: (technicianId: string, date: Date) => MatrixTimesheetAssignment | undefined;
  getAvailabilityForCell: (technicianId: string, date: Date) => MatrixAvailability | undefined;
  selectedCells: Set<string>;
  staffingMaps: MatrixStaffingMaps;
  profileNamesMap: Map<string, string>;
  handleCellSelect: (technicianId: string, date: Date, selected: boolean) => void;
  handleCellClick: (technicianId: string, date: Date, action: MatrixCellActionType, selectedJobId?: string) => void;
  handleCellPrefetch: (technicianId: string) => void;
  handleOptimisticUpdate: (technicianId: string, jobId: string, status: string) => void;
  incrementCellRender: () => void;
  handleUserCreated?: () => void;
  declinedJobsByTech: Map<string, Set<string>>;
  cellAction: CellAction | null;
  currentTechnician: MatrixTechnician | null;
  closeDialogs: () => void;
  handleJobSelected: (jobId: string) => void;
  handleStaffingActionSelected: (jobId: string, action: StaffingIntentPhase, options?: { singleDay?: boolean }) => void;
  forcedStaffingAction?: StaffingIntentPhase;
  forcedStaffingChannel?: StaffingChannel;
  jobs: MatrixJob[];
  offerChannel: StaffingChannel;
  toast: MatrixDialogsState["toast"];
  sendStaffingEmail: MatrixDialogsState["sendStaffingEmail"];
  checkTimeConflictEnhanced: MatrixDialogsState["checkTimeConflictEnhanced"];
  availabilityDialog: MatrixAvailabilityDialogState | null;
  setAvailabilityDialog: (value: MatrixAvailabilityDialogState | null) => void;
  availabilityCoverage: "full" | "single" | "multi";
  setAvailabilityCoverage: (value: "full" | "single" | "multi") => void;
  availabilitySingleDate: Date | null;
  setAvailabilitySingleDate: (value: Date | null) => void;
  availabilityMultiDates: Date[];
  setAvailabilityMultiDates: (value: Date[]) => void;
  availabilitySending: boolean;
  setAvailabilitySending: (value: boolean) => void;
  handleEmailError: (error: unknown, payload: Record<string, unknown>) => void;
  conflictDialog: MatrixConflictDialogState | null;
  setConflictDialog: (value: MatrixConflictDialogState | null) => void;
  isGlobalCellSelected?: (technicianId: string, date: Date) => boolean;
  techMedalRankings: Map<string, "gold" | "silver" | "bronze">;
  techLastYearMedalRankings: Map<string, "gold" | "silver" | "bronze">;
}

// TODO(matrix-view-migration): remove LegacyOptimizedAssignmentMatrixViewProps once all consumers use the grouped shape.
export type OptimizedAssignmentMatrixViewProps =
  | GroupedOptimizedAssignmentMatrixViewProps
  | LegacyOptimizedAssignmentMatrixViewProps;
