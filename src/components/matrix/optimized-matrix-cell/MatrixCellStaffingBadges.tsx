import React from 'react';

import { cn } from '@/lib/utils';
import type { MatrixStaffingStatus } from '@/components/matrix/optimized-matrix-cell/types';

/**
 * The A: / O: chips a cell shows while a staffing conversation is open. They are
 * status only: resending or cancelling a request is done in the cell's inspector.
 */

const STATUS_TONE: Record<string, string> = {
  confirmed: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  declined: 'border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-300',
  pending: 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300',
};

const toneFor = (status: string | null | undefined) =>
  STATUS_TONE[status === 'confirmed' ? 'confirmed' : status === 'declined' ? 'declined' : 'pending'];

const glyphFor = (status: string | null | undefined) =>
  status === 'confirmed' ? '✓' : status === 'declined' ? '✗' : '?';

const chipClass = 'inline-flex h-4 items-center rounded-full border px-1.5 text-xs font-semibold leading-none';

interface MatrixCellStaffingBadgesProps {
  staffingStatus: MatrixStaffingStatus;
  positionClass: string;
}

export const MatrixCellStaffingBadges: React.FC<MatrixCellStaffingBadgesProps> = ({ staffingStatus, positionClass }) => (
  <div className={cn(positionClass, 'z-10 flex items-center gap-1')}>
    {staffingStatus.availability_status && (
      <span className={cn(chipClass, toneFor(staffingStatus.availability_status))}>
        {`A:${glyphFor(staffingStatus.availability_status)}`}
      </span>
    )}
    {staffingStatus.offer_status && (
      <span className={cn(chipClass, toneFor(staffingStatus.offer_status))}>
        {`O:${glyphFor(staffingStatus.offer_status)}`}
      </span>
    )}
  </div>
);
