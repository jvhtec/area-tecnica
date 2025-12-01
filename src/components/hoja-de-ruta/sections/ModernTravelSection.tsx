import React, { useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { Car, Plus, Trash2, Plane, Bus, Train, MapPin, Clock, User, Phone, Hash } from "lucide-react";
import { TravelArrangement } from "@/types/hoja-de-ruta";
import { AddressAutocomplete } from "@/components/maps/AddressAutocomplete";

interface ModernTravelSectionProps {
  travelArrangements: TravelArrangement[];
  onUpdate: (index: number, field: keyof TravelArrangement, value: any) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export const ModernTravelSection: React.FC<ModernTravelSectionProps> = ({
  travelArrangements,
  onUpdate,
  onAdd,
  onRemove,
}) => {
  const getTransportIcon = (type: string) => {
    switch (type) {
      case 'plane': return Plane;
      case 'train': return Train;
      case 'sleeper_bus': return Bus;
      case 'RV': return Car;
      case 'own_means': return Car;
      default: return Car;
    }
  };

  // Convert ISO datetime string to datetime-local format (YYYY-MM-DDTHH:mm)
  const toLocalDateTime = useCallback((isoString: string | undefined): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      // Adjust for local timezone
      const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return localDate.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  }, []);

  // Convert datetime-local format to ISO string
  const toISODateTime = useCallback((localValue: string): string | undefined => {
    if (!localValue) return undefined;
    try {
      return new Date(localValue).toISOString();
    } catch {
      return undefined;
    }
  }, []);

  // Handle pickup_time change with conversion
  const handlePickupTimeChange = useCallback((index: number, value: string) => {
    const isoValue = toISODateTime(value);
    onUpdate(index, 'pickup_time', isoValue);
  }, [onUpdate, toISODateTime]);

  // Handle departure_time change with conversion
  const handleDepartureTimeChange = useCallback((index: number, value: string) => {
    const isoValue = toISODateTime(value);
    onUpdate(index, 'departure_time', isoValue);
  }, [onUpdate, toISODateTime]);

  // Handle arrival_time change with conversion
  const handleArrivalTimeChange = useCallback((index: number, value: string) => {
    const isoValue = toISODateTime(value);
    onUpdate(index, 'arrival_time', isoValue);
  }, [onUpdate, toISODateTime]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-cyan-600" />
              Transporte y Viajes
            </CardTitle>
            <Button
              onClick={onAdd}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Añadir Viaje
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <AnimatePresence>
              {travelArrangements.map((arrangement, index) => {
                const TransportIcon = getTransportIcon(arrangement.transportation_type);
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="p-4 border-2 border-gray-200 rounded-lg bg-gradient-to-r from-cyan-50 to-transparent"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <TransportIcon className="w-5 h-5 text-cyan-600" />
                        <h4 className="font-medium">Viaje {index + 1}</h4>
                      </div>
                      {index > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRemove(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Tipo de Transporte
                        </Label>
                        <Select
                          value={arrangement.transportation_type}
                          onValueChange={(value) => onUpdate(index, 'transportation_type', value)}
                        >
                          <SelectTrigger className="border-2 focus:border-cyan-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="van">
                              <div className="flex items-center gap-2">
                                <Car className="w-4 h-4" />
                                Furgoneta
                              </div>
                            </SelectItem>
                            <SelectItem value="sleeper_bus">
                              <div className="flex items-center gap-2">
                                <Bus className="w-4 h-4" />
                                Autobús Cama
                              </div>
                            </SelectItem>
                            <SelectItem value="train">
                              <div className="flex items-center gap-2">
                                <Train className="w-4 h-4" />
                                Tren
                              </div>
                            </SelectItem>
                            <SelectItem value="plane">
                              <div className="flex items-center gap-2">
                                <Plane className="w-4 h-4" />
                                Avión
                              </div>
                            </SelectItem>
                            <SelectItem value="RV">
                              <div className="flex items-center gap-2">
                                <Car className="w-4 h-4" />
                                Autocaravana
                              </div>
                            </SelectItem>
                            <SelectItem value="own_means">
                              <div className="flex items-center gap-2">
                                <Car className="w-4 h-4" />
                                Medios propios
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {arrangement.transportation_type !== 'own_means' && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              Dirección de Recogida
                            </Label>
                            <AddressAutocomplete
                              value={arrangement.pickup_address || ''}
                              onChange={(address) => onUpdate(index, 'pickup_address', address)}
                              placeholder="Buscar dirección de recogida..."
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Fecha y Hora de Recogida
                            </Label>
                            <Input
                              type="datetime-local"
                              value={toLocalDateTime(arrangement.pickup_time)}
                              onChange={(e) => handlePickupTimeChange(index, e.target.value)}
                              className="border-2 focus:border-cyan-300"
                            />
                          </div>
                        </>
                      )}

                      {(arrangement.transportation_type === 'plane' || arrangement.transportation_type === 'train') && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Número de Vuelo/Tren
                            </Label>
                            <Input
                              value={arrangement.flight_train_number || ''}
                              onChange={(e) => onUpdate(index, 'flight_train_number', e.target.value)}
                              placeholder="IB1234, AVE123..."
                              className="border-2 focus:border-cyan-300"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Fecha y Hora de Salida
                            </Label>
                            <Input
                              type="datetime-local"
                              value={toLocalDateTime(arrangement.departure_time)}
                              onChange={(e) => handleDepartureTimeChange(index, e.target.value)}
                              className="border-2 focus:border-cyan-300"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Fecha y Hora de Llegada
                            </Label>
                            <Input
                              type="datetime-local"
                              value={toLocalDateTime(arrangement.arrival_time)}
                              onChange={(e) => handleArrivalTimeChange(index, e.target.value)}
                              className="border-2 focus:border-cyan-300"
                            />
                          </div>
                        </>
                      )}

                      {/* Driver Information - Only for ground transportation */}
                      {(arrangement.transportation_type === 'van' || 
                        arrangement.transportation_type === 'sleeper_bus' || 
                        arrangement.transportation_type === 'RV') && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <User className="w-4 h-4" />
                              Nombre del Conductor
                            </Label>
                            <Input
                              value={arrangement.driver_name || ''}
                              onChange={(e) => onUpdate(index, 'driver_name', e.target.value)}
                              placeholder="Nombre completo"
                              className="border-2 focus:border-cyan-300"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              Teléfono del Conductor
                            </Label>
                            <Input
                              value={arrangement.driver_phone || ''}
                              onChange={(e) => onUpdate(index, 'driver_phone', e.target.value)}
                              placeholder="+34 600 000 000"
                              className="border-2 focus:border-cyan-300"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <Hash className="w-4 h-4" />
                              Matrícula del Vehículo
                            </Label>
                            <Input
                              value={arrangement.plate_number || ''}
                              onChange={(e) => onUpdate(index, 'plate_number', e.target.value)}
                              placeholder="1234-ABC"
                              className="border-2 focus:border-cyan-300"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label className="text-sm font-medium">
                        Notas del Viaje
                      </Label>
                      <Textarea
                        value={arrangement.notes || ''}
                        onChange={(e) => onUpdate(index, 'notes', e.target.value)}
                        placeholder="Información adicional sobre el viaje..."
                        className="border-2 focus:border-cyan-300"
                      />
                      {arrangement.transportation_type === 'own_means' && (
                        <p className="text-xs text-gray-500">
                          Con "Medios propios" no es necesario completar direcciones, horarios ni datos de conductor.
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
