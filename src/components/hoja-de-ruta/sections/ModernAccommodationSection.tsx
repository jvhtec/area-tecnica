import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Bed, Plus, Trash2, User, Hotel } from "lucide-react";
import { RoomAssignment, EventData } from "@/types/hoja-de-ruta";

interface ModernAccommodationSectionProps {
  roomAssignments: RoomAssignment[];
  eventData: EventData;
  onUpdate: (index: number, field: keyof RoomAssignment, value: any) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export const ModernAccommodationSection: React.FC<ModernAccommodationSectionProps> = ({
  roomAssignments,
  eventData,
  onUpdate,
  onAdd,
  onRemove,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bed className="w-5 h-5 text-pink-600" />
              Alojamiento
            </CardTitle>
            <Button
              onClick={onAdd}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Añadir Habitación
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <AnimatePresence>
              {roomAssignments.map((room, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-4 border-2 border-gray-200 rounded-lg bg-gradient-to-r from-pink-50 to-transparent"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Hotel className="w-5 h-5 text-pink-600" />
                      <h4 className="font-medium">Habitación {index + 1}</h4>
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
                        Tipo de Habitación
                      </Label>
                      <Select
                        value={room.room_type}
                        onValueChange={(value) => onUpdate(index, 'room_type', value)}
                      >
                        <SelectTrigger className="border-2 focus:border-pink-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              Individual
                            </div>
                          </SelectItem>
                          <SelectItem value="double">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              Doble
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Número de Habitación
                      </Label>
                      <Input
                        value={room.room_number || ''}
                        onChange={(e) => onUpdate(index, 'room_number', e.target.value)}
                        placeholder="101, 202..."
                        className="border-2 focus:border-pink-300"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Personal 1
                      </Label>
                      <Select
                        value={room.staff_member1_id || ''}
                        onValueChange={(value) => onUpdate(index, 'staff_member1_id', value)}
                      >
                        <SelectTrigger className="border-2 focus:border-pink-300">
                          <SelectValue placeholder="Seleccionar personal" />
                        </SelectTrigger>
                        <SelectContent>
                          {eventData.staff.map((staff, staffIndex) => (
                            <SelectItem key={staffIndex} value={staffIndex.toString()}>
                              {staff.name} {staff.surname1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {room.room_type === 'double' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Personal 2
                        </Label>
                        <Select
                          value={room.staff_member2_id || ''}
                          onValueChange={(value) => onUpdate(index, 'staff_member2_id', value)}
                        >
                          <SelectTrigger className="border-2 focus:border-pink-300">
                            <SelectValue placeholder="Seleccionar personal" />
                          </SelectTrigger>
                          <SelectContent>
                            {eventData.staff.map((staff, staffIndex) => (
                              <SelectItem key={staffIndex} value={staffIndex.toString()}>
                                {staff.name} {staff.surname1}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};