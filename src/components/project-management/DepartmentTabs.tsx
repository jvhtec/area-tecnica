
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobCardNew } from "@/components/jobs/cards/JobCardNew";
import { Department } from "@/types/department";
import { Loader2 } from "lucide-react";
import { isToday, isWithinInterval, startOfDay, endOfDay } from "date-fns";

interface DepartmentTabsProps {
  selectedDepartment: Department;
  onDepartmentChange: (value: string) => void;
  jobs: any[];
  jobsLoading: boolean;
  onDeleteDocument?: (jobId: string, document: any) => void;
  userRole?: string | null;
  highlightToday?: boolean;
}

export const DepartmentTabs = ({
  selectedDepartment,
  onDepartmentChange,
  jobs,
  jobsLoading,
  onDeleteDocument,
  userRole,
  highlightToday = false
}: DepartmentTabsProps) => {
  
  // Check if a job is happening today
  const isJobToday = (job: any) => {
    const today = new Date();
    const jobStart = new Date(job.start_time);
    const jobEnd = new Date(job.end_time);
    
    return isWithinInterval(today, {
      start: startOfDay(jobStart),
      end: endOfDay(jobEnd)
    });
  };

  return (
    <Tabs value={selectedDepartment} onValueChange={onDepartmentChange} className="mt-4">
      <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
        <TabsTrigger value="sound">Sound</TabsTrigger>
        <TabsTrigger value="lights">Lights</TabsTrigger>
        <TabsTrigger value="video">Video</TabsTrigger>
      </TabsList>

      {["sound", "lights", "video"].map((dept) => (
        <TabsContent key={dept} value={dept}>
          {jobsLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-center text-muted-foreground">No jobs found</p>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => {
                const shouldHighlight = highlightToday && isJobToday(job);
                return (
                  <div 
                    key={job.id}
                    className={`transition-all duration-300 ${
                      shouldHighlight 
                        ? 'ring-2 ring-primary ring-offset-2 shadow-lg scale-[1.02]' 
                        : ''
                    }`}
                  >
                    <JobCardNew
                      job={job}
                      onEditClick={() => {}}
                      onDeleteClick={() => {}}
                      onJobClick={() => {}}
                      department={dept as Department}
                      userRole={userRole}
                      onDeleteDocument={onDeleteDocument}
                      showUpload={true}
                      showManageArtists={true}
                      isProjectManagementPage={true}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
};
