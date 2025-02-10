
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EventData } from "@/types/hoja-de-ruta";

interface ProgramDetailsSectionProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
}

export const ProgramDetailsSection = ({
  eventData,
  setEventData,
}: ProgramDetailsSectionProps) => {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="schedule">Programa</Label>
        <Textarea
          id="schedule"
          value={eventData.schedule}
          onChange={(e) =>
            setEventData({ ...eventData, schedule: e.target.value })
          }
          className="min-h-[200px]"
          placeholder="Load in: 08:00&#10;Soundcheck: 14:00&#10;Doors: 19:00&#10;Show: 20:00..."
        />
      </div>

      <div>
        <Label htmlFor="powerRequirements">Requisitos Eléctricos</Label>
        <Textarea
          id="powerRequirements"
          value={eventData.powerRequirements}
          onChange={(e) =>
            setEventData({
              ...eventData,
              powerRequirements: e.target.value,
            })
          }
          className="min-h-[150px]"
          placeholder="Los requisitos eléctricos se completarán automáticamente cuando estén disponibles..."
        />
      </div>

      <div>
        <Label htmlFor="auxiliaryNeeds">Necesidades Auxiliares</Label>
        <Textarea
          id="auxiliaryNeeds"
          value={eventData.auxiliaryNeeds}
          onChange={(e) =>
            setEventData({ ...eventData, auxiliaryNeeds: e.target.value })
          }
          className="min-h-[150px]"
          placeholder="Requerimientos del equipo de carga, necesidades de equipamiento..."
        />
      </div>
    </div>
  );
};
