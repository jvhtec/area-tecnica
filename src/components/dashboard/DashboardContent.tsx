import { CalendarSection } from "./CalendarSection";
import { TodaySchedule } from "./TodaySchedule";
import { DepartmentSchedule } from "./DepartmentSchedule";
import { Music2, Lightbulb, Video } from "lucide-react";

interface DashboardContentProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  jobs: any[];
  selectedDateJobs: any[];
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  userRole: string | null;
}

export const DashboardContent = ({
  date,
  setDate,
  jobs = [], // Provide default empty array
  selectedDateJobs,
  onEditClick,
  onDeleteClick,
  onJobClick,
  userRole,
}: DashboardContentProps) => {
  // Filter functions with null safety
  const filterJobsByDepartment = (department: string) => {
    if (!Array.isArray(jobs)) return [];
    return jobs.filter(job => 
      job?.job_departments?.some((dept: any) => dept.department === department)
    );
  };

  return (
    <div className="space-y-8">
      {/* Calendar and Today's Schedule section - stacks on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <CalendarSection 
            date={date} 
            onDateSelect={setDate} 
            jobs={jobs} 
          />
        </div>
        <div className="lg:col-span-4">
          <TodaySchedule
            jobs={selectedDateJobs}
            onEditClick={onEditClick}
            onDeleteClick={onDeleteClick}
            onJobClick={onJobClick}
            userRole={userRole}
            selectedDate={date}
          />
        </div>
      </div>

      {/* Department schedules section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <DepartmentSchedule
          name="sound"
          icon={Music2}
          color="text-blue-500"
          jobs={filterJobsByDepartment("sound")}
          onEditClick={onEditClick}
          onDeleteClick={onDeleteClick}
          onJobClick={onJobClick}
          userRole={userRole}
        />
        <DepartmentSchedule
          name="lights"
          icon={Lightbulb}
          color="text-yellow-500"
          jobs={filterJobsByDepartment("lights")}
          onEditClick={onEditClick}
          onDeleteClick={onDeleteClick}
          onJobClick={onJobClick}
          userRole={userRole}
        />
        <DepartmentSchedule
          name="video"
          icon={Video}
          color="text-green-500"
          jobs={filterJobsByDepartment("video")}
          onEditClick={onEditClick}
          onDeleteClick={onDeleteClick}
          onJobClick={onJobClick}
          userRole={userRole}
        />
      </div>
    </div>
  );
};