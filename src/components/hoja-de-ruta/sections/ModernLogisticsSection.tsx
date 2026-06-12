import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Building2, Package, ArrowDown, ArrowUp } from "lucide-react";
import { EventData, Transport } from "@/types/hoja-de-ruta";
import { ModernTransportSection } from "./ModernTransportSection";
import { PrintSectionExclusionToggle } from "../components/PrintSectionExclusionToggle";
import type { HojaDeRutaPrintSectionId } from "@/utils/hoja-de-ruta/pdf";

interface ModernLogisticsSectionProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
  onUpdateTransport: (index: number, field: keyof Transport, value: any) => void;
  onAddTransport: () => void;
  onRemoveTransport: (index: number) => void;
  onImportTransports: (transports: Transport[]) => void;
  jobId?: string;  // Add jobId prop
  isPrintSectionExcluded: (sectionId: HojaDeRutaPrintSectionId) => boolean;
  onPrintSectionExcludedChange: (sectionId: HojaDeRutaPrintSectionId, isExcluded: boolean) => void;
}

export const ModernLogisticsSection: React.FC<ModernLogisticsSectionProps> = ({
  eventData,
  setEventData,
  onUpdateTransport,
  onAddTransport,
  onRemoveTransport,
  onImportTransports,
  jobId,
  isPrintSectionExcluded,
  onPrintSectionExcludedChange,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <ModernTransportSection
        transport={eventData.logistics.transport}
        onUpdateTransport={onUpdateTransport}
        onAddTransport={onAddTransport}
        onRemoveTransport={onRemoveTransport}
        onImportTransports={onImportTransports}
        jobId={jobId}
        headerControls={
          <PrintSectionExclusionToggle
            sectionId="logistics-transport"
            isExcluded={isPrintSectionExcluded("logistics-transport")}
            onExcludedChange={onPrintSectionExcludedChange}
          />
        }
      />
      <Card className="border">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Logística del Evento
            </CardTitle>
            <PrintSectionExclusionToggle
              sectionId="logistics-details"
              isExcluded={isPrintSectionExcluded("logistics-details")}
              onExcludedChange={onPrintSectionExcludedChange}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Equipment Logistics */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Logística de Equipos
              </Label>
              <Textarea
                value={eventData.logistics.equipmentLogistics}
                onChange={(e) => setEventData(prev => {
                  const currentLogistics = prev.logistics || { transport: [], loadingDetails: "", unloadingDetails: "", equipmentLogistics: "" };
                  const updatedLogistics = {
                    ...currentLogistics,
                    equipmentLogistics: e.target.value
                  };
                  return { ...prev, logistics: updatedLogistics };
                })}
                placeholder="Instrucciones especiales para equipos..."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Unloading Details */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <ArrowDown className="w-4 h-4 text-red-600" />
                Detalles de Descarga
              </Label>
              <Textarea
                value={eventData.logistics.unloadingDetails}
                onChange={(e) => setEventData(prev => {
                  const currentLogistics = prev.logistics || { transport: [], loadingDetails: "", unloadingDetails: "", equipmentLogistics: "" };
                  const updatedLogistics = {
                    ...currentLogistics,
                    unloadingDetails: e.target.value
                  };
                  return { ...prev, logistics: updatedLogistics };
                })}
                placeholder="Horarios, ubicación, personal necesario para la descarga..."
                className="min-h-[120px]"
              />
            </div>

            {/* Loading Details */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-green-600" />
                Detalles de Carga
              </Label>
              <Textarea
                value={eventData.logistics.loadingDetails}
                onChange={(e) => setEventData(prev => {
                  const currentLogistics = prev.logistics || { transport: [], loadingDetails: "", unloadingDetails: "", equipmentLogistics: "" };
                  const updatedLogistics = {
                    ...currentLogistics,
                    loadingDetails: e.target.value
                  };
                  return { ...prev, logistics: updatedLogistics };
                })}
                placeholder="Horarios, ubicación, personal necesario para la carga..."
                className="min-h-[120px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
