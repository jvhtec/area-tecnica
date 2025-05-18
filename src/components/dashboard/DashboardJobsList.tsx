
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { usePaginatedJobs } from "@/hooks/usePaginatedJobs";
import { JobCardNew } from "./JobCardNew";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isToday, isSameMonth, isAfter } from "date-fns";
import { usePersistentState } from "@/hooks/usePersistentState";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";

interface DashboardJobsListProps {
  onJobClick?: (jobId: string) => void;
  onEditClick?: (job: any) => void;
  onDeleteClick?: (jobId: string) => void;
  userRole?: string | null;
  showHeader?: boolean;
  title?: string;
  limit?: number;
  department?: string;
}

export function DashboardJobsList({
  onJobClick,
  onEditClick,
  onDeleteClick,
  userRole,
  showHeader = true,
  title = "Jobs",
  department
}: DashboardJobsListProps) {
  const {
    jobs,
    isLoading,
    error,
    page,
    totalPages,
    goToNextPage,
    goToPreviousPage,
    refetch,
    isRefetching,
    goToPage
  } = usePaginatedJobs();

  const [filteredJobs, setFilteredJobs] = useState<any[]>([]);
  
  // Use our custom hook to persist the expanded state to localStorage
  const [isExpanded, setIsExpanded] = usePersistentState<boolean>("dashboard_jobs_expanded", true);
  
  // Create refs for each month section to enable scrolling
  const monthSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Apply department filtering if needed
  useEffect(() => {
    if (department) {
      const filtered = jobs.filter(job => 
        job?.job_departments?.some((dept: any) => dept.department === department)
      );
      setFilteredJobs(filtered);
    } else {
      setFilteredJobs(jobs);
    }
  }, [jobs, department]);

  // Group jobs by month/year for better organization
  const groupedJobs = filteredJobs.reduce((groups: Record<string, any[]>, job) => {
    const date = parseISO(job.start_time);
    const monthYear = format(date, 'MMMM yyyy');
    
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    
    groups[monthYear].push(job);
    return groups;
  }, {});

  // Scroll to today's date section or next upcoming date section
  useEffect(() => {
    if (!isLoading && filteredJobs.length > 0 && isExpanded) {
      // Find the section for today or next upcoming date
      const today = new Date();
      const currentMonth = format(today, 'MMMM yyyy');
      
      // First try to find today's month
      if (monthSectionRefs.current[currentMonth]) {
        monthSectionRefs.current[currentMonth]?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
        return;
      }
      
      // If not found, look for the next upcoming month
      const sortedMonths = Object.keys(monthSectionRefs.current)
        .filter(monthYear => {
          const monthDate = new Date(monthYear);
          return isAfter(monthDate, today) || isSameMonth(monthDate, today);
        })
        .sort();
      
      if (sortedMonths.length > 0) {
        monthSectionRefs.current[sortedMonths[0]]?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }
  }, [isLoading, filteredJobs, isExpanded]);

  return (
    <Card className="w-full">
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl flex items-center gap-2">
            {title}
            <CollapsibleTrigger 
              asChild
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? "Collapse jobs list" : "Expand jobs list"}
            >
              <Button variant="ghost" size="sm" className="p-1 h-auto">
                {isExpanded ? 
                  <ChevronUp className="h-4 w-4" /> : 
                  <ChevronDown className="h-4 w-4" />
                }
              </Button>
            </CollapsibleTrigger>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isRefetching ? "animate-spin" : ""}`} />
              <span className="sr-only md:not-sr-only md:inline-block">Refresh</span>
            </Button>
          </div>
        </CardHeader>
      )}
      
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center p-6 text-destructive">
                <p>Error loading jobs. Please try refreshing the page.</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center p-6 text-muted-foreground">
                <p>No jobs found.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedJobs).map(([monthYear, monthJobs]) => {
                  // Check if any job in this month is for today
                  const hasJobToday = Array.isArray(monthJobs) && monthJobs.some(job => {
                    const jobDate = parseISO(job.start_time);
                    return isToday(jobDate);
                  });
                  
                  return (
                    <div 
                      key={monthYear} 
                      className={`space-y-2 ${hasJobToday ? "ring-1 ring-primary p-2 rounded-md" : ""}`}
                      ref={el => monthSectionRefs.current[monthYear] = el}
                    >
                      <h3 className={`text-sm font-medium ${hasJobToday ? "text-primary" : "text-muted-foreground"}`}>
                        {monthYear} {hasJobToday && <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full ml-2">Today</span>}
                      </h3>
                      <div className="space-y-3">
                        {Array.isArray(monthJobs) && monthJobs.map(job => {
                          const isJobToday = isToday(parseISO(job.start_time));
                          return (
                            <JobCardNew 
                              key={job.id}
                              job={job}
                              onJobClick={() => onJobClick && onJobClick(job.id)}
                              onEditClick={onEditClick ? () => onEditClick(job) : undefined}
                              onDeleteClick={onDeleteClick ? () => onDeleteClick(job.id) : undefined}
                              userRole={userRole}
                              className={isJobToday ? "border-primary bg-primary/5" : ""}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={goToPreviousPage} 
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={goToNextPage} 
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
