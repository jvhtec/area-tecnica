import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePrepDays, useCreatePrepDay, useDeletePrepDay } from '@/hooks/usePrepDays';

interface PrepDayManagerProps {
  jobId: string;
  jobTitle: string;
  jobColor?: string | null;
}

export function PrepDayManager({ jobId, jobTitle, jobColor }: PrepDayManagerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { data: prepDays = [], isLoading } = usePrepDays(jobId);
  const createPrepDay = useCreatePrepDay();
  const deletePrepDay = useDeletePrepDay();

  const handleAddPrepDay = () => {
    if (!selectedDate) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    createPrepDay.mutate(
      {
        parentJobId: jobId,
        parentTitle: jobTitle,
        date: dateStr,
        parentColor: jobColor,
      },
      {
        onSuccess: () => {
          setSelectedDate(undefined);
          setCalendarOpen(false);
        },
      }
    );
  };

  const handleDeletePrepDay = (prepDayId: string) => {
    deletePrepDay.mutate({ prepDayId, parentJobId: jobId });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Días de preparación</h3>
        <Badge variant="secondary" className="text-xs">
          15€/h
        </Badge>
      </div>

      {/* Add prep day */}
      <div className="flex items-center gap-2">
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'justify-start text-left font-normal',
                !selectedDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate
                ? format(selectedDate, 'dd MMM yyyy', { locale: es })
                : 'Seleccionar fecha'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={es}
            />
          </PopoverContent>
        </Popover>
        <Button
          size="sm"
          onClick={handleAddPrepDay}
          disabled={!selectedDate || createPrepDay.isPending}
        >
          <Plus className="h-4 w-4 mr-1" />
          {createPrepDay.isPending ? 'Creando...' : 'Añadir'}
        </Button>
      </div>

      {/* List of prep days */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : prepDays.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay días de preparación. Añade uno usando el calendario.
        </p>
      ) : (
        <div className="space-y-2">
          {prepDays.map((prepDay) => {
            const date = parseISO(prepDay.start_time);
            return (
              <div
                key={prepDay.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{prepDay.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(date, "EEEE, d 'de' MMMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleDeletePrepDay(prepDay.id)}
                  disabled={deletePrepDay.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
