
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { usePaginatedJobs } from "@/hooks/usePaginatedJobs";
import { JobCardNew } from "./JobCardNew";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

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
    isRefetching
  } = usePaginatedJobs();

  const [filteredJobs, setFilteredJobs] = useState<any[]>([]);

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

  return (
    <Card className="w-full">
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl">{title}</CardTitle>
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
            {Object.entries(groupedJobs).map(([monthYear, monthJobs]) => (
              <div key={monthYear} className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{monthYear}</h3>
                <div className="space-y-3">
                  {monthJobs.map(job => (
                    <JobCardNew 
                      key={job.id}
                      job={job}
                      onJobClick={() => onJobClick && onJobClick(job.id)}
                      onEditClick={onEditClick ? () => onEditClick(job) : undefined}
                      onDeleteClick={onDeleteClick ? () => onDeleteClick(job.id) : undefined}
                      userRole={userRole}
                    />
                  ))}
                </div>
              </div>
            ))}
            
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
    </Card>
  );
}
