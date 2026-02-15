import React from 'react';
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RehearsalDateTogglesProps {
  jobId: string;
  jobTimesheetDates: string[];
  rehearsalDateSet: Set<string>;
  allDatesMarked: boolean;
  toggleDateRehearsalMutation: { mutate: (args: { jobId: string; date: string; enabled: boolean }) => void; isPending: boolean };
  toggleAllDatesRehearsalMutation: { mutate: (args: { jobId: string; dates: string[]; enabled: boolean }) => void; isPending: boolean };
}

export function RehearsalDateToggles({
  jobId,
  jobTimesheetDates,
  rehearsalDateSet,
  allDatesMarked,
  toggleDateRehearsalMutation,
  toggleAllDatesRehearsalMutation,
}: RehearsalDateTogglesProps) {
  if (jobTimesheetDates.length === 0) return null;

  const isPending = toggleDateRehearsalMutation.isPending || toggleAllDatesRehearsalMutation.isPending;

  return (
    <div className="mt-3 bg-muted/40 border border-border rounded-md px-3 py-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Tarifa de ensayo</span>
        </div>
        {jobTimesheetDates.length > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              disabled={isPending}
              onClick={() => toggleAllDatesRehearsalMutation.mutate({
                jobId,
                dates: jobTimesheetDates,
                enabled: !allDatesMarked,
              })}
            >
              {allDatesMarked ? 'Desmarcar todas' : 'Marcar todas'}
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {jobTimesheetDates.map(dateStr => {
          const isActive = rehearsalDateSet.has(dateStr);
          const label = formatInTimeZone(parseISO(dateStr), 'Europe/Madrid', 'd MMM', { locale: es });
          return (
            <button
              key={dateStr}
              type="button"
              aria-pressed={isActive}
              disabled={isPending}
              onClick={() => toggleDateRehearsalMutation.mutate({
                jobId,
                date: dateStr,
                enabled: !isActive,
              })}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer select-none',
                isActive
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-800 dark:text-amber-200'
                  : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50',
                isPending && 'opacity-60'
              )}
            >
              <span
                aria-hidden="true"
                data-state={isActive ? 'checked' : 'unchecked'}
                className="pointer-events-none scale-75 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
              >
                <span
                  data-state={isActive ? 'checked' : 'unchecked'}
                  className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
                />
              </span>
              {label}
            </button>
          );
        })}
      </div>
      {isPending && (
        <span className="text-xs text-muted-foreground animate-pulse">Recalculando\u2026</span>
      )}
    </div>
  );
}
