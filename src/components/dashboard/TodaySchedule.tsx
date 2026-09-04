import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobCardNew } from "@/components/jobs/cards/JobCardNew";
import { isFestivalLikeJobType } from "@/utils/jobType";
import type { JobCardJob } from "@/features/jobs/job-card-new/jobCardNewTypes";
import { ALL_DEPARTMENTS, type Department } from "@/types/department";

/**
 * `TodaySchedule` is fed either job rows directly or assignment rows that wrap the
 * job under `jobs`. Keep those two inputs explicit so typing the component does not
 * add a runtime validation gate that could hide a previously renderable job card.
 */
type WrappedTodayScheduleJob = {
  job_id?: string | null;
  department?: string | null;
  jobs: JobCardJob;
};

export type TodayScheduleEntry = JobCardJob | WrappedTodayScheduleJob;

const isWrappedJob = (entry: TodayScheduleEntry): entry is WrappedTodayScheduleJob =>
  "jobs" in entry && typeof entry.jobs === "object" && entry.jobs !== null;

const unwrapJob = (entry: TodayScheduleEntry): JobCardJob =>
  isWrappedJob(entry) ? entry.jobs : entry;

const isDepartment = (value: unknown): value is Department =>
  typeof value === "string" && (ALL_DEPARTMENTS as readonly string[]).includes(value);

const resolveDepartment = (...candidates: unknown[]): Department =>
  candidates.find(isDepartment) ?? "sound";

interface TodayScheduleProps {
  jobs: TodayScheduleEntry[];
  onEditClick: (job: JobCardJob) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  userRole: string | null;
  selectedDate?: Date;
  isLoading?: boolean;
  hideTasks?: boolean;
  detailsOnlyMode?: boolean;
  department?: string;
  viewMode?: "grid" | "sidebar";
}

export const TodaySchedule = ({
  jobs,
  onEditClick,
  onDeleteClick,
  onJobClick,
  userRole,
  selectedDate,
  isLoading = false,
  hideTasks = false,
  detailsOnlyMode = false,
  department,
  viewMode = "grid"
}: TodayScheduleProps) => {
  if (import.meta.env.DEV) {
    console.log("TodaySchedule received jobs:", jobs);
  }

  if (isLoading) {
    if (viewMode === "sidebar") {
      return (
        <div className="flex items-center justify-center p-8 text-slate-500">
          <p className="text-sm">Cargando asignaciones...</p>
        </div>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agenda del Día</CardTitle>
        </CardHeader>
        <CardContent className="p-1">
          <div className="flex items-center justify-center p-4">
            <p className="text-muted-foreground">Cargando asignaciones...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!jobs || jobs.length === 0) {
    if (viewMode === "sidebar") {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-slate-500 gap-2">
          <p className="text-sm">No hay asignaciones para hoy</p>
        </div>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agenda del Día</CardTitle>
        </CardHeader>
        <CardContent className="p-1">
          <div className="flex items-center justify-center p-4">
            <p className="text-muted-foreground">No hay asignaciones para mostrar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const jobCards = jobs.map((entry) => {
    if (import.meta.env.DEV) {
      console.log("Rendering job in TodaySchedule:", entry);
    }

    const job = unwrapJob(entry);

    return (
      <JobCardNew
        key={job.id}
        job={job}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        onJobClick={onJobClick}
        userRole={userRole}
        department={resolveDepartment(department, entry.department, job.department)}
        hideTasks={hideTasks}
        showManageArtists={isFestivalLikeJobType(job.job_type)}
        detailsOnlyMode={detailsOnlyMode}
        selectedDate={selectedDate}
      />
    );
  });

  if (viewMode === "sidebar") {
    return (
      <div className="flex flex-col gap-3">
        {jobCards}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda del Día</CardTitle>
      </CardHeader>
      <CardContent className="p-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobCards}
        </div>
      </CardContent>
    </Card>
  );
};
