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
  availability_job_title?: string | null;
  offer_job_id?: string | null;
  offer_job_title?: string | null;
  availability_requested_by?: string | null;
  availability_actor_label?: string | null;
  availability_created_at?: string | null;
  offer_requested_by?: string | null;
  offer_actor_label?: string | null;
  offer_created_at?: string | null;
  pending_availability_job_ids?: string[];
  pending_availability_job_titles?: string[];
  pending_offer_job_ids?: string[];
  pending_offer_job_titles?: string[];
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
  // The cell passes its own identity back rather than being handed a closure
  // bound to it: one stable handler shared by every cell is what lets the memo
  // around OptimizedMatrixCell actually hold.
  onSelect: (technicianId: string, date: Date, selected: boolean) => void;
  onClick: (technicianId: string, date: Date, action: MatrixCellAction, selectedJobId?: string) => void;
  onPrefetch?: (technicianId: string) => void;
  onOptimisticUpdate?: (technicianId: string, jobId: string, status: string) => void;
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
  // Owned by the matrix, not the cell: one mutation observer for the grid
  // instead of two per rendered cell.
  sendStaffingEmail: (payload: unknown) => void;
  isSendingStaffingEmail?: boolean;
  cancelStaffing: (payload: unknown) => void;
  isCancellingStaffing?: boolean;
}

export type AssignmentLifecycleResult = {
  error?: string;
};
