import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, isValid, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LogisticsEventDialog } from "./LogisticsEventDialog";
import { LogisticsEventCard } from "./LogisticsEventCard";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LogisticsCalendarPrintDialog } from "./LogisticsCalendarPrintDialog";
import { generateLogisticsCalendarXLS, generateLogisticsCalendarPDF } from "@/utils/logisticsCalendarExport";

import { queryKeys } from "@/lib/react-query";
import type { LogisticsCalendarEvent } from "@/components/logistics/logisticsEventTypes";

interface LogisticsCalendarProps {
  onDateSelect?: (date: Date) => void;
  readOnly?: boolean;
}

export const LogisticsCalendar = ({ onDateSelect, readOnly = false }: LogisticsCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LogisticsCalendarEvent | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const { toast } = useToast();

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
        console.error("Error fetching logistics events:", error);
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

  const firstDayOfMonth = startOfMonth(currentMonth);
  const lastDayOfMonth = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
  const startDay = firstDayOfMonth.getDay();
  const paddingDays = startDay === 0 ? 6 : startDay - 1;

  const prefixDays = Array.from({ length: paddingDays }).map((_, i) => {
    const day = new Date(firstDayOfMonth);
    day.setDate(day.getDate() - (paddingDays - i));
    return day;
  });

  const totalDaysNeeded = 42;
  const suffixDays = Array.from({ length: totalDaysNeeded - (prefixDays.length + daysInMonth.length) }).map((_, i) => {
    const day = new Date(lastDayOfMonth);
    day.setDate(day.getDate() + (i + 1));
    return day;
  });

  const allDays = [...prefixDays, ...daysInMonth, ...suffixDays];

  const getDayEvents = (date: Date) => {
    if (!events) return [];
    const dateKey = format(date, "yyyy-MM-dd");
    return events.filter((event) => event.event_date === dateKey);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(addMonths(currentMonth, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleTodayClick = () => {
    setCurrentMonth(new Date());
  };

  const handleGeneratePDF = async (range: "current_week" | "next_week" | "month") => {
    await generateLogisticsCalendarPDF(range, {
      events: events || [],
      currentDate: currentMonth,
    });
    setShowPrintDialog(false);
  };

  const handleGenerateXLS = async (range: "current_week" | "next_week" | "month") => {
    await generateLogisticsCalendarXLS(range, {
      events: events || [],
      currentDate: currentMonth,
    });
    setShowPrintDialog(false);
  };

  const handleDayClick = (date: Date) => {
    if (onDateSelect && isValid(date)) {
      onDateSelect(date);
      setCurrentMonth(date);
    }
  };

  const handleEventClick = (e: React.MouseEvent, event: LogisticsCalendarEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-xl font-bold">Calendario de logística</CardTitle>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <LogisticsCalendarPrintDialog
            showDialog={showPrintDialog}
            setShowDialog={setShowPrintDialog}
            currentMonth={currentMonth}
            onGeneratePDF={handleGeneratePDF}
            onGenerateXLS={handleGenerateXLS}
          />
          <Button variant="ghost" size="icon" onClick={handlePreviousMonth} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="hidden items-center gap-2 px-2 text-sm font-medium text-muted-foreground sm:flex">
            <CalendarIcon className="h-4 w-4" />
            <span>{format(currentMonth, "MMMM yyyy", { locale: es })}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleTodayClick}>
            Hoy
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowPrintDialog(true)}
            aria-label="Exportar calendario"
          >
            <Printer className="h-4 w-4" />
          </Button>
          {!readOnly && (
            <Button
              onClick={() => {
                setSelectedEvent(null);
                setShowEventDialog(true);
              }}
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              Añadir evento
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="min-w-0 flex-grow p-4">
        <div className="overflow-x-auto rounded-lg border">
          <div className="grid min-w-[980px] grid-cols-7 gap-px bg-muted">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
              <div key={day} className="bg-background p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {allDays.map((day, i) => {
              const dayEvents = getDayEvents(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);
              const maxVisibleEvents = 7;

              return (
                <div
                  key={i}
                  className={cn(
                    "relative min-h-[200px] cursor-pointer border-t bg-background p-2 transition-colors hover:bg-accent/50",
                    isTodayDate && "ring-2 ring-inset ring-primary bg-primary/5 hover:bg-primary/10",
                    !isCurrentMonth && "text-muted-foreground/50",
                  )}
                  aria-current={isTodayDate ? "date" : undefined}
                  onClick={() => handleDayClick(day)}
                >
                  <span className={cn("text-sm", isTodayDate && "font-medium text-primary")}>{format(day, "d")}</span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, maxVisibleEvents).map((event) => (
                      <Tooltip key={event.id}>
                        <TooltipTrigger asChild>
                          <div>
                            <LogisticsEventCard
                              event={event}
                              onClick={(e) => handleEventClick(e, event)}
                              compact
                              variant="calendar"
                              interactive={!readOnly}
                              className={cn("truncate px-1.5 py-0.5 text-xs", !readOnly && "hover:bg-accent/50")}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start" className="w-64">
                          <LogisticsEventCard
                            event={event}
                            onClick={(e) => handleEventClick(e, event)}
                            interactive={!readOnly}
                            className="border-0 p-0 shadow-none"
                          />
                        </TooltipContent>
                      </Tooltip>
                    ))}

                    {dayEvents.length > maxVisibleEvents && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        + {dayEvents.length - maxVisibleEvents} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!readOnly && (
          <LogisticsEventDialog
            open={showEventDialog}
            onOpenChange={setShowEventDialog}
            selectedDate={currentMonth}
            selectedEvent={selectedEvent}
          />
        )}
      </CardContent>
    </Card>
  );
};
