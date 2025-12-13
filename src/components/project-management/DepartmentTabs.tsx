
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobCardNew } from "@/components/jobs/cards/JobCardNew";
import { Department } from "@/types/department";
import { Loader2 } from "lucide-react";
import { isToday, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface DepartmentTabsProps {
  selectedDepartment: Department;
  onDepartmentChange: (value: string) => void;
  jobs: any[];
  jobsLoading: boolean;
  onDeleteDocument?: (jobId: string, document: any) => void;
  userRole?: string | null;
  highlightToday?: boolean;
  openHojaDeRutaJobId?: string | null;
  onHojaDeRutaOpened?: () => void;
}

export const DepartmentTabs = ({
  selectedDepartment,
  onDepartmentChange,
  jobs,
  jobsLoading,
  onDeleteDocument,
  userRole,
  highlightToday = false,
  openHojaDeRutaJobId,
  onHojaDeRutaOpened
}: DepartmentTabsProps) => {
  const isMobile = useIsMobile();
  
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
    <Tabs value={selectedDepartment} onValueChange={onDepartmentChange} className={cn(isMobile ? "mt-3" : "mt-4")}>
      <TabsList className={cn(
        isMobile
          ? "w-full grid grid-cols-4"
          : "grid w-full grid-cols-4 lg:w-[500px]"
      )}>
        <TabsTrigger value="sound" className={cn(isMobile && "text-xs sm:text-sm")}>Sonido</TabsTrigger>
        <TabsTrigger value="lights" className={cn(isMobile && "text-xs sm:text-sm")}>Luces</TabsTrigger>
        <TabsTrigger value="video" className={cn(isMobile && "text-xs sm:text-sm")}>Video</TabsTrigger>
        <TabsTrigger value="production" className={cn(isMobile && "text-xs sm:text-sm")}>Producción</TabsTrigger>
      </TabsList>

      {["sound", "lights", "video", "production"].map((dept) => (
        <TabsContent key={dept} value={dept} className={cn(isMobile && "mt-3")}>
          {jobsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No jobs found</p>
          ) : (
            <div className={cn("space-y-4", isMobile && "space-y-3")}>
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
                      openHojaDeRuta={openHojaDeRutaJobId === job.id}
                      onHojaDeRutaOpened={onHojaDeRutaOpened}
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
