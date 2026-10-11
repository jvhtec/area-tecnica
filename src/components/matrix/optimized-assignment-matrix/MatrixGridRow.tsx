import React from "react";

import { OptimizedMatrixCell } from "@/components/matrix/OptimizedMatrixCell";
import type { MatrixStaffingStatus, OptimizedMatrixCellProps } from "@/components/matrix/optimized-matrix-cell/types";

// Shared so rows with no selection keep a stable prop.
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
  isFridge: boolean;
  mobile: boolean;
  onSelect: OptimizedMatrixCellProps["onSelect"];
  onInspect: OptimizedMatrixCellProps["onInspect"];
  onConfirm: OptimizedMatrixCellProps["onConfirm"];
  onDecline: OptimizedMatrixCellProps["onDecline"];
  onPrefetch: NonNullable<OptimizedMatrixCellProps["onPrefetch"]>;
  onRender: () => void;
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
  isFridge,
  mobile,
  onSelect,
  onInspect,
  onConfirm,
  onDecline,
  onPrefetch,
  onRender,
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
              onInspect={onInspect}
              onConfirm={onConfirm}
              onDecline={onDecline}
              selectionActive={selectionActive}
              onPrefetch={onPrefetch}
              onRender={onRender}
              staffingStatusProvided={staffingByJob}
              staffingStatusByDateProvided={staffingByDate}
              isFridge={isFridge}
              mobile={mobile}
            />
          </div>
        );
      })}
    </div>
  );
});
