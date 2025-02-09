import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { LogisticsEventCard } from "./LogisticsEventCard";
import { LogisticsEventDialog } from "./LogisticsEventDialog";
import { useState } from "react";

interface TodayLogisticsProps {
  selectedDate: Date;
}

export const TodayLogistics = ({ selectedDate }: TodayLogisticsProps) => {
  const { toast } = useToast();
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const formattedDate = format(selectedDate, 'yyyy-MM-dd');

  const { data: events, isLoading } = useQuery({
    queryKey: ['logistics-events', formattedDate],
    queryFn: async () => {
      console.log('Fetching logistics events for:', formattedDate);
      const { data, error } = await supabase
        .from('logistics_events')
        .select(`
          id,
          job_id,
          event_type,
          transport_type,
          event_date,
          event_time,
          loading_bay,
          notes,
          license_plate,
          job:jobs(id, title),
          departments:logistics_event_departments(department)
        `)
        .eq('event_date', formattedDate)
        .order('event_time', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        toast({
          title: "Error",
          description: "Failed to load events",
          variant: "destructive",
        });
        throw error;
      }

      return data;
    }
  });

  const handleEventClick = (event: any) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Schedule for {format(selectedDate, 'MMMM do, yyyy')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events?.map((event) => (
            <LogisticsEventCard
              key={event.id}
              event={event}
              onClick={() => handleEventClick(event)}
            />
          ))}
          {events?.length === 0 && (
            <div className="text-muted-foreground text-center py-4">
              No logistics events scheduled for this day
            </div>
          )}
        </div>

        <LogisticsEventDialog
          open={showEventDialog}
          onOpenChange={setShowEventDialog}
          selectedDate={selectedDate}
          selectedEvent={selectedEvent}
        />
      </CardContent>
    </Card>
  );
};