
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { EventData } from "@/types/hoja-de-ruta";

interface EventDetailsSectionProps {
  selectedJobId: string;
  setSelectedJobId: (id: string) => void;
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
  isLoadingJobs: boolean;
  jobs?: any[];
}

export const EventDetailsSection = ({
  selectedJobId,
  setSelectedJobId,
  eventData,
  setEventData,
  isLoadingJobs,
  jobs,
}: EventDetailsSectionProps) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <Label htmlFor="jobSelect">Seleccione Trabajo</Label>
        <Select
          value={selectedJobId || "unselected"}
          onValueChange={setSelectedJobId}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccione un trabajo..." />
          </SelectTrigger>
          <SelectContent>
            {isLoadingJobs ? (
              <SelectItem value="loading">Cargando trabajos...</SelectItem>
            ) : jobs?.length === 0 ? (
              <SelectItem value="no-jobs">No hay trabajos disponibles</SelectItem>
            ) : (
              jobs
                ?.filter(job => job.id && job.id.trim() !== '') // Filter out jobs with empty IDs
                .map((job: any) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="eventName">Nombre del Evento</Label>
        <Input
          id="eventName"
          value={eventData.eventName}
          onChange={(e) =>
            setEventData({ ...eventData, eventName: e.target.value })
          }
        />
      </div>
      <div>
        <Label htmlFor="eventDates">Fechas del Evento</Label>
        <div className="relative">
          <Input
            id="eventDates"
            value={eventData.eventDates}
            onChange={(e) =>
              setEventData({ ...eventData, eventDates: e.target.value })
            }
          />
          <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
};
