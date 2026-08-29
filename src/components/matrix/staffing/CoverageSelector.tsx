import { es } from 'date-fns/locale';

import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/**
 * "Which days?" — shared by the availability request and the offer.
 *
 * Replaces three native radios (13px targets) and a two-month calendar that
 * overflowed a phone sideways: the modes are segmented buttons, the calendar is
 * inline (no popover nested inside a dialog) and drops to one month on mobile.
 */

export type CoverageMode = 'full' | 'single' | 'multi';

const MODE_LABELS: Record<CoverageMode, string> = {
  full: 'Duración completa',
  single: 'Día suelto',
  multi: 'Varios días',
};

interface CoverageSelectorProps {
  value: CoverageMode;
  onChange: (value: CoverageMode) => void;
  singleDate: Date | null;
  onSingleDateChange: (date: Date | null) => void;
  multiDates: Date[];
  onMultiDatesChange: (dates: Date[]) => void;
  /** Days outside the job's own span are not selectable. */
  isAllowed: (date: Date) => boolean;
  /**
   * The job's own span. Bounding the picker to it means the month it opens on
   * is the one with selectable days, and paging cannot wander into months where
   * everything is disabled.
   */
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  fullHint?: string;
  singleHint?: string;
  multiHint?: string;
}

export const CoverageSelector = ({
  value,
  onChange,
  singleDate,
  onSingleDateChange,
  multiDates,
  onMultiDatesChange,
  isAllowed,
  rangeStart,
  rangeEnd,
  fullHint = 'Cubre todas las fechas del trabajo.',
  singleHint = 'Solo para la fecha seleccionada.',
  multiHint = 'Crea una solicitud de un día por cada fecha seleccionada.',
}: CoverageSelectorProps) => {
  const isMobile = useIsMobile();
  const defaultMonth = singleDate ?? multiDates[0] ?? rangeStart ?? undefined;
  const bounds = {
    fromDate: rangeStart ?? undefined,
    toDate: rangeEnd ?? undefined,
    defaultMonth,
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Cobertura
      </span>

      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Cobertura">
        {(Object.keys(MODE_LABELS) as CoverageMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value === mode}
            onClick={() => onChange(mode)}
            className={cn(
              'min-h-11 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors',
              value === mode
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-accent/50',
            )}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {value === 'full' && <p className="text-xs text-muted-foreground">{fullHint}</p>}

      {value === 'single' && (
        <div className="space-y-1.5">
          <CalendarPicker
            mode="single"
            locale={es}
            {...bounds}
            selected={singleDate ?? undefined}
            onSelect={(date) => {
              if (date && isAllowed(date)) onSingleDateChange(date);
            }}
            disabled={(date) => !isAllowed(date)}
          />
          <p className="text-xs text-muted-foreground">{singleHint}</p>
        </div>
      )}

      {value === 'multi' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{multiHint}</p>
            <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {multiDates.length} {multiDates.length === 1 ? 'día' : 'días'}
            </span>
          </div>
          <CalendarPicker
            mode="multiple"
            locale={es}
            {...bounds}
            selected={multiDates}
            onSelect={(dates) => onMultiDatesChange((dates || []).filter(isAllowed))}
            disabled={(date) => !isAllowed(date)}
            numberOfMonths={isMobile ? 1 : 2}
          />
        </div>
      )}
    </div>
  );
};
