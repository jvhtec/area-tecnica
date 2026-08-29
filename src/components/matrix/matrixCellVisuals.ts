/**
 * Visual vocabulary for the assignment matrix.
 *
 * The grid paints one of a small set of states per cell, and the same states
 * are named in the legend. Keeping the resolution rules and the class strings
 * here means the cell, the legend and any future surface (wallboard, print)
 * cannot drift into three slightly different colour schemes.
 *
 * Every palette entry is declared for both themes: the matrix is used on
 * darkened FOH laptops as often as on a bright office screen.
 */

export type MatrixCellState =
  | 'selected'
  | 'confirmed'
  | 'pending'
  | 'declined'
  | 'unavailable'
  | 'offer-sent'
  | 'offer-confirmed'
  | 'offer-declined'
  | 'availability-requested'
  | 'availability-confirmed'
  | 'availability-declined'
  | 'expired'
  | 'today'
  | 'weekend'
  | 'empty';

export interface MatrixCellStateInput {
  isSelected: boolean;
  hasAssignment: boolean;
  /** Already normalised (trimmed + lowercased) assignment status. */
  assignmentStatus: string | null;
  isUnavailable: boolean;
  availabilityStatus?: string | null;
  offerStatus?: string | null;
  isToday: boolean;
  isWeekend: boolean;
}

/**
 * Mirrors the precedence the matrix has always used: an explicit selection wins
 * over everything, then the assignment, then an explicit unavailability, then
 * the staffing conversation, and only after that the calendar tinting.
 */
export const resolveMatrixCellState = ({
  isSelected,
  hasAssignment,
  assignmentStatus,
  isUnavailable,
  availabilityStatus,
  offerStatus,
  isToday,
  isWeekend,
}: MatrixCellStateInput): MatrixCellState => {
  if (isSelected) return 'selected';

  if (hasAssignment) {
    if (assignmentStatus === 'confirmed') return 'confirmed';
    if (assignmentStatus === 'declined') return 'declined';
    return 'pending';
  }

  if (isUnavailable) return 'unavailable';

  if (offerStatus === 'sent' || offerStatus === 'pending') return 'offer-sent';
  if (offerStatus === 'confirmed') return 'offer-confirmed';
  if (offerStatus === 'declined') return 'offer-declined';
  if (availabilityStatus === 'requested' || availabilityStatus === 'pending') return 'availability-requested';
  if (availabilityStatus === 'confirmed') return 'availability-confirmed';
  if (availabilityStatus === 'declined') return 'availability-declined';
  if (availabilityStatus === 'expired' || offerStatus === 'expired') return 'expired';

  if (isToday) return 'today';
  if (isWeekend) return 'weekend';
  return 'empty';
};

/** Cell background + ring. Applied to the cell box itself. */
export const MATRIX_CELL_SURFACE: Record<MatrixCellState, string> = {
  selected: 'bg-primary/15 ring-2 ring-primary ring-inset',
  confirmed: 'bg-emerald-50/70 dark:bg-emerald-950/30',
  pending: 'bg-amber-50/70 dark:bg-amber-950/25',
  declined: 'bg-rose-50/70 dark:bg-rose-950/25',
  unavailable: 'bg-muted/60',
  'offer-sent': 'bg-indigo-50/70 dark:bg-indigo-950/25',
  'offer-confirmed': 'bg-indigo-100/70 dark:bg-indigo-900/30',
  'offer-declined': 'bg-rose-50/70 dark:bg-rose-950/25',
  'availability-requested': 'bg-amber-50/70 dark:bg-amber-950/25',
  'availability-confirmed': 'bg-emerald-50/70 dark:bg-emerald-950/25',
  'availability-declined': 'bg-rose-50/70 dark:bg-rose-950/25',
  expired: 'bg-muted/50',
  today: 'bg-primary/[0.06] dark:bg-primary/10',
  weekend: 'bg-muted/30',
  empty: 'bg-card hover:bg-accent/40',
};

export interface MatrixChipStyle {
  /** Rounded status card drawn inside the cell. */
  card: string;
  /** Uppercase caption on the card. */
  caption: string;
  /** Secondary line under the caption. */
  detail: string;
}

/**
 * The "status card" the redesign draws inside a cell instead of tinting the
 * whole box: a bordered, rounded block that reads as an object you can act on.
 */
export const MATRIX_CELL_CHIP: Record<MatrixCellState, MatrixChipStyle> = {
  selected: {
    card: 'border-primary/50 bg-primary/10',
    caption: 'text-primary',
    detail: 'text-primary/80',
  },
  confirmed: {
    card: 'border-emerald-500/40 bg-emerald-500/10',
    caption: 'text-emerald-700 dark:text-emerald-300',
    detail: 'text-emerald-700/80 dark:text-emerald-300/80',
  },
  pending: {
    card: 'border-amber-500/40 bg-amber-500/10',
    caption: 'text-amber-700 dark:text-amber-300',
    detail: 'text-amber-700/80 dark:text-amber-300/80',
  },
  declined: {
    card: 'border-rose-500/40 bg-rose-500/10',
    caption: 'text-rose-700 dark:text-rose-300',
    detail: 'text-rose-700/80 dark:text-rose-300/80',
  },
  unavailable: {
    card: 'border-border bg-muted/70',
    caption: 'text-muted-foreground',
    detail: 'text-muted-foreground',
  },
  'offer-sent': {
    card: 'border-indigo-500/40 bg-indigo-500/10',
    caption: 'text-indigo-700 dark:text-indigo-300',
    detail: 'text-indigo-700/80 dark:text-indigo-300/80',
  },
  'offer-confirmed': {
    card: 'border-indigo-500/50 bg-indigo-500/15',
    caption: 'text-indigo-700 dark:text-indigo-300',
    detail: 'text-indigo-700/80 dark:text-indigo-300/80',
  },
  'offer-declined': {
    card: 'border-rose-500/40 bg-rose-500/10',
    caption: 'text-rose-700 dark:text-rose-300',
    detail: 'text-rose-700/80 dark:text-rose-300/80',
  },
  'availability-requested': {
    card: 'border-amber-500/40 bg-amber-500/10',
    caption: 'text-amber-700 dark:text-amber-300',
    detail: 'text-amber-700/80 dark:text-amber-300/80',
  },
  'availability-confirmed': {
    card: 'border-emerald-500/40 bg-emerald-500/10',
    caption: 'text-emerald-700 dark:text-emerald-300',
    detail: 'text-emerald-700/80 dark:text-emerald-300/80',
  },
  'availability-declined': {
    card: 'border-rose-500/40 bg-rose-500/10',
    caption: 'text-rose-700 dark:text-rose-300',
    detail: 'text-rose-700/80 dark:text-rose-300/80',
  },
  expired: {
    card: 'border-border bg-muted/70',
    caption: 'text-muted-foreground',
    detail: 'text-muted-foreground',
  },
  today: {
    card: 'border-border bg-card',
    caption: 'text-foreground',
    detail: 'text-muted-foreground',
  },
  weekend: {
    card: 'border-border bg-card',
    caption: 'text-foreground',
    detail: 'text-muted-foreground',
  },
  empty: {
    card: 'border-border bg-card',
    caption: 'text-foreground',
    detail: 'text-muted-foreground',
  },
};

/**
 * Legend rows, in reading order. Only the states a user can act on are listed —
 * "today" and "weekend" are calendar tinting, not a staffing state.
 */
export const MATRIX_LEGEND_ITEMS: Array<{ state: MatrixCellState; label: string; hint: string }> = [
  { state: 'confirmed', label: 'Confirmado', hint: 'Asignación confirmada, pintada con el color del trabajo' },
  { state: 'pending', label: 'Pendiente', hint: 'Asignado pero sin respuesta del técnico' },
  { state: 'declined', label: 'Rechazado', hint: 'El técnico rechazó este trabajo' },
  { state: 'availability-requested', label: 'Disponibilidad pedida', hint: 'Solicitud enviada, esperando respuesta' },
  { state: 'availability-confirmed', label: 'Disponible', hint: 'El técnico confirmó que está disponible' },
  { state: 'offer-sent', label: 'Oferta enviada', hint: 'Oferta de trabajo pendiente de respuesta' },
  { state: 'unavailable', label: 'No disponible', hint: 'Marcado como no disponible o de vacaciones' },
];
