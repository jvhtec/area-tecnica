
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Edit, Trash, ExternalLink, MoreVertical, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { colorToClassName } from "@/lib/utils";

interface TodayScheduleProps {
  jobs: any[];
  onEditClick?: (job: any) => void;
  onDeleteClick?: (jobId: string) => void;
  onJobClick?: (jobId: string) => void;
  onTaskChange?: (taskId: string, checked: boolean) => void;
  userRole?: string;
  isLoading?: boolean;
  hideTasks?: boolean;
  onAddWorkHours?: (jobId: string, jobTitle: string, jobDate: Date) => void;
  selectedDate?: Date; // Added this prop
}

export function TodaySchedule({
  jobs = [],
  onEditClick,
  onDeleteClick,
  onJobClick,
  onTaskChange,
  userRole = "admin",
  isLoading = false,
  hideTasks = false,
  onAddWorkHours,
  selectedDate
}: TodayScheduleProps) {
  const [groupedJobs, setGroupedJobs] = useState<any>({});
  const [sortedDates, setSortedDates] = useState<string[]>([]);

  useEffect(() => {
    const groups: Record<string, any[]> = {};
    
    jobs.forEach((job) => {
      if (!job.jobs) return;
      
      const jobData = job.jobs;
      const jobDate = jobData.start_time ? new Date(jobData.start_time) : new Date();
      const dateStr = format(jobDate, 'yyyy-MM-dd');

      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      
      groups[dateStr].push({
        ...job,
        formattedDate: format(jobDate, 'EEEE, MMMM d, yyyy'),
      });
    });
    
    // Sort the dates
    const dates = Object.keys(groups).sort();
    
    setGroupedJobs(groups);
    setSortedDates(dates);
  }, [jobs]);

  const isEditable = userRole === "admin" || userRole === "management";
  const canRecordHours = userRole === "technician";

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted rounded-md p-4 h-24" />
        ))}
      </div>
    );
  }

  if (sortedDates.length === 0 || jobs.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No upcoming jobs scheduled.</div>;
  }

  const getCardBgColor = (job: any) => {
    if (!job.jobs || !job.jobs.color) return "";
    
    const colorClass = colorToClassName(job.jobs.color);
    return colorClass ? `${colorClass} bg-opacity-5` : "";
  };

  return (
    <div className="space-y-8">
      {sortedDates.map((dateStr) => (
        <div key={dateStr} className="space-y-4">
          <h3 className="font-medium text-lg">{groupedJobs[dateStr][0].formattedDate}</h3>
          
          <div className="space-y-4">
            {groupedJobs[dateStr].map((job: any) => (
              <Card key={job.id} className={`${getCardBgColor(job)} hover:shadow-md transition-shadow`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 
                          className="font-semibold text-base hover:underline cursor-pointer" 
                          onClick={() => onJobClick && onJobClick(job.job_id)}
                        >
                          {job.jobs.title}
                        </h4>
                        
                        <div className="flex items-center gap-2">
                          {canRecordHours && onAddWorkHours && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-2"
                              onClick={() => onAddWorkHours(
                                job.job_id, 
                                job.jobs.title,
                                new Date(job.jobs.start_time)
                              )}
                            >
                              <Clock className="h-4 w-4" />
                              Record Hours
                            </Button>
                          )}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {isEditable && (
                                <>
                                  <DropdownMenuItem onClick={() => onEditClick && onEditClick(job)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onDeleteClick && onDeleteClick(job.job_id)}>
                                    <Trash className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem onClick={() => onJobClick && onJobClick(job.job_id)}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open Job
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      <div className="flex items-center text-sm text-muted-foreground gap-6">
                        <div>
                          {job.jobs.start_time && (
                            <span>
                              {format(new Date(job.jobs.start_time), 'h:mm a')} - {format(new Date(job.jobs.end_time), 'h:mm a')}
                            </span>
                          )}
                        </div>
                        {job.jobs.location && (
                          <div>{job.jobs.location.name}</div>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">{job.department}</Badge>
                        <Badge variant="outline">{job.role}</Badge>
                        {job.jobs.status && (
                          <Badge variant="outline">{job.jobs.status}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {!hideTasks && job.jobs.tasks && job.jobs.tasks.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-2">
                        <h5 className="font-medium text-sm">Tasks</h5>
                        <div className="space-y-2">
                          {job.jobs.tasks.map((task: any) => (
                            <div key={task.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={task.id} 
                                checked={task.completed} 
                                onCheckedChange={(checked) => 
                                  onTaskChange && onTaskChange(task.id, !!checked)
                                }
                              />
                              <label 
                                htmlFor={task.id} 
                                className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                              >
                                {task.title}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
