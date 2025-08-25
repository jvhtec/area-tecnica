
import { CalendarSection } from "./CalendarSection";
import { TodaySchedule } from "./TodaySchedule";

interface DashboardContentProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  jobs: any[];
  selectedDateJobs: any[];
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  userRole: string | null;
  onDateTypeChange: () => void;
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
  onDateTypeChange,
}: DashboardContentProps) => {
  return (
    <div className="space-y-8">
      {/* Calendar section - full width */}
      <div className="w-full">
        <CalendarSection 
          date={date} 
          onDateSelect={setDate} 
          jobs={jobs} 
          onDateTypeChange={onDateTypeChange}
        />
      </div>
      
        {/* Today's Schedule below the calendar - Hidden on mobile */}
        <div className="w-full hidden md:block">
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
  );
};
