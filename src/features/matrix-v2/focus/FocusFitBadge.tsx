import type { FocusFit, FocusFitKind } from '@/features/matrix-v2/focus/fit';
import { cn } from '@/lib/utils';

const TONE: Record<FocusFitKind, string> = {
  free: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'partial-free': 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  partial: 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  assigned: 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  busy: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  unavailable: 'border-border bg-muted text-muted-foreground',
  declined: 'border-destructive/40 bg-destructive/10 text-destructive',
  fridge: 'border-sky-600/40 bg-sky-600/10 text-sky-700 dark:text-sky-300',
};

/** How a technician fits the focused job, in the technician column. */
export function FocusFitBadge({ fit, className }: { fit: FocusFit; className?: string }) {
  return (
    <span
      data-focus-fit={fit.kind}
      title={fit.assignable ? 'Clic en el nombre: asignar los días libres' : undefined}
      className={cn('inline-flex h-5 items-center whitespace-nowrap rounded-md border px-1.5 text-xs font-semibold leading-none', TONE[fit.kind], className)}
    >
      {fit.label}
    </span>
  );
}
