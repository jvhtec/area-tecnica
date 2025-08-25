import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
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
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
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

  // Touch handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      navigateToNext();
    }
    if (isRightSwipe) {
      navigateToPrevious();
    }
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
        
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={navigateToToday}
            className={cn(
              isToday(currentDate) && "bg-primary text-primary-foreground"
            )}
          >
            Today
          </Button>
        </div>
      </CardHeader>

      <CardContent 
        className="flex-1 p-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
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