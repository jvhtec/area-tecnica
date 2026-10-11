import React, { memo, useCallback } from 'react';
import { badgeVariants } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Check, X, UserX, Ban, Refrigerator } from 'lucide-react';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatMadridDateKey, formatMadridDayKey, isMadridToday, isMadridWeekend } from '@/utils/timezoneUtils';
import { labelForCode } from '@/utils/roles';
import { formatUserName } from '@/utils/userName';
import { pickTextColor, rgbaFromHex } from '@/utils/color';
import { MatrixCellStaffingBadges } from '@/components/matrix/optimized-matrix-cell/MatrixCellStaffingBadges';
import {
  assignmentStatusLabel,
  availabilityStatusLabel,
  normalizeStatus,
  offerStatusLabel,
} from '@/components/matrix/optimized-matrix-cell/helpers';
import type { OptimizedMatrixCellProps } from '@/components/matrix/optimized-matrix-cell/types';
import {
  MATRIX_CELL_CHIP,
  MATRIX_CELL_SURFACE,
  resolveMatrixCellState,
} from '@/components/matrix/matrixCellVisuals';

// Hundreds of cells mount on every scroll step, so the class strings are
// resolved once here instead of through Button/Badge (cva + tailwind-merge +
// Slot) or cn() on every render. Each constant is the exact string those
// components produced, so nothing changes visually.
const CONTROL_BUTTON_BASE = 'h-5 w-5 rounded-full bg-background/70 p-0 shadow-sm';
const CONFIRM_BUTTON_CLASS = cn(buttonVariants({ variant: 'ghost', size: 'sm' }), CONTROL_BUTTON_BASE, 'hover:bg-emerald-500/20');
const DANGER_BUTTON_CLASS = cn(buttonVariants({ variant: 'ghost', size: 'sm' }), CONTROL_BUTTON_BASE, 'hover:bg-rose-500/20');
const STATUS_BADGE_CLASS = cn(badgeVariants({ variant: 'secondary' }), 'h-4 px-1 py-0 text-xs');

/** cn() for the few class combinations a cell can take, merged once each. */
const mergedClassCache = new Map<string, string>();
const cellClass = (...parts: Array<string | false | null | undefined>): string => {
  const key = parts.map((part) => part || '').join('\u0000');
  let merged = mergedClassCache.get(key);
  if (merged === undefined) {
    merged = cn(...parts);
    mergedClassCache.set(key, merged);
  }
  return merged;
};

export const OptimizedMatrixCell = memo(({
  technician,
  date,
  assignment,
  availability,
  width,
  height,
  isSelected,
  onSelect: onSelectProp,
  onInspect: onInspectProp,
  onConfirm: onConfirmProp,
  onDecline: onDeclineProp,
  onPrefetch: onPrefetchProp,
  selectionActive = false,
  onRender,
  staffingStatusProvided = null,
  staffingStatusByDateProvided = null,
  isFridge = false,
  mobile = false,
}: OptimizedMatrixCellProps) => {
  // The parent's handlers are shared by every cell; bind this cell's identity
  // here so the rest of the component keeps its simple call signatures.
  const technicianId = technician.id;
  const onSelect = useCallback(
    (selected: boolean) => onSelectProp(technicianId, date, selected),
    [onSelectProp, technicianId, date],
  );
  const onPrefetch = useCallback(() => onPrefetchProp?.(technicianId), [onPrefetchProp, technicianId]);
  const onInspect = useCallback(
    (element: HTMLElement | null) => onInspectProp(technicianId, date, element),
    [onInspectProp, technicianId, date],
  );

  // Track cell renders for performance monitoring
  React.useEffect(() => {
    onRender?.();
  }, [onRender]);

  const dateKey = formatMadridDateKey(date);
  const isTodayCell = isMadridToday(dateKey);
  const isWeekendCell = isMadridWeekend(dateKey);
  const hasAssignment = !!assignment;
  const assignmentStatus = hasAssignment ? normalizeStatus(assignment.status) : null;
  const isConfirmedAssignment = assignmentStatus === 'confirmed';
  const isDeclinedAssignment = assignmentStatus === 'declined';
  const isUnavailable = availability?.status === 'unavailable';
  const confirmedBg = isConfirmedAssignment ? (assignment?.job?.color || null) : null;
  const confirmedTextColor = confirmedBg ? pickTextColor(confirmedBg) : undefined;
  const confirmedSubTextColor = confirmedTextColor ? (rgbaFromHex(confirmedTextColor, 0.9) || confirmedTextColor) : undefined;
  const displayName = formatUserName(technician.first_name, technician.nickname, technician.last_name) || 'Técnico';

  // Staffing status: use provided batched data exclusively for performance.
  // Use job-specific status for assigned cells, date-based status for empty cells.
  const staffingStatus = isConfirmedAssignment ? null : (hasAssignment ? staffingStatusProvided : staffingStatusByDateProvided);

  const handleMouseEnter = useCallback(() => {
    // Prefetch data when hovering over cell
    onPrefetch?.();
  }, [onPrefetch]);

  // A long press is the only multi-select gesture a phone has: ctrl/alt-click
  // cannot be produced on touch, so batch staffing was unreachable there.
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = React.useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(() => {
    if (!mobile) return;
    longPressFired.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onSelect(!isSelected);
      // Confirms the mode switch on devices that support it; harmless elsewhere.
      navigator.vibrate?.(15);
    }, 450);
  }, [mobile, clearLongPress, onSelect, isSelected]);

  React.useEffect(() => clearLongPress, [clearLongPress]);

  const handleCellClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();

    // Ctrl+Click or Alt+Click to toggle cell selection (for batch actions and Stream Deck)
    if (e.ctrlKey || e.altKey || e.metaKey) {
      onSelect(!isSelected);
      return;
    }

    if (mobile) {
      // The long press already acted; browsers still deliver its click.
      if (longPressFired.current) {
        longPressFired.current = false;
        return;
      }
      // Once a selection exists, tapping extends it: the familiar phone
      // multi-select model.
      if (selectionActive) {
        onSelect(!isSelected);
        return;
      }
    }

    // A plain click always opens the inspector, whatever the cell holds.
    onInspect(mobile ? null : e.currentTarget);
  }, [onSelect, isSelected, mobile, selectionActive, onInspect]);

  // Right-click is the inspector too: the unavailability view is one click away in it.
  const handleRightClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    onInspect(e.currentTarget);
  }, [onInspect]);

  const handleStatusClick = useCallback((e: React.MouseEvent, action: 'confirm' | 'decline') => {
    e.stopPropagation();
    if (action === 'confirm') onConfirmProp(technicianId, date);
    else onDeclineProp(technicianId, date);
  }, [onConfirmProp, onDeclineProp, technicianId, date]);

  // One vocabulary for the whole grid: the state decides both the cell wash and
  // the rounded status card drawn inside it (see matrixCellVisuals).
  const cellState = resolveMatrixCellState({
    isSelected,
    hasAssignment,
    assignmentStatus,
    isUnavailable,
    availabilityStatus: staffingStatus?.availability_status ?? null,
    offerStatus: staffingStatus?.offer_status ?? null,
    isToday: isTodayCell,
    isWeekend: isWeekendCell,
  });
  const chip = MATRIX_CELL_CHIP[cellState];

  // Corner budget, so nothing stacks on top of anything else:
  //   top-left     status indicators (fridge / declined), side by side
  //   bottom-left  staffing status badges, or the confirm / decline buttons
  //   bottom-right assignment status badge
  const statusBadgesPosClass = 'absolute bottom-1.5 left-1.5';

  // The staffing conversation gets its own caption line so an empty-looking cell
  // says what is in flight, instead of only being tinted.
  const staffingCaption = !hasAssignment && !isUnavailable
    ? (staffingStatus?.offer_status
      ? { title: 'Oferta', detail: offerStatusLabel(staffingStatus.offer_status) }
      : staffingStatus?.availability_status
        ? { title: 'Disponibilidad', detail: availabilityStatusLabel(staffingStatus.availability_status) }
        : null)
    : null;

  const showStatusCard = hasAssignment || isUnavailable || !!staffingCaption;

  // A phone cell is a button, so it needs a name: the grid position plus what
  // the cell is currently showing.
  const cellAriaLabel = mobile ? `${displayName}, ${formatMadridDayKey(dateKey, "d 'de' MMMM", { locale: es })}: ${
    hasAssignment
      ? `${assignment.job?.title || 'asignación'} (${assignmentStatusLabel(assignment.status)})`
      : isUnavailable
        ? 'no disponible'
        : staffingCaption
          ? `${staffingCaption.title.toLowerCase()} ${staffingCaption.detail?.toLowerCase() ?? ''}`.trim()
          : 'sin actividad'
  }` : undefined;

  // The corner controls (confirm/decline, the P/R badge, the staffing chips) are
  // drawn over the card, so the card's own text has to step out of their way.
  const hasBottomControls = hasAssignment
    ? !isConfirmedAssignment
    : !!(staffingStatus?.availability_status || staffingStatus?.offer_status);

  // Narrowed once so the badge row can take a non-nullable status.
  const staffingStatusForBadges =
    staffingStatus && (staffingStatus.availability_status || staffingStatus.offer_status) ? staffingStatus : null;

  // A confirmed assignment is painted with the job colour; a pending or declined
  // one keeps the state tint and carries the colour as a left rail, so a
  // technician's jobs stay visually groupable either way.
  const cardStyle = isConfirmedAssignment && assignment?.job?.color
    ? { background: assignment.job.color, borderColor: assignment.job.color }
    : hasAssignment && assignment?.job?.color
      ? { borderLeftColor: assignment.job.color, borderLeftWidth: '3px' }
      : undefined;

  return (
        <div
          className={cellClass(
            'group/cell relative flex flex-col p-1 text-xs transition-colors duration-150',
            'cursor-pointer',
            MATRIX_CELL_SURFACE[cellState],
            isTodayCell && !isSelected && 'shadow-[inset_2px_0_0_0_hsl(var(--primary))]',
          )}
          style={{
            width: `${width}px`,
            height: `${height}px`,
          }}
          id={`mcell-${technicianId}-${dateKey}`}
          data-matrix-cell="true"
          data-matrix-cell-state={cellState}
          // Read by the grid's shared hover tooltip (MatrixCellHoverTooltip).
          data-technician-id={technicianId}
          data-date-key={dateKey}
          role={mobile ? 'button' : undefined}
          tabIndex={mobile ? 0 : undefined}
          aria-label={cellAriaLabel}
          aria-pressed={mobile && selectionActive ? isSelected : undefined}
          onClick={handleCellClick}
          onContextMenu={handleRightClick}
          onMouseEnter={handleMouseEnter}
          onTouchStart={handleTouchStart}
          onTouchEnd={clearLongPress}
          onTouchMove={clearLongPress}
          onTouchCancel={clearLongPress}
        >
          {/* Selection indicator */}
          {isSelected && (
            <div className="absolute top-0 right-0 z-20" title="Celda seleccionada para shortcuts">
              <div className="rounded-bl-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                ✓ SEL.
              </div>
            </div>
          )}

          {/* Status indicators — one row so they never stack on each other */}
          {(isFridge || isDeclinedAssignment) && (
            <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5">
              {isFridge && (
                <span title="En la nevera: no asignable">
                  <Refrigerator className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                </span>
              )}
              {isDeclinedAssignment && (
                <span title="Rechazado: no se puede reasignar a este trabajo">
                  <Ban className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                </span>
              )}
            </div>
          )}

          {/* Status card: the cell's content, drawn as one rounded object */}
          {showStatusCard && (
            <div
              className={cellClass(
                'pointer-events-none flex h-full min-w-0 flex-col overflow-hidden rounded-lg border px-1.5',
                hasBottomControls
                  ? mobile
                    ? 'justify-start pt-1'
                    : 'justify-center pb-4'
                  : 'justify-center',
                chip.card,
              )}
              style={cardStyle}
            >
              {hasAssignment && (
                <div className="min-w-0 pr-6">
                  <div
                    className={cellClass('truncate text-xs font-semibold leading-tight', !isConfirmedAssignment && chip.caption)}
                    style={{ color: isConfirmedAssignment ? confirmedTextColor : undefined }}
                  >
                    {assignment.job?.title || 'Asignación'}
                  </div>
                  <div
                    className={cellClass('truncate text-[11px] leading-tight', !isConfirmedAssignment && chip.detail)}
                    style={{ color: isConfirmedAssignment ? confirmedSubTextColor : undefined }}
                  >
                    {labelForCode(assignment.sound_role || assignment.lights_role || assignment.video_role)}
                  </div>
                  {assignment.single_day && assignment.assignment_date === formatMadridDateKey(date) && (
                    <div
                      className={cellClass('truncate text-[10px] leading-tight', !isConfirmedAssignment && 'text-muted-foreground')}
                      style={{ color: isConfirmedAssignment ? confirmedSubTextColor : undefined }}
                    >
                      Día único: {formatMadridDayKey(assignment.assignment_date, 'd MMM', { locale: es })}
                    </div>
                  )}
                </div>
              )}

              {!hasAssignment && isUnavailable && (
                <div className="flex min-w-0 items-center gap-1.5">
                  <UserX className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
                      No disp.
                    </div>
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">
                      {availability.reason || 'No disponible'}
                    </div>
                  </div>
                </div>
              )}

              {!hasAssignment && !isUnavailable && staffingCaption && (
                <div className="min-w-0">
                  <div className={cellClass('truncate text-xs font-bold uppercase leading-tight tracking-wide', chip.caption)}>
                    {staffingCaption.title}
                  </div>
                  {staffingCaption.detail && (
                    <div className={cellClass('truncate text-xs leading-tight', chip.detail)}>
                      {staffingCaption.detail}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Staffing status chips; what to do about them is in the inspector. */}
          {staffingStatusForBadges && (
            <MatrixCellStaffingBadges staffingStatus={staffingStatusForBadges} positionClass={statusBadgesPosClass} />
          )}

          {/* Assignment controls, drawn over the status card. Desktop only: on a
              phone these 20px buttons are in the action sheet instead. */}
          {hasAssignment && !mobile && (
            <>
              {assignment.status === 'invited' && (
                <div className="absolute bottom-1.5 left-1.5 z-10 flex gap-1">
                  <button
                    type="button"
                    className={CONFIRM_BUTTON_CLASS}
                    onClick={(e) => handleStatusClick(e, 'confirm')}
                    title="Confirmar"
                  >
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  </button>
                  <button
                    type="button"
                    className={DANGER_BUTTON_CLASS}
                    onClick={(e) => handleStatusClick(e, 'decline')}
                    title="Rechazar"
                  >
                    <X className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                  </button>
                </div>
              )}

              {/* Status Badge - moved to not conflict with staffing badges */}
              {!isConfirmedAssignment && (
                <div className="absolute bottom-1.5 right-1.5 z-10" title={assignmentStatusLabel(assignment.status)}>
                  <div className={STATUS_BADGE_CLASS}>
                    {isDeclinedAssignment ? 'R' : 'SC'}
                  </div>
                </div>
              )}

            </>
          )}

          {hasAssignment && mobile && !isConfirmedAssignment && (
            <div className="absolute bottom-1.5 right-1.5 z-10" title={assignmentStatusLabel(assignment.status)}>
              <div className={STATUS_BADGE_CLASS}>
                {isDeclinedAssignment ? 'R' : 'SC'}
              </div>
            </div>
          )}

        </div>
  );
});

OptimizedMatrixCell.displayName = 'OptimizedMatrixCell';
