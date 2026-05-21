export type MatrixCellAction =
  | 'select-job'
  | 'select-job-for-staffing'
  | 'assign'
  | 'unavailable'
  | 'confirm'
  | 'decline'
  | 'offer-details'
  | 'offer-details-wa'
  | 'offer-details-email'
  | 'availability-wa'
  | 'availability-email'
  | 'toggle-unavailable';

export interface TimesheetDateRow {
  date: string;
}

export interface MultiDateRemovalState {
  isOpen: boolean;
  isLoading: boolean;
  otherDates: string[];
  otherDatesCount: number;
  currentDate: string | null;
  removeOption: 'single' | 'all';
}

export interface MatrixStaffingStatus {
  availability_status: string | null;
  offer_status: string | null;
  availability_job_id?: string | null;
  offer_job_id?: string | null;
  availability_requested_by?: string | null;
  availability_created_at?: string | null;
  offer_requested_by?: string | null;
  offer_created_at?: string | null;
  pending_availability_job_ids?: string[];
  pending_offer_job_ids?: string[];
}

export interface OptimizedMatrixCellProps {
  technician: {
    id: string;
    first_name: string;
    nickname?: string | null;
    last_name: string;
    department: string;
  };
  date: Date;
  assignment?: any;
  availability?: any;
  width: number;
  height: number;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onClick: (action: MatrixCellAction, selectedJobId?: string) => void;
  onPrefetch?: () => void;
  onOptimisticUpdate?: (status: string) => void;
  onRender?: () => void;
  jobId?: string;
  allowDirectAssign?: boolean;
  allowMarkUnavailable?: boolean;
  declinedJobIdsSet?: Set<string>;
  staffingStatusProvided?: MatrixStaffingStatus | null;
  staffingStatusByDateProvided?: MatrixStaffingStatus | null;
  profileNamesMap?: Map<string, string>;
  isFridge?: boolean;
  mobile?: boolean;
  staffingDepartment?: string | null;
  hideStaffingEmailButtons?: boolean;
  hideStaffingWhatsappButtons?: boolean;
}

export type AssignmentLifecycleResult = {
  error?: string;
};
