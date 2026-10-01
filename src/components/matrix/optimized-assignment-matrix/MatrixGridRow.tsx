import React from "react";

import { OptimizedMatrixCell } from "@/components/matrix/OptimizedMatrixCell";
import type {
  CancelStaffingMutate,
  MatrixStaffingStatus,
  OptimizedMatrixCellProps,
  SendStaffingEmailMutate,
} from "@/components/matrix/optimized-matrix-cell/types";

// Shared so rows with no declined jobs or no selection keep a stable prop.
const EMPTY_DECLINED_JOB_IDS: Set<string> = new Set<string>();
const EMPTY_SELECTED_DATE_KEYS: Set<string> = new Set<string>();

export interface MatrixStaffingMaps {
  byJob: Map<string, MatrixStaffingStatus>;
  byDate: Map<string, MatrixStaffingStatus>;
}

export interface MatrixGridRowProps {
  technician: OptimizedMatrixCellProps["technician"];
  /** Position in the ordered list, which places the row. */
  rowIndex: number;
  /** The rendered column window, plus its dates and their Madrid day keys. */
  colStart: number;
  visibleDates: Date[];
  visibleDateKeys: string[];
  cellWidth: number;
  cellHeight: number;
  getAssignmentForCell: (technicianId: string, date: Date) => OptimizedMatrixCellProps["assignment"];
  getAvailabilityForCell: (technicianId: string, date: Date) => OptimizedMatrixCellProps["availability"];
  staffingMaps?: MatrixStaffingMaps | null;
  /** This row's selected days, as Madrid day keys. */
  selectedDateKeys?: Set<string>;
  selectionActive: boolean;
  declinedJobIds?: Set<string>;
  isFridge: boolean;
  allowDirectAssign: boolean;
  allowMarkUnavailable: boolean;
  mobile: boolean;
  staffingDepartment: string | null;
  hideStaffingEmailButtons: boolean;
  hideStaffingWhatsappButtons: boolean;
  onSelect: OptimizedMatrixCellProps["onSelect"];
  onClick: OptimizedMatrixCellProps["onClick"];
  onOpenSheet: NonNullable<OptimizedMatrixCellProps["onOpenSheet"]>;
  onPrefetch: NonNullable<OptimizedMatrixCellProps["onPrefetch"]>;
  onOptimisticUpdate: NonNullable<OptimizedMatrixCellProps["onOptimisticUpdate"]>;
  onRender: () => void;
  sendStaffingEmail: SendStaffingEmailMutate;
  isSendingStaffingEmail: boolean;
  cancelStaffing: CancelStaffingMutate;
  isCancellingStaffing: boolean;
}

/**
 * One technician's row of the assignment grid.
 *
 * Memoised as a unit: scrolling down mounts the newly visible row while every
 * other row bails out at a single shallow prop comparison, instead of the grid
 * re-deriving and re-diffing each of its few hundred cells on every scroll step.
 */
export const MatrixGridRow = React.memo(function MatrixGridRow({
  technician,
  rowIndex,
  colStart,
  visibleDates,
  visibleDateKeys,
  cellWidth,
  cellHeight,
  getAssignmentForCell,
  getAvailabilityForCell,
  staffingMaps,
  selectedDateKeys = EMPTY_SELECTED_DATE_KEYS,
  selectionActive,
  declinedJobIds = EMPTY_DECLINED_JOB_IDS,
  isFridge,
  allowDirectAssign,
  allowMarkUnavailable,
  mobile,
  staffingDepartment,
  hideStaffingEmailButtons,
  hideStaffingWhatsappButtons,
  onSelect,
  onClick,
  onOpenSheet,
  onPrefetch,
  onOptimisticUpdate,
  onRender,
  sendStaffingEmail,
  isSendingStaffingEmail,
  cancelStaffing,
  isCancellingStaffing,
}: MatrixGridRowProps) {
  return (
    <div
      className="matrix-row"
      style={{ top: rowIndex * cellHeight, height: cellHeight }}
    >
      {visibleDates.map((date, offset) => {
        const dateIndex = colStart + offset;
        const cellKey = `${technician.id}-${visibleDateKeys[offset]}`;
        const assignment = getAssignmentForCell(technician.id, date);
        const jobId: string | undefined = assignment?.job_id;
        const staffingByJob = jobId ? staffingMaps?.byJob.get(`${jobId}-${technician.id}`) ?? null : null;
        const staffingByDate = staffingMaps?.byDate.get(cellKey) ?? null;

        return (
          <div
            key={dateIndex}
            className="matrix-cell-wrapper"
            style={{ left: dateIndex * cellWidth, width: cellWidth, height: cellHeight }}
          >
            <OptimizedMatrixCell
              technician={technician}
              date={date}
              assignment={assignment}
              availability={getAvailabilityForCell(technician.id, date)}
              width={cellWidth}
              height={cellHeight}
              isSelected={selectedDateKeys.has(visibleDateKeys[offset])}
              onSelect={onSelect}
              onClick={onClick}
              onOpenSheet={onOpenSheet}
              selectionActive={selectionActive}
              onPrefetch={onPrefetch}
              onOptimisticUpdate={onOptimisticUpdate}
              onRender={onRender}
              jobId={jobId}
              declinedJobIdsSet={declinedJobIds}
              allowDirectAssign={allowDirectAssign}
              allowMarkUnavailable={allowMarkUnavailable}
              staffingStatusProvided={staffingByJob}
              staffingStatusByDateProvided={staffingByDate}
              isFridge={isFridge}
              mobile={mobile}
              staffingDepartment={staffingDepartment}
              hideStaffingEmailButtons={hideStaffingEmailButtons}
              hideStaffingWhatsappButtons={hideStaffingWhatsappButtons}
              sendStaffingEmail={sendStaffingEmail}
              isSendingStaffingEmail={isSendingStaffingEmail}
              cancelStaffing={cancelStaffing}
              isCancellingStaffing={isCancellingStaffing}
            />
          </div>
        );
      })}
    </div>
  );
});
