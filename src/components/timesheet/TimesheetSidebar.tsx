import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronLeft, ChevronRight, Calendar, MapPin } from "lucide-react";
import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { useNavigate } from "react-router-dom";

interface TimesheetSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const JOBS_PER_PAGE = 5;

export const TimesheetSidebar = ({ isOpen, onClose }: TimesheetSidebarProps) => {
  const { data: allJobs = [], isLoading } = useOptimizedJobs();
  const { userRole, user } = useOptimizedAuth();
  const navigate = useNavigate();

  // Filter jobs and exclude dry hire jobs and jobs with only off/travel date types
  const relevantJobs = useMemo(() => {
    return allJobs
      .filter(job => {
        // Filter out dry hire jobs since they don't have personnel/timesheets
        const isDryHire = job.job_type === 'dry_hire' || job.job_type === 'dryhire';
        if (isDryHire) return false;
        
        // Check if job has any work date types (not just "off" or "travel")
        if (job.job_date_types && job.job_date_types.length > 0) {
          const hasWorkDates = job.job_date_types.some((dateType: any) => 
            dateType.type !== 'off' && dateType.type !== 'travel'
          );
          // Only include jobs that have at least one work date
          return hasWorkDates;
        }
        
        // If no date types are defined, assume it's a work job
        return true;
      })
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()); // Most recent first
  }, [allJobs]);

  // Find the current page based on today's date
  const getCurrentPageIndex = useMemo(() => {
    const today = new Date();
    const todayIndex = relevantJobs.findIndex(job => {
      const jobDate = new Date(job.start_time);
      return jobDate.toDateString() === today.toDateString();
    });
    
    if (todayIndex !== -1) {
      return Math.floor(todayIndex / JOBS_PER_PAGE);
    }
    
    // If no job today, find the closest upcoming job
    const upcomingIndex = relevantJobs.findIndex(job => {
      const jobDate = new Date(job.start_time);
      return jobDate >= today;
    });
    
    if (upcomingIndex !== -1) {
      return Math.floor(upcomingIndex / JOBS_PER_PAGE);
    }
    
    // Default to first page
    return 0;
  }, [relevantJobs]);

  // Initialize current page to center around today
  const [currentPage, setCurrentPage] = useState(getCurrentPageIndex);

  // Reset to current page when sidebar opens
  const resetToCurrentPage = () => {
    setCurrentPage(getCurrentPageIndex);
  };

  // Paginate jobs
  const totalPages = Math.ceil(relevantJobs.length / JOBS_PER_PAGE);
  const paginatedJobs = relevantJobs.slice(
    currentPage * JOBS_PER_PAGE,
    (currentPage + 1) * JOBS_PER_PAGE
  );

  const handleJobSelect = (jobId: string) => {
    navigate(`/timesheets?jobId=${jobId}`);
    onClose();
  };

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
    }
  };
  
  const isJobToday = (jobDate: Date) => {
    const today = new Date();
    return jobDate.toDateString() === today.toDateString();
  };

  const isJobInPast = (jobDate: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return jobDate < today;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:z-auto">
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/20 lg:hidden" 
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-96 bg-background border-l border-border shadow-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">All Jobs</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={resetToCurrentPage} title="Go to current date">
              <Calendar className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : relevantJobs.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No jobs found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedJobs.map((job) => {
                const jobDate = new Date(job.start_time);
                const isPast = isJobInPast(jobDate);
                const isToday = isJobToday(jobDate);
                
                return (
                <Card 
                  key={job.id} 
                  className={`cursor-pointer hover:shadow-md transition-shadow border border-border/50 hover:border-border ${
                    isToday ? 'ring-2 ring-primary/50 bg-primary/5' : isPast ? 'opacity-75' : ''
                  }`}
                  onClick={() => handleJobSelect(job.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-medium leading-tight">
                        {job.title}
                        {isToday && <span className="ml-2 text-xs text-primary">(Today)</span>}
                        {isPast && <span className="ml-2 text-xs text-muted-foreground">(Past)</span>}
                      </CardTitle>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ml-2 flex-shrink-0 ${getJobStatusColor(job.status)}`}
                      >
                        {job.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(job.start_time), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(new Date(job.start_time), 'HH:mm')} - {format(new Date(job.end_time), 'HH:mm')}
                        </span>
                      </div>
                      {job.venue && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{job.venue}</span>
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      size="sm" 
                      className="w-full mt-3" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJobSelect(job.id);
                      }}
                    >
                      View Timesheets
                    </Button>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
            <Button
              variant="outline"
              size="sm"
              onClick={prevPage}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={nextPage}
              disabled={currentPage === totalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};