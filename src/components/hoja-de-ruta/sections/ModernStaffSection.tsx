import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Trash2, User, IdCard, Briefcase } from "lucide-react";
import { EventData } from "@/types/hoja-de-ruta";
import { ProfileAutocomplete, type Profile } from "../components/ProfileAutocomplete";
import { MaskedDniInput } from "../components/MaskedDniInput";
import { groupStaffByDepartment } from "@/features/hoja-de-ruta/model/groupStaffByDepartment";
import { dataLayerClient } from "@/services/dataLayerClient";
import { PrintSectionExclusionToggle } from "../components/PrintSectionExclusionToggle";
import type { HojaDeRutaPrintSectionId } from "@/utils/hoja-de-ruta/pdf";
import { reportHojaError } from "@/features/hoja-de-ruta/lib/hojaLogger";
interface ModernStaffSectionProps {
  eventData: EventData;
  onStaffChange: (index: number, field: string, value: string) => void;
  onAddStaff: () => void;
  onRemoveStaff: (index: number) => void;
  onProfileSelect?: (index: number, profileData: any) => void;
  isPrintSectionExcluded: (sectionId: HojaDeRutaPrintSectionId) => boolean;
  onPrintSectionExcludedChange: (sectionId: HojaDeRutaPrintSectionId, isExcluded: boolean) => void;
}

export const ModernStaffSection: React.FC<ModernStaffSectionProps> = ({
  eventData,
  onStaffChange,
  onAddStaff,
  onRemoveStaff,
  onProfileSelect,
  isPrintSectionExcluded,
  onPrintSectionExcludedChange,
}) => {
  // Reveal state is per staff id, not global: masking one row must not affect
  // another. Radix's TabsContent unmounts inactive tabs, so this also resets
  // for free on tab change / dialog reopen.
  const [revealedDniIds, setRevealedDniIds] = useState<Set<string>>(new Set());

  const handleRemoveStaff = (index: number) => {
    const removedId = eventData.staff[index]?.id;
    if (removedId) {
      setRevealedDniIds((prev) => {
        if (!prev.has(removedId)) return prev;
        const next = new Set(prev);
        next.delete(removedId);
        return next;
      });
    }
    onRemoveStaff(index);
  };

  const handleProfileSelect = async (index: number, profile: Partial<Profile>) => {
    // Auto-fill: use first_name for 'Nombre' and put full last_name in 'Apellidos'
    const firstName = (profile.first_name || '').toString().trim();
    const lastName = (profile.last_name || '').toString().trim();

    if (firstName) onStaffChange(index, 'name', firstName);
    if (lastName) {
      onStaffChange(index, 'surname1', lastName);
      onStaffChange(index, 'surname2', ''); // keep empty; field is hidden
    }

    if (profile.department) onStaffChange(index, 'department', profile.department);

    // Ensure DNI auto-fills when available
    let dni = (profile.dni || '').toString().trim();
    if (!dni && profile.id) {
      // Fallback: fetch full profile to ensure DNI is loaded
      try {
        const { data: p, error } = await dataLayerClient.from('profiles')
          .select('dni, role, first_name, last_name')
          .eq('id', profile.id)
          .maybeSingle();
        if (!error && p?.dni) {
          dni = p.dni;
        }
      } catch (e) {
        reportHojaError("staff.profile.fetch", e);
      }
    }
    if (dni) onStaffChange(index, 'dni', dni);
    // Do not auto-fill position from profile.role per request
    
    if (onProfileSelect) {
      onProfileSelect(index, profile);
    }
  };
  const staffGroups = groupStaffByDepartment(eventData.staff);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-warning" />
              Personal del Evento
            </CardTitle>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <PrintSectionExclusionToggle
                sectionId="staff"
                isExcluded={isPrintSectionExcluded("staff")}
                onExcludedChange={onPrintSectionExcludedChange}
              />
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {staffGroups.map((group) => (
              <div key={group.department || "sin-departamento"} className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-medium">
                    {group.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {group.members.length} persona{group.members.length === 1 ? "" : "s"}
                  </span>
                </div>
                <AnimatePresence>
                  {group.members.map(({ staff, index }) => (
                    <motion.div
                      key={staff.id ?? `staff-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="p-4 border-2 border-border rounded-lg bg-muted/30"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Nombre
                          </Label>
                          <ProfileAutocomplete
                            value={staff.name ?? ""}
                            onChange={(value) => onStaffChange(index, 'name', value)}
                            onSelect={(profile) => handleProfileSelect(index, profile)}
                            placeholder="Buscar por nombre..."
                            className="border-2 focus:border-warning/50"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <IdCard className="w-4 h-4" />
                            Apellidos
                          </Label>
                          <Input
                            value={staff.surname1}
                            onChange={(e) => onStaffChange(index, 'surname1', e.target.value)}
                            placeholder="Apellidos"
                            className="border-2 focus:border-warning/50"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <IdCard className="w-4 h-4" />
                            DNI
                          </Label>
                          <MaskedDniInput
                            value={staff.dni ?? ""}
                            onChange={(value) => onStaffChange(index, 'dni', value)}
                            placeholder="DNI"
                            className="border-2 focus:border-warning/50"
                            revealed={Boolean(staff.id && revealedDniIds.has(staff.id))}
                            onRevealedChange={(revealed) => {
                              const id = staff.id;
                              if (!id) return;
                              setRevealedDniIds((prev) => {
                                const next = new Set(prev);
                                if (revealed) next.add(id); else next.delete(id);
                                return next;
                              });
                            }}
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
                              className="border-2 focus:border-warning/50"
                            />
                            {eventData.staff.length > 1 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoveStaff(index)}
                                className="px-3"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {staff.position && (
                        <div className="mt-3 pt-3 border-t border-warning/30">
                          <Badge variant="outline" className="bg-warning/15 text-warning border-warning/40">
                            {staff.position}
                          </Badge>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
