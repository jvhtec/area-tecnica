import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Plus, Printer } from "lucide-react";
import jsPDF from "jspdf";
import { format, addDays, subDays, isToday, isSameDay, isValid } from "date-fns";
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

  const generatePDF = () => {
    const doc = new jsPDF('portrait');
    const currentDateEvents = getEventsForDate(currentDate);
    
    doc.setFontSize(16);
    doc.text(`Logistics Events - ${format(currentDate, 'EEEE, MMMM d, yyyy')}`, 105, 20, { align: 'center' });
    
    let yPos = 40;
    
    if (currentDateEvents.length === 0) {
      doc.setFontSize(12);
      doc.text('No logistics events scheduled for this day', 105, yPos, { align: 'center' });
    } else {
      currentDateEvents.forEach((event, index) => {
        doc.setFontSize(12);
        doc.text(`${index + 1}. ${event.event_type || 'Event'}`, 20, yPos);
        doc.setFontSize(10);
        if (event.job?.title) {
          doc.text(`Job: ${event.job.title}`, 30, yPos + 10);
        }
        if (event.transport_type) {
          doc.text(`Transport: ${event.transport_type}`, 30, yPos + 20);
        }
        if (event.event_time) {
          const eventTime = format(new Date(event.event_time), 'HH:mm');
          doc.text(`Time: ${eventTime}`, 30, yPos + 30);
        }
        if (event.location) {
          doc.text(`Location: ${event.location}`, 30, yPos + 40);
        }
        
        yPos += 60;
        
        if (yPos > 240) {
          doc.addPage();
          yPos = 30;
        }
      });
    }
    
    doc.save(`logistics-${format(currentDate, 'yyyy-MM-dd')}.pdf`);
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
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">Logistics</CardTitle>
          <Button
            onClick={handleAddEvent}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        </div>
        
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={navigateToPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 mr-1" />
            <span className={cn(
              "font-medium",
              isToday(currentDate) && "text-primary"
                        )}>
              {format(currentDate, "EEE, MMM d")}
            </span>
          </div>
          
          <Button variant="ghost" size="icon" onClick={navigateToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <div /> {/* Spacer */}
          
          <Button variant="outline" size="sm" onClick={generatePDF}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={navigateToToday}
            className={cn(
              isToday(currentDate) && "bg-primary text-primary-foreground"
            )}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Today
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-4">
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading events...</div>
            </div>
          ) : currentDateEvents.length > 0 ? (
            currentDateEvents.map((event) => (
              <LogisticsEventCard
                key={event.id}
                event={event}
                onClick={(e) => handleEventClick(e, event)}
                className="w-full"
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-8 w-8 mb-2" />
              <p className="text-muted-foreground">No logistics events scheduled</p>
              <p className="text-sm text-muted-foreground">for {format(currentDate, "MMMM d, yyyy")}</p>
            </div>
          )}
        </div>
      </CardContent>

      <LogisticsEventDialog 
        open={showEventDialog} 
        onOpenChange={setShowEventDialog}
        selectedDate={currentDate}
        selectedEvent={selectedEvent}
      />
    </Card>
  );
};