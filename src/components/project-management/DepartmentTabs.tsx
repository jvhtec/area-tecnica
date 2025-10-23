
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobCardNew } from "@/components/jobs/cards/JobCardNew";
import { Department } from "@/types/department";
import { Loader2 } from "lucide-react";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useVirtualizedList } from "@/hooks/useVirtualizedList";
import { MobileJobCard } from "./MobileJobCard";
import { useMemo } from "react";

interface DepartmentTabsProps {
  selectedDepartment: Department;
  onDepartmentChange: (value: string) => void;
  jobs: any[];
  jobsLoading: boolean;
  onDeleteDocument?: (jobId: string, document: any) => void;
  userRole?: string | null;
  highlightToday?: boolean;
}

const MOBILE_ITEM_HEIGHT = 210;

export const DepartmentTabs = ({
  selectedDepartment,
  onDepartmentChange,
  jobs,
  jobsLoading,
  onDeleteDocument,
  userRole,
  highlightToday = false
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

  const shouldVirtualize = isMobile && jobs.length > 12;

  const { containerRef, handleScroll, visibleRange, totalHeight } = useVirtualizedList({
    itemCount: jobs.length,
    itemHeight: MOBILE_ITEM_HEIGHT,
    overscan: 6,
  });

  const virtualizedJobs = useMemo(() => {
    if (!shouldVirtualize) return jobs;
    const start = visibleRange.start;
    const end = Math.min(jobs.length, visibleRange.end + 1);
    return jobs.slice(start, end).map((job, idx) => ({ job, index: start + idx }));
  }, [jobs, shouldVirtualize, visibleRange]);

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
            <p className="text-center text-muted-foreground py-6">No jobs found</p>
          ) : isMobile ? (
            <div
              ref={shouldVirtualize ? containerRef : undefined}
              onScroll={shouldVirtualize ? handleScroll : undefined}
              className="space-y-3 overflow-y-auto max-h-[70vh] pr-1"
            >
              {shouldVirtualize ? (
                <div style={{ height: totalHeight, position: 'relative' }}>
                  {virtualizedJobs.map(({ job, index }) => {
                    const shouldHighlight = highlightToday && isJobToday(job);
                    return (
                      <div
                        key={job.id}
                        style={{
                          position: 'absolute',
                          top: index * MOBILE_ITEM_HEIGHT,
                          left: 0,
                          right: 0,
                        }}
                      >
                        <MobileJobCard
                          job={job}
                          isHighlighted={shouldHighlight}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                jobs.map((job) => {
                  const shouldHighlight = highlightToday && isJobToday(job);
                  return (
                    <MobileJobCard
                      key={job.id}
                      job={job}
                      isHighlighted={shouldHighlight}
                    />
                  );
                })
              )}
            </div>
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
