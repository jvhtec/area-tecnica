
import { useState } from "react";
import { format, isWithinInterval, parseISO } from 'date-fns';
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateTypeContextMenu } from "@/components/dashboard/DateTypeContextMenu";

interface CalendarSectionProps {
  date: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  jobs?: any[];
  department: string;
  onDateTypeChange: () => void;
}

const getJobTypeClass = (jobType: string) => {
  switch (jobType) {
    case 'tour':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100';
    case 'tourdate':
      return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
    case 'festival':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-100';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
  }
};

export function CalendarSection({
  date,
  onDateSelect,
  jobs = [],
  department,
  onDateTypeChange
}: CalendarSectionProps) {
  const [open, setOpen] = useState(false);

  const handleJobClick = (jobId: string) => {
    console.log("Job clicked:", jobId);
  };

  const renderContent = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const jobsForDate = jobs.filter(job => {
      const startDate = format(new Date(job.start_time), 'yyyy-MM-dd');
      const endDate = format(new Date(job.end_time), 'yyyy-MM-dd');
      
      // If it's a single day event
      if (startDate === endDate) {
        return startDate === dateStr;
      }
      
      // Multi-day event
      return isWithinInterval(date, {
        start: parseISO(startDate),
        end: parseISO(endDate)
      });
    });

    return (
      <div className="h-full min-h-10 p-1">
        {jobsForDate.map(job => (
          <DateTypeContextMenu 
            key={job.id} 
            jobId={job.id} 
            date={dateStr}
            jobType={job.job_type}
            jobStatus={job.status}
            department={department}
          >
            <div
              className={cn(
                "text-xs mb-1 px-1 py-0.5 rounded truncate cursor-pointer",
                "border-l-2",
                getJobTypeClass(job.job_type),
                job.color ? `border-l-[${job.color}]` : "border-l-purple-500",
                job.status === "Cancelado" && "line-through opacity-50"
              )}
              style={{
                borderLeftColor: job.color || '#7E69AB'
              }}
              onClick={() => handleJobClick(job.id)}
            >
              {job.title}
            </div>
          </DateTypeContextMenu>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateSelect}
            initialFocus
            components={{
              Day: (props) => (
                <div>
                  {props.children}
                  {renderContent(props.date)}
                </div>
              )
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
