import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Building2, Package, ArrowDown, ArrowUp } from "lucide-react";
import { EventData, Transport } from "@/types/hoja-de-ruta";
import { ModernTransportSection } from "./ModernTransportSection";

interface ModernLogisticsSectionProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
  onUpdateTransport: (index: number, field: keyof Transport, value: any) => void;
  onAddTransport: () => void;
  onRemoveTransport: (index: number) => void;
}

export const ModernLogisticsSection: React.FC<ModernLogisticsSectionProps> = ({
  eventData,
  setEventData,
  onUpdateTransport,
  onAddTransport,
  onRemoveTransport,
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
      />
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Logística del Evento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Equipment Logistics */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                Logística de Equipos
              </Label>
              <Textarea
                value={eventData.logistics.equipmentLogistics}
                onChange={(e) => setEventData(prev => ({
                  ...prev,
                  logistics: { ...prev.logistics, equipmentLogistics: e.target.value }
                }))}
                placeholder="Instrucciones especiales para equipos..."
                className="border-2 focus:border-indigo-300 min-h-[100px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Loading Details */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-green-600" />
                Detalles de Carga
              </Label>
              <Textarea
                value={eventData.logistics.loadingDetails}
                onChange={(e) => setEventData(prev => ({
                  ...prev,
                  logistics: { ...prev.logistics, loadingDetails: e.target.value }
                }))}
                placeholder="Horarios, ubicación, personal necesario para la carga..."
                className="border-2 focus:border-green-300 min-h-[120px]"
              />
            </div>

            {/* Unloading Details */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <ArrowDown className="w-4 h-4 text-red-600" />
                Detalles de Descarga
              </Label>
              <Textarea
                value={eventData.logistics.unloadingDetails}
                onChange={(e) => setEventData(prev => ({
                  ...prev,
                  logistics: { ...prev.logistics, unloadingDetails: e.target.value }
                }))}
                placeholder="Horarios, ubicación, personal necesario para la descarga..."
                className="border-2 focus:border-red-300 min-h-[120px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
