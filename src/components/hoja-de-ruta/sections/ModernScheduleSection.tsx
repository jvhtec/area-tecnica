import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Activity, Zap, RefreshCw } from "lucide-react";
import { EventData } from "@/types/hoja-de-ruta";
import { ScheduleBuilder } from "@/components/schedule/ScheduleBuilder";
import { MultiDayScheduleBuilder } from "@/components/schedule/MultiDayScheduleBuilder";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useJobPowerRequirementsText } from "@/hooks/hoja-de-ruta/useJobPowerRequirementsText";
import { getHojaPowerSummaryStatus } from "@/utils/hoja-de-ruta/powerSummaryStatus";
import { PrintSectionExclusionToggle } from "../components/PrintSectionExclusionToggle";
import type { HojaDeRutaPrintSectionId } from "@/utils/hoja-de-ruta/pdf";

interface ModernScheduleSectionProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
  isPrintSectionExcluded: (sectionId: HojaDeRutaPrintSectionId) => boolean;
  onPrintSectionExcludedChange: (sectionId: HojaDeRutaPrintSectionId, isExcluded: boolean) => void;
  selectedJobId?: string;
}

export const ModernScheduleSection: React.FC<ModernScheduleSectionProps> = ({
  eventData,
  setEventData,
  isPrintSectionExcluded,
  onPrintSectionExcludedChange,
  selectedJobId,
}) => {
  const programRows = useMemo(() => eventData.programSchedule ?? [], [eventData.programSchedule]);
  const programDays = useMemo(() => eventData.programScheduleDays ?? [], [eventData.programScheduleDays]);

  // The saved text always wins on reload so manual edits survive, which means
  // later calculator changes would otherwise never surface here.
  const { data: generatedPowerSummary } = useJobPowerRequirementsText(selectedJobId);
  const powerSummaryStatus = getHojaPowerSummaryStatus({
    generated: generatedPowerSummary,
    saved: eventData.powerRequirements,
  });
  const applyGeneratedPowerSummary = () =>
    setEventData((prev) => ({ ...prev, powerRequirements: generatedPowerSummary ?? "" }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* New: Multi-Day Schedule Builder (wraps single-day builder) */}
      <MultiDayScheduleBuilder
        value={programDays.length ? programDays : [{ label: 'Día 1', rows: programRows }]}
        onChange={(days) => setEventData(prev => ({ ...prev, programScheduleDays: days, programSchedule: days?.[0]?.rows || [] }))}
        dayTitle="Programa"
        subtitle={eventData.eventName ? `${eventData.eventName}${eventData.eventDates ? ' • ' + eventData.eventDates : ''}` : undefined}
        scheduleHeaderControls={
          <PrintSectionExclusionToggle
            sectionId="program"
            isExcluded={isPrintSectionExcluded("program")}
            onExcludedChange={onPrintSectionExcludedChange}
          />
        }
      />

      {/* Legacy free-text (keep for now) */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-600" />
              Programa (Texto Libre)
            </CardTitle>
            <PrintSectionExclusionToggle
              sectionId="schedule-notes"
              isExcluded={isPrintSectionExcluded("schedule-notes")}
              onExcludedChange={onPrintSectionExcludedChange}
            />
          </div>
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
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-600" />
              Requisitos de Energía
            </CardTitle>
            <PrintSectionExclusionToggle
              sectionId="power"
              isExcluded={isPrintSectionExcluded("power")}
              onExcludedChange={onPrintSectionExcludedChange}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {powerSummaryStatus !== "up-to-date" && (
            <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <span>
                {powerSummaryStatus === "missing"
                  ? "El calculador de consumos tiene un resumen para este trabajo que aún no está aquí."
                  : "El resumen del calculador de consumos ya no coincide con este texto."}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={applyGeneratedPowerSummary}
              >
                <RefreshCw className="h-4 w-4" />
                {powerSummaryStatus === "missing" ? "Insertar resumen" : "Actualizar resumen"}
              </Button>
            </div>
          )}
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
