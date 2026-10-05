import type { useCancelStaffingRequest, useSendStaffingEmail } from '@/features/staffing/hooks/useStaffing';

/**
 * The matrix owns these mutations. They are derived from the hooks rather than
 * restated so the payload shapes stay checked at the call sites. Sending goes
 * through `mutateAsync`: each call has its own promise, which `mutate`'s per-call
 * callbacks do not (only the latest call's fire), and a batch sends concurrently.
 */
export type SendStaffingEmailAsync = ReturnType<typeof useSendStaffingEmail>['mutateAsync'];
export type CancelStaffingAsync = ReturnType<typeof useCancelStaffingRequest>['mutateAsync'];

export interface MatrixStaffingStatus {
  availability_request_id?: string | null;
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
  /** A plain click or tap: opens the inspector. The element is null on touch, where the inspector is a sheet. */
  onInspect: (technicianId: string, date: Date, element: HTMLElement | null) => void;
  /** The ✓ and ✕ of an invited cell. */
  onConfirm: (technicianId: string, date: Date) => void;
  onDecline: (technicianId: string, date: Date) => void;
  onPrefetch?: (technicianId: string) => void;
  /** True while any cell is selected: on touch, a tap then extends the selection. */
  selectionActive?: boolean;
  onRender?: () => void;
  staffingStatusProvided?: MatrixStaffingStatus | null;
  staffingStatusByDateProvided?: MatrixStaffingStatus | null;
  isFridge?: boolean;
  mobile?: boolean;
}
