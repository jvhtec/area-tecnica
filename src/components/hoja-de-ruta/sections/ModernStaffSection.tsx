import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Trash2, User, IdCard, Briefcase } from "lucide-react";
import { EventData } from "@/types/hoja-de-ruta";

interface ModernStaffSectionProps {
  eventData: EventData;
  onStaffChange: (index: number, field: string, value: string) => void;
  onAddStaff: () => void;
}

export const ModernStaffSection: React.FC<ModernStaffSectionProps> = ({
  eventData,
  onStaffChange,
  onAddStaff,
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
              <Users className="w-5 h-5 text-orange-600" />
              Personal del Evento
            </CardTitle>
            <Button
              onClick={onAddStaff}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Añadir Personal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <AnimatePresence>
              {eventData.staff.map((staff, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-4 border-2 border-gray-200 rounded-lg bg-gradient-to-r from-orange-50 to-transparent"
                >
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Nombre
                      </Label>
                      <Input
                        value={staff.name}
                        onChange={(e) => onStaffChange(index, 'name', e.target.value)}
                        placeholder="Nombre"
                        className="border-2 focus:border-orange-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <IdCard className="w-4 h-4" />
                        Primer Apellido
                      </Label>
                      <Input
                        value={staff.surname1}
                        onChange={(e) => onStaffChange(index, 'surname1', e.target.value)}
                        placeholder="Primer apellido"
                        className="border-2 focus:border-orange-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Segundo Apellido
                      </Label>
                      <Input
                        value={staff.surname2}
                        onChange={(e) => onStaffChange(index, 'surname2', e.target.value)}
                        placeholder="Segundo apellido"
                        className="border-2 focus:border-orange-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        Posición
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={staff.position}
                          onChange={(e) => onStaffChange(index, 'position', e.target.value)}
                          placeholder="Técnico, Jefe..."
                          className="border-2 focus:border-orange-300"
                        />
                        {index > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Remove staff logic would go here
                            }}
                            className="px-3"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {staff.position && (
                    <div className="mt-3 pt-3 border-t border-orange-200">
                      <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                        {staff.position}
                      </Badge>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};