import React, { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Users } from "lucide-react";

import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { labelForCode } from "@/utils/roles";

interface JobDetailsPersonnelTabProps {
  jobDetails: any;
  isJobLoading: boolean;
  department?: string;
}

export const JobDetailsPersonnelTab: React.FC<JobDetailsPersonnelTabProps> = ({ jobDetails, isJobLoading, department }) => {
  const normalizedDepartment = department?.toLowerCase?.() ?? null;

  const filteredAssignments = useMemo(() => {
    const assignments = jobDetails?.job_assignments ?? [];
    if (!normalizedDepartment) {
      return assignments;
    }
    return assignments.filter((assignment: any) => {
      const profileDept = assignment.profiles?.department?.toLowerCase?.();
      if (profileDept === normalizedDepartment) {
        return true;
      }
      if (normalizedDepartment === "sound" && assignment.sound_role) {
        return true;
      }
      if (normalizedDepartment === "lights" && assignment.lights_role) {
        return true;
      }
      if (normalizedDepartment === "video" && assignment.video_role) {
        return true;
      }
      return false;
    });
  }, [jobDetails?.job_assignments, normalizedDepartment]);

  const technicianDatesMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (jobDetails?.timesheets) {
      jobDetails.timesheets.forEach((t: any) => {
        if (t.technician_id && t.date) {
          if (!map.has(t.technician_id)) {
            map.set(t.technician_id, new Set());
          }
          map.get(t.technician_id)?.add(t.date);
        }
      });
    }
    return map;
  }, [jobDetails?.timesheets]);

  return (
    <TabsContent value="personnel" className="space-y-4 min-w-0 overflow-x-hidden">
      <Card className="p-4 w-full min-w-0 overflow-hidden">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Personal asignado
        </h3>

        {isJobLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredAssignments.length > 0 ? (
          <div className="space-y-3">
            {filteredAssignments.map((assignment: any) => (
              <div
                key={assignment.technician_id}
                className="flex items-start gap-3 p-3 bg-muted rounded min-w-0"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  {assignment.profiles?.profile_picture_url && (
                    <AvatarImage
                      src={assignment.profiles.profile_picture_url}
                      alt={`${assignment.profiles.first_name} ${assignment.profiles.last_name}`}
                    />
                  )}
                  <AvatarFallback className="text-sm">
                    {assignment.profiles
                      ? `${assignment.profiles.first_name?.[0] || ""}${assignment.profiles.last_name?.[0] || ""}`.toUpperCase()
                      : "EX"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {assignment.profiles
                      ? `${assignment.profiles.first_name} ${assignment.profiles.last_name}`
                      : assignment.external_technician_name || "Desconocido"}
                  </p>
                  <p className="text-sm text-muted-foreground">{assignment.profiles?.department || "Externo"}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {assignment.sound_role && (
                      <Badge variant="outline" className="text-xs">
                        Sonido: {labelForCode(assignment.sound_role)}
                      </Badge>
                    )}
                    {assignment.lights_role && (
                      <Badge variant="outline" className="text-xs">
                        Luces: {labelForCode(assignment.lights_role)}
                      </Badge>
                    )}
                    {assignment.video_role && (
                      <Badge variant="outline" className="text-xs">
                        Vídeo: {labelForCode(assignment.video_role)}
                      </Badge>
                    )}
                    {assignment.single_day && (
                      <Badge variant="secondary" className="text-xs">
                        {(() => {
                          const dates = technicianDatesMap.get(assignment.technician_id);
                          if (dates && dates.size > 0) {
                            return dates.size === 1 ? "Día único" : "Varios días";
                          }
                          return "Día único";
                        })()}
                      </Badge>
                    )}
                  </div>
                  {assignment.single_day && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {(() => {
                        const dates = technicianDatesMap.get(assignment.technician_id);
                        if (dates && dates.size > 0) {
                          const sortedDates = Array.from(dates).sort();
                          if (sortedDates.length === 1) {
                            return `Solo día: ${format(new Date(sortedDates[0]), "PPP", { locale: es })}`;
                          }
                          return `Días: ${sortedDates.map((d) => format(new Date(d), "dd/MM")).join(", ")}`;
                        }
                        return assignment.assignment_date
                          ? `Solo día: ${format(new Date(assignment.assignment_date), "PPP", { locale: es })}`
                          : "Sin fecha definida";
                      })()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">No hay personal asignado aún</p>
          </div>
        )}
      </Card>
    </TabsContent>
  );
};

