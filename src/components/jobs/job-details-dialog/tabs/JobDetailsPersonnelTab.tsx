import React, { useMemo } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";
import { Users } from "lucide-react";

import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { labelForCode } from "@/utils/roles";
import { getScheduledWorkDateKeys, resolveAssignmentWorkDateKeys } from "@/utils/assignmentWorkDates";

const MADRID_TIME_ZONE = "Europe/Madrid";

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
        if (t?.is_active === false) return;
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

  const scheduledWorkDateKeys = useMemo(() => getScheduledWorkDateKeys(jobDetails), [jobDetails]);

  const assignmentsWithDates = useMemo<Array<{ assignment: any; workDateKeys: string[] }>>(() => (
    filteredAssignments.map((assignment: any) => ({
      assignment,
      workDateKeys: resolveAssignmentWorkDateKeys(assignment, {
        timesheetDateKeys: technicianDatesMap.get(assignment.technician_id),
        scheduledDateKeys: scheduledWorkDateKeys,
      }),
    }))
  ), [filteredAssignments, scheduledWorkDateKeys, technicianDatesMap]);

  const formatDateKey = (dateKey: string, pattern: string) => (
    formatInTimeZone(
      fromZonedTime(`${dateKey}T00:00:00`, MADRID_TIME_ZONE),
      MADRID_TIME_ZONE,
      pattern,
      { locale: es },
    )
  );

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
        ) : assignmentsWithDates.length > 0 ? (
          <div className="space-y-3">
            {assignmentsWithDates.map(({ assignment, workDateKeys }) => (
              <div
                key={assignment.technician_id}
                className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 p-3 bg-muted rounded min-w-0"
              >
                <div className="min-w-0 flex-1 flex items-center gap-3 md:min-w-[200px]">
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
                    <p className="font-medium break-words">
                      {assignment.profiles
                        ? `${assignment.profiles.first_name} ${assignment.profiles.last_name}`
                        : assignment.external_technician_name || "Desconocido"}
                    </p>
                    <p className="text-sm text-muted-foreground">{assignment.profiles?.department || "Externo"}</p>
                    {workDateKeys.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {workDateKeys.map((dateKey) => (
                          <Badge key={dateKey} variant="secondary" className="text-[11px] font-normal">
                            {formatDateKey(dateKey, "d MMM")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 w-full md:w-auto md:justify-end">
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
                  {workDateKeys.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {workDateKeys.length === 1 ? "1 día" : `${workDateKeys.length} días`}
                    </Badge>
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
