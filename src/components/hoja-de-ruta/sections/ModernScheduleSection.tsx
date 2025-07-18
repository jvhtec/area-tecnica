import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Activity, Zap, Clock, Calendar } from "lucide-react";
import { EventData } from "@/types/hoja-de-ruta";

interface ModernScheduleSectionProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
}

export const ModernScheduleSection: React.FC<ModernScheduleSectionProps> = ({
  eventData,
  setEventData,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Schedule Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" />
            Programa del Evento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-red-600" />
              Cronograma Detallado
            </Label>
            <Textarea
              value={eventData.schedule}
              onChange={(e) => setEventData(prev => ({ ...prev, schedule: e.target.value }))}
              placeholder="Detalla el programa completo del evento con horarios específicos...

Ejemplo:
09:00 - Llegada y setup
10:00 - Soundcheck banda 1
11:00 - Soundcheck banda 2
12:00 - Pausa
14:00 - Apertura de puertas
15:00 - Inicio del evento
..."
              className="border-2 focus:border-red-300 min-h-[200px] font-mono text-sm"
            />
          </div>
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