import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Plus, Printer } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useToast } from "@/hooks/use-toast";
import { LogisticsEventDialog } from "./LogisticsEventDialog";
import { LogisticsEventCard } from "./LogisticsEventCard";
import { LogisticsCalendarPrintDialog } from "./LogisticsCalendarPrintDialog";
import { generateLogisticsCalendarXLS, generateLogisticsCalendarPDF } from "@/utils/logisticsCalendarExport";

import { queryKeys } from "@/lib/react-query";
import { useEventDriverSummaries } from "@/features/logistics/fleet/useLogisticsFleet";
import { isLogisticsEventOnDay, type LogisticsCalendarEvent } from "@/components/logistics/logisticsEventTypes";

interface MobileLogisticsCalendarProps {
  date: Date;
  onDateSelect: (date: Date) => void;
  readOnly?: boolean;
}

export const MobileLogisticsCalendar: React.FC<MobileLogisticsCalendarProps> = ({
  date,
  onDateSelect,
  readOnly = false,
}) => {
  const DEFAULT_VISIBLE_EVENTS = 10;

  const [currentDate, setCurrentDate] = useState(date);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LogisticsCalendarEvent | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [visibleEventsCount, setVisibleEventsCount] = useState(DEFAULT_VISIBLE_EVENTS);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentDate(date);
  }, [date]);

  const { data: events, isLoading } = useQuery({
    queryKey: queryKeys.scope("logistics-events"),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from("logistics_events")
        .select(`
          *,
          job:jobs(title),
          departments:logistics_event_departments(department)
        `)
        .order("event_time", { ascending: true });

      if (error) {
        console.error("Error fetching events:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los eventos de logística",
          variant: "destructive",
        });
        throw error;
      }
      return data;
    },
  });

  const getEventsForDate = useCallback((targetDate: Date) => {
    if (!events) return [];
    const targetDateKey = format(targetDate, "yyyy-MM-dd");
    // event_date is a DATE column, not an instant. Comparing the serialized calendar date
    // avoids shifting it to the previous day when an operator is browsing from another TZ.
    // A multi-day transport is listed on every day it spans.
    return events.filter((event) => isLogisticsEventOnDay(event, targetDateKey));
  }, [events]);

  const currentDateEvents = getEventsForDate(currentDate);
  const currentDateKey = format(currentDate, "yyyy-MM-dd");
  const driversByEvent = useEventDriverSummaries(currentDateKey, currentDateKey);
  const visibleEvents = React.useMemo(
    () => currentDateEvents.slice(0, visibleEventsCount),
    [currentDateEvents, visibleEventsCount],
  );

  useEffect(() => {
    setVisibleEventsCount(DEFAULT_VISIBLE_EVENTS);
  }, [currentDate]);

  const handleGeneratePDF = async (range: "current_week" | "next_week" | "month") => {
    await generateLogisticsCalendarPDF(range, {
      events: events || [],
      currentDate,
    });
    setShowPrintDialog(false);
  };

  const handleGenerateXLS = async (range: "current_week" | "next_week" | "month") => {
    await generateLogisticsCalendarXLS(range, {
      events: events || [],
      currentDate,
    });
    setShowPrintDialog(false);
  };

  const navigateToPrevious = () => {
    const newDate = subDays(currentDate, 1);
    setCurrentDate(newDate);
    onDateSelect(newDate);
  };

  const navigateToNext = () => {
    const newDate = addDays(currentDate, 1);
    setCurrentDate(newDate);
    onDateSelect(newDate);
  };

  const navigateToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onDateSelect(today);
  };

  const handleEventClick = (e: React.MouseEvent, event: LogisticsCalendarEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const handleAddEvent = () => {
    if (readOnly) return;
    setSelectedEvent(null);
    setShowEventDialog(true);
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[520px] space-y-4">
      <div className="min-w-0 space-y-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Logística</p>
            <h2 className="break-words text-xl font-bold leading-tight">Agenda móvil</h2>
            <p className="text-xs text-muted-foreground">
              {readOnly ? "Consulta de cargas y descargas." : "Gestiona cargas y descargas con acciones rápidas."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={navigateToPrevious} aria-label="Día anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={navigateToNext} aria-label="Día siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0 text-primary" />
          <span className={cn("min-w-0 break-words", isToday(currentDate) && "font-bold text-primary")}>
            {format(currentDate, "EEE, d MMM", { locale: es })}
          </span>
          <span className="text-muted-foreground">·</span>
          <Button type="button" variant="link" className="h-auto min-h-11 px-1 py-0 text-primary" onClick={navigateToToday}>
            Hoy
          </Button>
        </div>

        <div className={cn("grid gap-2", readOnly ? "grid-cols-1" : "grid-cols-2")}>
          {!readOnly && (
            <Button onClick={handleAddEvent} className="flex w-full items-center justify-center gap-2 rounded-xl">
              <Plus className="h-4 w-4" />
              Añadir evento
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => setShowPrintDialog(true)}
          >
            <Printer className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border bg-card py-10 text-muted-foreground">
            Cargando eventos…
          </div>
        ) : currentDateEvents.length > 0 ? (
          <>
            {visibleEvents.map((event) => (
              <LogisticsEventCard
                key={event.id}
                event={event}
                onClick={(e) => handleEventClick(e, event)}
                interactive={!readOnly}
                className="w-full min-w-0 rounded-2xl"
                drivers={driversByEvent.get(event.id)}
              />
            ))}
            {currentDateEvents.length > visibleEventsCount ? (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl"
                onClick={() => setVisibleEventsCount((prev) => prev + DEFAULT_VISIBLE_EVENTS)}
              >
                Cargar más ({currentDateEvents.length - visibleEventsCount} restantes)
              </Button>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border bg-card px-4 py-12 text-center">
            <Calendar className="mb-2 h-8 w-8" />
            <p className="text-muted-foreground">No hay eventos de logística programados</p>
            <p className="text-sm text-muted-foreground">
              para {format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </div>
        )}
      </div>

      {!readOnly && (
        <LogisticsEventDialog
          open={showEventDialog}
          onOpenChange={setShowEventDialog}
          selectedDate={currentDate}
          selectedEvent={selectedEvent}
        />
      )}

      <LogisticsCalendarPrintDialog
        showDialog={showPrintDialog}
        setShowDialog={setShowPrintDialog}
        currentMonth={currentDate}
        onGeneratePDF={handleGeneratePDF}
        onGenerateXLS={handleGenerateXLS}
      />
    </div>
  );
};
