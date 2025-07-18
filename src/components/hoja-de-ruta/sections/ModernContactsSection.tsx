import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Plus, Trash2, User, Briefcase } from "lucide-react";
import { EventData } from "@/types/hoja-de-ruta";

interface ModernContactsSectionProps {
  eventData: EventData;
  onContactChange: (index: number, field: string, value: string) => void;
  onAddContact: () => void;
}

export const ModernContactsSection: React.FC<ModernContactsSectionProps> = ({
  eventData,
  onContactChange,
  onAddContact,
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
              <Phone className="w-5 h-5 text-purple-600" />
              Contactos del Evento
            </CardTitle>
            <Button
              onClick={onAddContact}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Añadir Contacto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <AnimatePresence>
              {eventData.contacts.map((contact, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-4 border-2 border-gray-200 rounded-lg bg-gradient-to-r from-purple-50 to-transparent"
                >
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Nombre
                      </Label>
                      <Input
                        value={contact.name}
                        onChange={(e) => onContactChange(index, 'name', e.target.value)}
                        placeholder="Nombre completo"
                        className="border-2 focus:border-purple-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        Cargo
                      </Label>
                      <Input
                        value={contact.role}
                        onChange={(e) => onContactChange(index, 'role', e.target.value)}
                        placeholder="Director, Técnico..."
                        className="border-2 focus:border-purple-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Teléfono
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={contact.phone}
                          onChange={(e) => onContactChange(index, 'phone', e.target.value)}
                          placeholder="+34 xxx xxx xxx"
                          className="border-2 focus:border-purple-300"
                        />
                        {index > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Remove contact logic would go here
                            }}
                            className="px-3"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
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