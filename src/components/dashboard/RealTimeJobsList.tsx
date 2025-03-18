
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Filter, CalendarIcon } from "lucide-react";
import { useJobsRealtime } from "@/hooks/useJobsRealtime";
import { SubscriptionIndicator } from "../ui/subscription-indicator";
import { JobCardNew } from "./JobCardNew";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectionStatus } from "../ui/connection-status";

interface RealTimeJobsListProps {
  title: string;
  department?: string;
  filterByDepartment?: boolean;
  limit?: number;
  showAllButton?: boolean;
  onJobClick?: (jobId: string) => void;
  onEditClick?: (job: any) => void;
  onDeleteClick?: (jobId: string) => void;
  userRole?: string | null;
}

export function RealTimeJobsList({ 
  title, 
  department, 
  filterByDepartment = true,
  limit,
  showAllButton = false,
  onJobClick,
  onEditClick,
  onDeleteClick,
  userRole 
}: RealTimeJobsListProps) {
  const { jobs, isLoading, isRefreshing, refetch, subscriptionStatus } = useJobsRealtime();
  const [timeFilter, setTimeFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  // Filter jobs based on department if needed
  const filteredJobs = jobs.filter(job => {
    // Filter by department if specified
    if (filterByDepartment && department) {
      const jobDepartments = job.job_departments.map(d => d.department);
      if (!jobDepartments.includes(department)) {
        return false;
      }
    }

    // Filter by time
    const jobDate = new Date(job.start_time);
    const now = new Date();
    
    if (timeFilter === "upcoming") {
      return jobDate >= now;
    } else if (timeFilter === "past") {
      return jobDate < now;
    }
    
    return true;
  });

  // Sort by date
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (timeFilter === "past") {
      return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
    }
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });

  // Apply limit if specified
  const displayedJobs = limit ? sortedJobs.slice(0, limit) : sortedJobs;

  // Group jobs by month for better organization
  const groupedJobs: Record<string, any[]> = {};
  
  displayedJobs.forEach(job => {
    const date = new Date(job.start_time);
    const monthYear = format(date, 'MMMM yyyy', { locale: es });
    
    if (!groupedJobs[monthYear]) {
      groupedJobs[monthYear] = [];
    }
    
    groupedJobs[monthYear].push(job);
  });

  return (
    <>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <SubscriptionIndicator 
              tables={['jobs', 'job_assignments', 'job_departments']} 
              variant="compact"
              showRefreshButton
              onRefresh={refetch}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={isRefreshing || isLoading}
              className="gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="sr-only md:not-sr-only md:inline-block">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        
        <div className="px-6 pb-2">
          <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as "upcoming" | "past" | "all")}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upcoming" className="text-xs">Upcoming</TabsTrigger>
              <TabsTrigger value="all" className="text-xs">All Jobs</TabsTrigger>
              <TabsTrigger value="past" className="text-xs">Past Jobs</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
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
          ) : displayedJobs.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">
              <p>No jobs found for the selected criteria.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedJobs).map(([monthYear, monthJobs]) => (
                <div key={monthYear} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 capitalize">
                    <CalendarIcon className="h-4 w-4" />
                    {monthYear}
                  </h3>
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
              
              {limit && filteredJobs.length > limit && showAllButton && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" size="sm">View All Jobs</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <ConnectionStatus />
    </>
  );
}
