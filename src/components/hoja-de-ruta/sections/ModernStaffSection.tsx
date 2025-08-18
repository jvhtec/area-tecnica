import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Trash2, User, IdCard, Briefcase } from "lucide-react";
import { EventData } from "@/types/hoja-de-ruta";
import { ProfileAutocomplete } from "../components/ProfileAutocomplete";

interface ModernStaffSectionProps {
  eventData: EventData;
  onStaffChange: (index: number, field: string, value: string) => void;
  onAddStaff: () => void;
  onProfileSelect?: (index: number, profileData: any) => void;
}

export const ModernStaffSection: React.FC<ModernStaffSectionProps> = ({
  eventData,
  onStaffChange,
  onAddStaff,
  onProfileSelect,
}) => {
  const handleProfileSelect = (index: number, profile: any) => {
    // Auto-fill the form fields from the selected profile
    if (profile.first_name) {
      onStaffChange(index, 'name', profile.first_name);
    }
    if (profile.last_name) {
      // Split last name into surname1 and surname2 if needed
      const lastNames = profile.last_name.split(' ');
      onStaffChange(index, 'surname1', lastNames[0] || '');
      if (lastNames.length > 1) {
        onStaffChange(index, 'surname2', lastNames.slice(1).join(' '));
      }
    }
    if (profile.dni) {
      onStaffChange(index, 'dni', profile.dni);
    }
    if (profile.role) {
      onStaffChange(index, 'position', profile.role);
    }
    
    // Call the optional callback
    if (onProfileSelect) {
      onProfileSelect(index, profile);
    }
  };
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
                      <ProfileAutocomplete
                        value={staff.name}
                        onChange={(value) => onStaffChange(index, 'name', value)}
                        onSelect={(profile) => handleProfileSelect(index, profile)}
                        placeholder="Buscar por nombre..."
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
                        <IdCard className="w-4 h-4" />
                        DNI
                      </Label>
                      <Input
                        value={staff.dni}
                        onChange={(e) => onStaffChange(index, 'dni', e.target.value)}
                        placeholder="DNI"
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
