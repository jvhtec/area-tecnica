import type { useCancelStaffingRequest, useSendStaffingEmail } from '@/features/staffing/hooks/useStaffing';

/**
 * The matrix owns these mutations and threads `mutate` down to the cells, which
 * call it with an options object (`{ onSuccess, onError }`) to clear their own
 * retry spinner and to settle the promise the cancel dialog awaits.
 *
 * They are derived from the hooks rather than restated so the payload shapes
 * stay checked at the call sites. Previously these props were declared unary
 * (`(payload: unknown) => void`) and re-declared as `any` one level down, which
 * hid both the second argument and the payload: a handler typed to satisfy that
 * contract could legally drop the callbacks, leaving the retry button stuck on
 * "Reenviando…" and the cancel dialog's `Promise.all` pending forever.
 */
export type SendStaffingEmailMutate = ReturnType<typeof useSendStaffingEmail>['mutate'];
export type CancelStaffingMutate = ReturnType<typeof useCancelStaffingRequest>['mutate'];

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
  sendStaffingEmail: SendStaffingEmailMutate;
  isSendingStaffingEmail?: boolean;
  cancelStaffing: CancelStaffingMutate;
  isCancellingStaffing?: boolean;
}

export type AssignmentLifecycleResult = {
  error?: string;
};
