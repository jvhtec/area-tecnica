import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useToast } from "@/hooks/use-toast";
import { LogisticsEventCard } from "./LogisticsEventCard";
import { LogisticsEventDialog } from "./LogisticsEventDialog";
import { queryKeys } from "@/lib/react-query";
import { useEventDriverSummaries } from "@/features/logistics/fleet/useLogisticsFleet";
import type { LogisticsCalendarEvent } from "@/components/logistics/logisticsEventTypes";

interface TodayLogisticsProps {
  selectedDate: Date;
  readOnly?: boolean;
}

export const TodayLogistics = ({ selectedDate, readOnly = false }: TodayLogisticsProps) => {
  const { toast } = useToast();
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LogisticsCalendarEvent | null>(null);
  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const driversByEvent = useEventDriverSummaries(formattedDate, formattedDate);

  const { data: events, isLoading } = useQuery({
    queryKey: queryKeys.scope("today-logistics", formattedDate),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from("logistics_events")
        .select(`
          *,
          job:jobs(id, title),
          departments:logistics_event_departments(department)
        `)
        // Starting today, or a multi-day transport still running today.
        .or(`event_date.eq.${formattedDate},and(event_date.lte.${formattedDate},end_date.gte.${formattedDate})`)
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

  const handleEventClick = (event: LogisticsCalendarEvent) => {
    if (readOnly) return;
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="break-words text-base leading-snug">
          {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="min-w-0 space-y-3">
          {isLoading && (
            <div className="py-6 text-center text-sm text-muted-foreground">Cargando movimientos…</div>
          )}
          {!isLoading && events?.map((event) => (
            <LogisticsEventCard
              key={event.id}
              event={event}
              onClick={() => handleEventClick(event)}
              interactive={!readOnly}
              drivers={driversByEvent.get(event.id)}
            />
          ))}
          {!isLoading && events?.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No hay movimientos de logística para este día
            </div>
          )}
        </div>

        {!readOnly && (
          <LogisticsEventDialog
            open={showEventDialog}
            onOpenChange={setShowEventDialog}
            selectedDate={selectedDate}
            selectedEvent={selectedEvent}
          />
        )}
      </CardContent>
    </Card>
  );
};
