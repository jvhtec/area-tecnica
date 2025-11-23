
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Filter, CalendarIcon } from "lucide-react";
import { useJobsRealtime } from "@/hooks/useJobsRealtime";
import { SubscriptionIndicator } from "../ui/subscription-indicator";
import { JobCardNew } from "./JobCardNew";
import { useMemo, useState } from "react";
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
  const { jobs, isLoading, isRefreshing, refetch, realtimeStatus } = useJobsRealtime();
  const [timeFilter, setTimeFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  const { jobs: displayedJobs, total: totalMatchingJobs } = useMemo(() => {
    const filtered = jobs.filter(job => {
      if (filterByDepartment && department) {
        const jobDepartments = job.job_departments.map(d => d.department);
        if (!jobDepartments.includes(department)) {
          return false;
        }
      }

      const jobDate = new Date(job.start_time);
      const now = new Date();

      if (timeFilter === "upcoming") {
        return jobDate >= now;
      } else if (timeFilter === "past") {
        return jobDate < now;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (timeFilter === "past") {
        return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
      }
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });

    const totalMatching = sorted.length;
    const limited = limit ? sorted.slice(0, limit) : sorted;

    return { jobs: limited, total: totalMatching };
  }, [jobs, filterByDepartment, department, timeFilter, limit]);

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

  // Handle button click event
  const handleRefreshClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    refetch();
  };

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
              onClick={handleRefreshClick}
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
              
              {limit && totalMatchingJobs > limit && showAllButton && (
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
