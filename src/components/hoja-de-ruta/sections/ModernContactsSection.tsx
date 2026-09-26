import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Mail, MessageCircle, Phone, Plus, Trash2, User } from "lucide-react";
import { EventData } from "@/types/hoja-de-ruta";
import { PrintSectionExclusionToggle } from "../components/PrintSectionExclusionToggle";
import type { HojaDeRutaPrintSectionId } from "@/utils/hoja-de-ruta/pdf";
import { buildTelHref, buildWhatsAppHref } from "@/utils/phoneLinks";

interface ModernContactsSectionProps {
  eventData: EventData;
  onContactChange: (index: number, field: string, value: string) => void;
  onAddContact: () => void;
  onRemoveContact: (index: number) => void;
  isPrintSectionExcluded: (sectionId: HojaDeRutaPrintSectionId) => boolean;
  onPrintSectionExcludedChange: (sectionId: HojaDeRutaPrintSectionId, isExcluded: boolean) => void;
}

export const ModernContactsSection: React.FC<ModernContactsSectionProps> = ({
  eventData,
  onContactChange,
  onAddContact,
  onRemoveContact,
  isPrintSectionExcluded,
  onPrintSectionExcludedChange,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-purple-600" />
              Contactos del Evento
            </CardTitle>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <PrintSectionExclusionToggle
                sectionId="contacts"
                isExcluded={isPrintSectionExcluded("contacts")}
                onExcludedChange={onPrintSectionExcludedChange}
              />
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <AnimatePresence>
              {eventData.contacts.map((contact, index) => {
                const phoneHref = buildTelHref(contact.phone);
                const whatsappHref = buildWhatsAppHref(contact.phone);

                return (
                <motion.div
                  key={contact.id || index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="rounded-lg border-2 border-border bg-muted/30 p-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Nombre
                      </Label>
                      <Input
                        value={contact.name}
                        onChange={(e) => onContactChange(index, 'name', e.target.value)}
                        placeholder="Nombre completo"
                        className="border-2"
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
                        className="border-2"
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
                          className="min-w-0 border-2"
                        />
                        {phoneHref && (
                          <Button asChild size="icon" variant="outline" className="shrink-0" title="Llamar">
                            <a href={phoneHref} aria-label={`Llamar a ${contact.name || "contacto"}`}>
                              <Phone className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {whatsappHref && (
                          <Button asChild size="icon" variant="outline" className="shrink-0" title="Abrir WhatsApp">
                            <a
                              href={whatsappHref}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Abrir WhatsApp de ${contact.name || "contacto"}`}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {eventData.contacts.length > 1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onRemoveContact(index)}
                            className="px-3"
                            aria-label={`Eliminar contacto ${contact.name || index + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="h-4 w-4" />
                        Correo electrónico
                      </Label>
                      <Input
                        type="email"
                        value={contact.email || ""}
                        onChange={(event) => onContactChange(index, "email", event.target.value)}
                        placeholder="contacto@empresa.com"
                        className="border-2"
                      />
                    </div>
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
