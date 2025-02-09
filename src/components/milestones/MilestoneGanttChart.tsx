import { format, isAfter, isBefore, addDays, differenceInDays, isToday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Department } from "@/types/department";
import { useEffect, useRef, useState } from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Check, Star, Plane, Wrench, Moon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface Milestone {
  id: string;
  name: string;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
  completed_by: { first_name: string; last_name: string } | null;
  definition: {
    category: string;
    department: string[] | null;
    priority: number;
  } | null;
}

interface DateType {
  date: string;
  type: 'travel' | 'setup' | 'show' | 'off';
}

interface MilestoneGanttChartProps {
  milestones: Milestone[];
  startDate: Date;
  jobId: string;
}

export function MilestoneGanttChart({ milestones, startDate, jobId }: MilestoneGanttChartProps) {
  console.log("MilestoneGanttChart props:", { milestones, startDate, jobId });
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [dateTypes, setDateTypes] = useState<DateType[]>([]);
  
  const lastMilestoneDate = milestones.reduce((latest, milestone) => {
    const date = new Date(milestone.due_date);
    return date > latest ? date : latest;
  }, startDate);

  const endDate = addDays(lastMilestoneDate, 14);
  const totalDays = differenceInDays(endDate, startDate);
  const totalWidth = Math.max(1200, (totalDays + 1) * 96);

  const departments: Department[] = ["sound", "lights", "video", "production", "logistics", "administrative"];

  useEffect(() => {
    const fetchDateTypes = async () => {
      const { data, error } = await supabase
        .from('job_date_types')
        .select('*')
        .eq('job_id', jobId)
        .order('date');

      if (error) {
        console.error('Error fetching date types:', error);
        return;
      }

      setDateTypes(data);
    };

    fetchDateTypes();
  }, [jobId]);

  const getDateTypeIcon = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dateType = dateTypes.find(dt => dt.date === dateStr);

    switch (dateType?.type) {
      case 'travel':
        return <Plane className="h-3 w-3 text-blue-500" />;
      case 'setup':
        return <Wrench className="h-3 w-3 text-yellow-500" />;
      case 'show':
        return <Star className="h-3 w-3 text-green-500" />;
      case 'off':
        return <Moon className="h-3 w-3 text-gray-500" />;
      default:
        return null;
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 3:
        return 'bg-red-500 hover:bg-red-600';
      case 2:
        return 'bg-orange-500 hover:bg-orange-600';
      case 1:
      default:
        return 'bg-purple-500 hover:bg-purple-600';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'planning': return 'border-blue-500';
      case 'technical': return 'border-purple-500';
      case 'logistics': return 'border-orange-500';
      case 'administrative': return 'border-gray-500';
      case 'production': return 'border-green-500';
      default: return 'border-slate-500';
    }
  };

  const getDepartmentBadgeColor = (department: string | null) => {
    switch (department) {
      case 'sound': return 'bg-blue-100 text-blue-800';
      case 'lights': return 'bg-yellow-100 text-yellow-800';
      case 'video': return 'bg-purple-100 text-purple-800';
      case 'production': return 'bg-green-100 text-green-800';
      case 'logistics': return 'bg-orange-100 text-orange-800';
      case 'administrative': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMilestonesByDepartment = (department: Department) => {
    console.log("Filtering milestones for department:", department);
    return milestones.filter(milestone => {
      const deptArray = milestone.definition?.department;
      console.log("Milestone definition departments:", deptArray);
      
      if (!deptArray || deptArray.length === 0) {
        console.log("No department specified, showing in all");
        return true;
      }
      
      const belongs = deptArray.includes(department);
      console.log("Belongs to department:", belongs);
      return belongs;
    });
  };

  const handleCompleteMilestone = async (milestoneId: string) => {
    try {
      const { error } = await supabase
        .from('job_milestones')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', milestoneId);

      if (error) throw error;

      toast({
        title: "Milestone completed",
        description: "The milestone has been marked as completed.",
      });
    } catch (error) {
      console.error('Error completing milestone:', error);
      toast({
        title: "Error",
        description: "Failed to complete the milestone. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (scrollContainerRef.current) {
      const today = new Date();
      const daysFromStart = differenceInDays(today, startDate);
      const scrollPosition = daysFromStart * 96;
      scrollContainerRef.current.scrollLeft = Math.max(0, scrollPosition - 300);
    }
  }, [startDate]);

  return (
    <ScrollArea className="w-full border rounded-lg" ref={scrollContainerRef}>
      <div style={{ width: `${totalWidth}px`, minWidth: '100%' }} className="relative">
        <div className="flex border-b sticky top-0 bg-background z-20">
          <div className="w-48 shrink-0 p-2 font-medium border-r sticky left-0 bg-background z-30">Department</div>
          <div className="flex-1 flex">
            {Array.from({ length: totalDays + 1 }).map((_, index) => {
              const date = addDays(startDate, index);
              return (
                <div 
                  key={index} 
                  className="w-24 shrink-0 text-center text-xs p-2 border-r last:border-r-0"
                >
                  <div className="font-medium">{format(date, 'd')}</div>
                  <div className="text-muted-foreground">{format(date, 'MMM')}</div>
                  <div className="mt-1">
                    {getDateTypeIcon(date)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          {departments.map((department) => {
            const departmentMilestones = getMilestonesByDepartment(department);
            console.log(`${department} milestones:`, departmentMilestones);

            return (
              <div key={department} className="border-b last:border-b-0">
                <div className="flex">
                  <div className="w-48 shrink-0 p-4 border-r sticky left-0 bg-background z-10">
                    <Badge 
                      variant="secondary"
                      className={cn(
                        "text-xs capitalize",
                        getDepartmentBadgeColor(department)
                      )}
                    >
                      {department}
                    </Badge>
                  </div>
                  <div className="flex-1 relative min-h-[100px]">
                    {departmentMilestones.map((milestone) => {
                      const dueDate = new Date(milestone.due_date);
                      const dayOffset = differenceInDays(dueDate, startDate);
                      const position = (dayOffset * 96) + 48;
                      const priority = milestone.definition?.priority || 1;

                      return (
                        <ContextMenu key={milestone.id}>
                          <ContextMenuTrigger>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    className={cn(
                                      "absolute top-1/2 -translate-y-1/2",
                                      "transition-all duration-300",
                                      milestone.completed ? [
                                        "w-4 h-4 border-2 border-dashed animate-pulse opacity-50",
                                        getCategoryColor(milestone.definition?.category || '')
                                      ] : [
                                        "w-6 h-6 cursor-pointer hover:scale-110",
                                        getPriorityColor(priority)
                                      ],
                                      "rounded-full"
                                    )}
                                    style={{ left: `${position}px` }}
                                  >
                                    {milestone.completed && (
                                      <Check 
                                        className={cn(
                                          "h-2 w-2 text-foreground absolute inset-0 m-auto",
                                          "animate-in zoom-in duration-300"
                                        )}
                                      />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-2">
                                    <div className="font-medium">{milestone.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      Due: {format(dueDate, 'MMM d, yyyy')}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Priority: {priority === 3 ? 'High' : priority === 2 ? 'Medium' : 'Low'}
                                    </div>
                                    {milestone.completed && milestone.completed_by && (
                                      <div className="text-xs text-muted-foreground">
                                        Completed by: {milestone.completed_by.first_name} {milestone.completed_by.last_name}
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              onClick={() => handleCompleteMilestone(milestone.id)}
                              disabled={milestone.completed}
                            >
                              Mark as Complete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}