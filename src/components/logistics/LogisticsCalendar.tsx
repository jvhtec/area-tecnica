import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LogisticsEventDialog } from "./LogisticsEventDialog";
import { LogisticsEventCard } from "./LogisticsEventCard";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface LogisticsCalendarProps {
  onDateSelect?: (date: Date) => void;
}

export const LogisticsCalendar = ({ onDateSelect }: LogisticsCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const { toast } = useToast();

  const { data: events, isLoading } = useQuery({
    queryKey: ['logistics-events'],
    queryFn: async () => {
      console.log('Fetching logistics events');
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
    return events.filter(event => {
      if (!event.event_date) return false;
      try {
        const eventDate = new Date(event.event_date);
        return isValid(eventDate) && format(eventDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      } catch (e) {
        console.error('Invalid date in event:', event);
        return false;
      }
    });
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

  const generatePDF = async () => {
    const doc = new jsPDF('landscape');
    const startDate = startOfMonth(currentMonth);
    const endDate = endOfMonth(currentMonth);
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const cellWidth = 40;
    const cellHeight = 30;
    const startX = 10;
    const startY = 20;

    doc.setFontSize(16);
    doc.text(format(currentMonth, 'MMMM yyyy'), 140, 15, { align: 'center' });

    daysOfWeek.forEach((day, index) => {
      doc.setFillColor(41, 128, 185);
      doc.rect(startX + (index * cellWidth), startY, cellWidth, 10, 'F');
      doc.setTextColor(255);
      doc.setFontSize(10);
      doc.text(day, startX + (index * cellWidth) + 15, startY + 7);
    });

    let yPos = startY + 10;
    allDays.forEach((day, i) => {
      const x = startX + ((i % 7) * cellWidth);
      const y = yPos + (Math.floor(i / 7) * cellHeight);

      doc.setDrawColor(200);
      doc.rect(x, y, cellWidth, cellHeight);

      doc.setTextColor(isSameMonth(day, currentMonth) ? 0 : 200);
      doc.setFontSize(12);
      doc.text(format(day, 'd'), x + 2, y + 5);

      const dayEvents = getDayEvents(day);
      if (dayEvents && dayEvents.length > 0) {
        dayEvents.forEach((event, index) => {
          if (event && event.job) {
            doc.setFontSize(8);
            doc.setTextColor(0);
            const eventText = event.job.title || `${event.event_type} - ${event.transport_type}`;
            doc.text(eventText.substring(0, 20), x + 5, y + 10 + (index * 5));
          }
        });
      }
    });

    doc.save(`logistics-calendar-${format(currentMonth, 'yyyy-MM')}.pdf`);
    setShowPrintDialog(false);
  };

  const handleDayClick = (date: Date) => {
    if (onDateSelect && isValid(date)) {
      onDateSelect(date);
      setCurrentMonth(date);
    }
  };

  const handleEventClick = (e: React.MouseEvent, event: any) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold">Logistics Calendar</CardTitle>
        <div className="flex items-center space-x-2">
          <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Print Calendar</DialogTitle>
              </DialogHeader>
              <Button onClick={generatePDF} className="mt-4">
                Export Current Month
              </Button>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleTodayClick}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowPrintDialog(true)}
          >
            <Printer className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowEventDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-4">
        <div className="border rounded-lg">
          <div className="grid grid-cols-7 gap-px bg-muted">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="bg-background p-2 text-center text-sm text-muted-foreground font-medium">
                {day}
              </div>
            ))}
            {allDays.map((day, i) => {
              const dayEvents = getDayEvents(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const maxVisibleEvents = 3;

              return (
                <div
                  key={i}
                  className={cn(
                    "bg-background p-2 min-h-[120px] border-t relative cursor-pointer hover:bg-accent/50 transition-colors",
                    !isCurrentMonth && "text-muted-foreground/50"
                  )}
                  onClick={() => handleDayClick(day)}
                >
                  <span className="text-sm">{format(day, "d")}</span>
                  <div className="space-y-1 mt-1">
                    {dayEvents?.slice(0, maxVisibleEvents).map((event) => (
  <Tooltip key={event.id}>
    <TooltipTrigger asChild>
      <div>
        <LogisticsEventCard
          event={event}
          onClick={(e) => handleEventClick(e, event)}
          compact
          variant="calendar" // Pass variant for calendar display
          className="px-1.5 py-0.5 text-xs truncate hover:bg-accent/50"
        />
      </div>
    </TooltipTrigger>
    <TooltipContent side="top" align="start" className="w-64">
      <LogisticsEventCard 
        event={event} 
        onClick={(e) => handleEventClick(e, event)}
        className="border-0 shadow-none p-0"
      />
    </TooltipContent>
  </Tooltip>
))}

                    {dayEvents && dayEvents.length > maxVisibleEvents && (
                      <div className="text-xs text-muted-foreground mt-1">
                        + {dayEvents.length - maxVisibleEvents} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <LogisticsEventDialog 
          open={showEventDialog} 
          onOpenChange={setShowEventDialog}
          selectedDate={currentMonth}
          selectedEvent={selectedEvent}
        />
      </CardContent>
    </Card>
  );
};
