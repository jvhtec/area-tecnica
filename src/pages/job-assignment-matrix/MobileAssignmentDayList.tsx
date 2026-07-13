import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { CalendarDays, ChevronLeft, ChevronRight, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MatrixAssignment, MatrixJob } from "@/pages/job-assignment-matrix/utils";

type MobileTechnician = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
};

interface MobileAssignmentDayListProps {
  assignments: MatrixAssignment[];
  date: Date;
  department: string;
  isLoading?: boolean;
  jobs: MatrixJob[];
  onDateChange: (date: Date) => void;
  technicians: MobileTechnician[];
}

const dateKey = (date: Date) => format(date, "yyyy-MM-dd");
const madridToday = () => toZonedTime(Date.now(), "Europe/Madrid");

const jobIncludesDate = (job: MatrixJob, selectedDate: Date) => {
  const key = dateKey(selectedDate);
  if (job.job_date_types?.length) {
    return job.job_date_types.some((entry) => (
      entry.date === key && !["off", "travel"].includes(String(entry.type).toLowerCase())
    ));
  }

  return key >= job.start_time.slice(0, 10) && key <= job.end_time.slice(0, 10);
};

const assignmentIncludesDate = (assignment: MatrixAssignment, selectedDate: Date) => (
  !assignment.single_day || assignment.assignment_date === dateKey(selectedDate)
);

export const MobileAssignmentDayList = ({
  assignments,
  date,
  department,
  isLoading = false,
  jobs,
  onDateChange,
  technicians,
}: MobileAssignmentDayListProps) => {
  const visibleJobs = jobs.filter((job) => jobIncludesDate(job, date));
  const techniciansById = new Map(technicians.map((technician) => [technician.id, technician]));

  return (
    <div className="h-full overflow-y-auto px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3">
      <div className="sticky top-0 z-10 mb-3 flex items-center justify-between rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Día anterior"
          onClick={() => onDateChange(addDays(date, -1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <button type="button" className="min-h-11 text-center" onClick={() => onDateChange(madridToday())}>
          <span className="block text-sm font-semibold capitalize">
            {format(date, "EEEE d 'de' MMMM", { locale: es })}
          </span>
          <span className="text-xs text-muted-foreground">Ir a hoy</span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Día siguiente"
          onClick={() => onDateChange(addDays(date, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Asignaciones del día</h2>
        </div>
        <Badge variant="outline" className="capitalize">{department}</Badge>
      </div>

      {isLoading ? (
        <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
          Cargando asignaciones…
        </div>
      ) : visibleJobs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <CalendarDays className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
          <p className="font-medium">No hay trabajos este día</p>
          <p className="mt-1 text-sm text-muted-foreground">Cambia de fecha para consultar otras asignaciones.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleJobs.map((job) => {
            const jobAssignments = assignments.filter((assignment) => (
              assignment.job_id === job.id && assignmentIncludesDate(assignment, date)
            ));

            return (
              <Card key={job.id} className="overflow-hidden border-l-4" style={{ borderLeftColor: job.color || undefined }}>
                <CardHeader className="space-y-2 p-4 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base leading-snug">{job.title}</CardTitle>
                    <Badge variant="secondary" className="shrink-0">
                      <Users className="mr-1 h-3.5 w-3.5" />
                      {jobAssignments.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{job.status || "Sin estado"}</p>
                </CardHeader>
                <CardContent className="space-y-2 p-4 pt-2">
                  {jobAssignments.length === 0 ? (
                    <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Sin personal asignado.</p>
                  ) : jobAssignments.map((assignment) => {
                    const technician = techniciansById.get(assignment.technician_id);
                    const name = technician
                      ? [technician.first_name, technician.nickname || technician.last_name].filter(Boolean).join(" ")
                      : "Técnico";
                    const role = assignment[`${department}_role` as keyof MatrixAssignment];

                    return (
                      <div key={`${assignment.job_id}-${assignment.technician_id}-${assignment.assignment_date || "all"}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{name}</p>
                          {typeof role === "string" && role && <p className="truncate text-xs text-muted-foreground">{role}</p>}
                        </div>
                        <Badge variant={assignment.status === "confirmed" ? "default" : "outline"} className="shrink-0 capitalize">
                          {assignment.status || "asignado"}
                        </Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
