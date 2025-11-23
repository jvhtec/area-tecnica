import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Plus, Printer } from "lucide-react";
import { PrintDialog, PrintSettings } from "@/components/dashboard/PrintDialog";
import { format, addDays, subDays, isToday, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { LogisticsEventDialog } from "./LogisticsEventDialog";
import { LogisticsEventCard } from "./LogisticsEventCard";

interface MobileLogisticsCalendarProps {
  date: Date;
  onDateSelect: (date: Date) => void;
}

export const MobileLogisticsCalendar: React.FC<MobileLogisticsCalendarProps> = ({
  date,
  onDateSelect,
}) => {
  const [currentDate, setCurrentDate] = useState(date);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    jobTypes: {
      tourdate: true,
      tour: true,
      single: true,
      dryhire: true,
      festival: true,
    },
  });
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
          description: "Failed to load logistics events",
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

  const generatePDF = (range: "month" | "quarter" | "year") => {
    console.log("Mobile logistics PDF generation not implemented for", range);
    setShowPrintDialog(false);
  };

  const generateXLS = (range: "month" | "quarter" | "year") => {
    console.log("Mobile logistics XLS generation not implemented for", range);
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Logistics</p>
            <h2 className="text-xl font-bold leading-tight">Mobile schedule</h2>
            <p className="text-xs text-muted-foreground">Manage load and unload runs with quick actions.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={navigateToPrevious} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={navigateToNext} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowPrintDialog(true)} aria-label="Export logistics">
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Calendar className="h-4 w-4 text-primary" />
          <span className={cn(isToday(currentDate) && "text-primary font-bold")}>{format(currentDate, "EEE, MMM d")}</span>
          <span className="text-muted-foreground">·</span>
          <button onClick={navigateToToday} className="text-primary underline-offset-2 hover:underline">Today</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleAddEvent} className="w-full rounded-xl flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            Add event
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => setShowPrintDialog(true)}
          >
            <Printer className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 rounded-2xl border bg-card text-muted-foreground">
            Loading events...
          </div>
        ) : currentDateEvents.length > 0 ? (
          currentDateEvents.map((event) => (
            <LogisticsEventCard
              key={event.id}
              event={event}
              onClick={(e) => handleEventClick(e, event)}
              className="w-full rounded-2xl"
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border bg-card">
            <Calendar className="h-8 w-8 mb-2" />
            <p className="text-muted-foreground">No logistics events scheduled</p>
            <p className="text-sm text-muted-foreground">for {format(currentDate, "MMMM d, yyyy")}</p>
          </div>
        )}
      </div>

      <LogisticsEventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        selectedDate={currentDate}
        selectedEvent={selectedEvent}
      />

      <PrintDialog
        showDialog={showPrintDialog}
        setShowDialog={setShowPrintDialog}
        printSettings={printSettings}
        setPrintSettings={setPrintSettings}
        generatePDF={generatePDF}
        generateXLS={generateXLS}
        currentMonth={currentDate}
        selectedJobTypes={[]}
      />
    </div>
  );
};
