import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, Plus, Trash2 } from "lucide-react";
import { Transport } from "@/types/hoja-de-ruta";

interface ModernTransportSectionProps {
  transport: Transport[];
  onUpdateTransport: (index: number, field: keyof Transport, value: any) => void;
  onAddTransport: () => void;
  onRemoveTransport: (index: number) => void;
}

export const ModernTransportSection: React.FC<ModernTransportSectionProps> = ({
  transport,
  onUpdateTransport,
  onAddTransport,
  onRemoveTransport,
}) => {
  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            Transporte
          </CardTitle>
          <Button
            onClick={onAddTransport}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Añadir Transporte
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <AnimatePresence>
            {transport.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6 border-2 border-gray-200 rounded-lg bg-gradient-to-r from-indigo-50 to-transparent"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Transporte {index + 1}</h3>
                  {index > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRemoveTransport(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Transporte</Label>
                    <Select
                      value={item.transport_type}
                      onValueChange={(value) => onUpdateTransport(index, 'transport_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trailer">Trailer</SelectItem>
                        <SelectItem value="9m">9m</SelectItem>
                        <SelectItem value="8m">8m</SelectItem>
                        <SelectItem value="6m">6m</SelectItem>
                        <SelectItem value="4m">4m</SelectItem>
                        <SelectItem value="furgoneta">Furgoneta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre del Conductor</Label>
                    <Input
                      value={item.driver_name || ''}
                      onChange={(e) => onUpdateTransport(index, 'driver_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono del Conductor</Label>
                    <Input
                      value={item.driver_phone || ''}
                      onChange={(e) => onUpdateTransport(index, 'driver_phone', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Matrícula</Label>
                    <Input
                      value={item.license_plate || ''}
                      onChange={(e) => onUpdateTransport(index, 'license_plate', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Compañía</Label>
                    <Select
                      value={item.company}
                      onValueChange={(value) => onUpdateTransport(index, 'company', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar compañía" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pantoja">Pantoja</SelectItem>
                        <SelectItem value="transluminaria">Transluminaria</SelectItem>
                        <SelectItem value="transcamarena">Transcamarena</SelectItem>
                        <SelectItem value="wild tour">Wild Tour</SelectItem>
                        <SelectItem value="camionaje">Camionaje</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha y Hora</Label>
                    <Input
                      type="datetime-local"
                      value={item.date_time || ''}
                      onChange={(e) => onUpdateTransport(index, 'date_time', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id={`has_return_${item.id}`}
                      checked={item.has_return || false}
                      onCheckedChange={(checked) => onUpdateTransport(index, 'has_return', checked)}
                    />
                    <Label htmlFor={`has_return_${item.id}`}>Mismo camión para la vuelta</Label>
                  </div>
                  {item.has_return && (
                    <div className="space-y-2">
                      <Label>Fecha y Hora de Vuelta</Label>
                      <Input
                        type="datetime-local"
                        value={item.return_date_time || ''}
                        onChange={(e) => onUpdateTransport(index, 'return_date_time', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
};
