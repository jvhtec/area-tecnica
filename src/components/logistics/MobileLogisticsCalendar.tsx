import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Plus, Printer } from "lucide-react";
import { format, addDays, subDays, isToday, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { LogisticsEventDialog } from "./LogisticsEventDialog";
import { LogisticsEventCard } from "./LogisticsEventCard";
import { LogisticsCalendarPrintDialog } from "./LogisticsCalendarPrintDialog";
import { generateLogisticsCalendarXLS, generateLogisticsCalendarPDF } from "@/utils/logisticsCalendarExport";

interface MobileLogisticsCalendarProps {
  date: Date;
  onDateSelect: (date: Date) => void;
}

export const MobileLogisticsCalendar: React.FC<MobileLogisticsCalendarProps> = ({
  date,
  onDateSelect,
}) => {
  const DEFAULT_VISIBLE_EVENTS = 10;

  const [currentDate, setCurrentDate] = useState(date);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [visibleEventsCount, setVisibleEventsCount] = useState(DEFAULT_VISIBLE_EVENTS);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentDate(date);
  }, [date]);

  const { data: events, isLoading } = useQuery({
    queryKey: ['logistics-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logistics_events')
        .select(`
          *,
          job:jobs(title),
          departments:logistics_event_departments(department)
        `)
        .order('event_time', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los eventos de logística",
          variant: "destructive",
        });
        throw error;
      }
      return data;
    }
  });

  const getEventsForDate = useCallback((targetDate: Date) => {
    if (!events) return [];
    return events.filter(event => {
      if (!event.event_date) return false;
      try {
        const eventDate = new Date(event.event_date);
        return isValid(eventDate) && format(eventDate, 'yyyy-MM-dd') === format(targetDate, 'yyyy-MM-dd');
      } catch (e) {
        console.error('Invalid date in event:', event);
        return false;
      }
    });
  }, [events]);

  const currentDateEvents = getEventsForDate(currentDate);
  const visibleEvents = React.useMemo(
    () => currentDateEvents.slice(0, visibleEventsCount),
    [currentDateEvents, visibleEventsCount],
  );

  useEffect(() => {
    setVisibleEventsCount(DEFAULT_VISIBLE_EVENTS);
  }, [currentDate]);

  // PDF export handler
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

  const handleEventClick = (e: React.MouseEvent, event: any) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const handleAddEvent = () => {
    setSelectedEvent(null);
    setShowEventDialog(true);
  };

  return (
    <div className="w-full max-w-[520px] mx-auto space-y-4">
      <div className="rounded-2xl border bg-card shadow-sm px-4 py-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Logística</p>
            <h2 className="text-xl font-bold leading-tight">Agenda móvil</h2>
            <p className="text-xs text-muted-foreground">Gestiona cargas y descargas con acciones rápidas.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={navigateToPrevious} aria-label="Día anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={navigateToNext} aria-label="Día siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowPrintDialog(true)} aria-label="Exportar logística">
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Calendar className="h-4 w-4 text-primary" />
          <span className={cn(isToday(currentDate) && "text-primary font-bold")}>{format(currentDate, "EEE, MMM d")}</span>
          <span className="text-muted-foreground">·</span>
          <button onClick={navigateToToday} className="text-primary underline-offset-2 hover:underline">Hoy</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleAddEvent} className="w-full rounded-xl flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            Añadir evento
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => setShowPrintDialog(true)}
          >
            <Printer className="h-4 w-4 mr-2" /> Exportar
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 rounded-2xl border bg-card text-muted-foreground">
            Cargando eventos...
          </div>
        ) : currentDateEvents.length > 0 ? (
          <>
            {visibleEvents.map((event) => (
              <LogisticsEventCard
                key={event.id}
                event={event}
                onClick={(e) => handleEventClick(e, event)}
                className="w-full rounded-2xl"
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
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border bg-card">
            <Calendar className="h-8 w-8 mb-2" />
            <p className="text-muted-foreground">No hay eventos de logística programados</p>
            <p className="text-sm text-muted-foreground">para {format(currentDate, "MMMM d, yyyy")}</p>
          </div>
        )}
      </div>

      <LogisticsEventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        selectedDate={currentDate}
        selectedEvent={selectedEvent}
      />

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
