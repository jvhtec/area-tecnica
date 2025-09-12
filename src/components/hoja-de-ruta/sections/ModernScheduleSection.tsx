import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Activity, Zap, Calendar } from "lucide-react";
import { EventData } from "@/types/hoja-de-ruta";
import { ScheduleBuilder } from "@/components/schedule/ScheduleBuilder";
import { useMemo } from "react";

interface ModernScheduleSectionProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
}

export const ModernScheduleSection: React.FC<ModernScheduleSectionProps> = ({
  eventData,
  setEventData,
}) => {
  const programRows = useMemo(() => eventData.programSchedule ?? [], [eventData.programSchedule]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* New: Schedule Builder */}
      <ScheduleBuilder
        value={programRows}
        onChange={(rows) => setEventData(prev => ({ ...prev, programSchedule: rows }))}
        snapMinutes={15}
        title="Programa del Día"
        hideExport
        subtitle={eventData.eventName ? `${eventData.eventName}${eventData.eventDates ? ' • ' + eventData.eventDates : ''}` : undefined}
      />

      {/* Legacy free-text (keep for now) */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" />
            Programa (Texto Libre)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={eventData.schedule}
            onChange={(e) => setEventData(prev => ({ ...prev, schedule: e.target.value }))}
            placeholder="Texto libre del programa (opcional)"
            className="border-2 focus:border-red-300 min-h-[140px] font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Power Requirements Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-600" />
            Requisitos de Energía
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-600" />
              Especificaciones Eléctricas
            </Label>
            <Textarea
              value={eventData.powerRequirements}
              onChange={(e) => setEventData(prev => ({ ...prev, powerRequirements: e.target.value }))}
              placeholder="Detalla los requisitos eléctricos del evento...

Ejemplo:
- PA System: 32A Trifásico
- Iluminación: 63A Trifásico
- Backline: 16A Monofásico
- Catering: 16A Monofásico

Total estimado: 127A"
              className="border-2 focus:border-yellow-300 min-h-[150px] font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
