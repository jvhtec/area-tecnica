import React from 'react';

import { cn } from '@/lib/utils';
import type { MatrixStaffingStatus } from '@/components/matrix/optimized-matrix-cell/types';

/**
 * The A: / O: chips a cell shows while a staffing conversation is open, plus
 * their retry and cancel affordances.
 *
 * Split out of OptimizedMatrixCell so the cell body reads as layout again; the
 * decisions about *which* job a retry or a cancel targets stay in the cell,
 * which is the only place that knows about the assignment and the date maps.
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
  availabilityRetrying: boolean;
  positionClass: string;
  /**
   * False on touch: the chips stay as status, and their retry/cancel actions are
   * offered as full-width rows in the cell's action sheet instead of as 15px
   * buttons nobody can hit.
   */
  interactive?: boolean;
  onRetryAvailability: () => void;
  onCancelAvailability: () => void;
  onRetryOffer: () => void;
  onCancelOffer: () => void;
}

export const MatrixCellStaffingBadges: React.FC<MatrixCellStaffingBadgesProps> = ({
  staffingStatus,
  availabilityRetrying,
  positionClass,
  interactive = true,
  onRetryAvailability,
  onCancelAvailability,
  onRetryOffer,
  onCancelOffer,
}) => {
  const stop = (handler: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    handler();
  };

  if (!interactive) {
    return (
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
  }

  return (
    <div className={cn(positionClass, 'z-10 flex items-center gap-1')}>
      {staffingStatus.availability_status && (
        <span className="inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={stop(onRetryAvailability)}
            title="Reintentar solicitud de disponibilidad"
            className="focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-full"
          >
            <span
              className={cn(
                chipClass,
                toneFor(staffingStatus.availability_status),
                availabilityRetrying && 'ring-1 ring-primary',
              )}
            >
              {availabilityRetrying ? 'A:↻' : `A:${glyphFor(staffingStatus.availability_status)}`}
            </span>
          </button>
          <button
            type="button"
            onClick={stop(onCancelAvailability)}
            title="Cancelar solicitud de disponibilidad"
            className="focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-full"
          >
            <span className={cn(chipClass, 'border-border bg-background/80 text-muted-foreground')}>×</span>
          </button>
        </span>
      )}

      {staffingStatus.offer_status && (
        <span className="inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={stop(onRetryOffer)}
            title="Reintentar oferta"
            className="focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-full"
          >
            <span className={cn(chipClass, toneFor(staffingStatus.offer_status))}>
              {`O:${glyphFor(staffingStatus.offer_status)}`}
            </span>
          </button>
          <button
            type="button"
            onClick={stop(onCancelOffer)}
            title="Cancelar oferta"
            className="focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-full"
          >
            <span className={cn(chipClass, 'border-border bg-background/80 text-muted-foreground')}>×</span>
          </button>
        </span>
      )}
    </div>
  );
};
