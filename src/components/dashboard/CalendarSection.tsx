
import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, isWithinInterval, isToday, isEqual } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { DateTypeContextMenu } from "./DateTypeContextMenu";

export interface CalendarSectionProps {
  date: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  jobs?: any[];
  department?: string;
  onDateTypeChange: () => void;
}

export const CalendarSection = ({
  date,
  onDateSelect,
  jobs = [],
  department = "",
  onDateTypeChange,
}: CalendarSectionProps) => {
  const [jobsByDay, setJobsByDay] = useState<Record<string, any[]>>({});
  
  // Get job date types for current jobs
  const { data: dateTypes = {} } = useQuery({
    queryKey: ["job-date-types", jobs?.map(job => job.id).join("-")],
    queryFn: async () => {
      if (!jobs || jobs.length === 0) return {};
      
      const jobIds = jobs.map(job => job.id);
      
      const { data, error } = await supabase
        .from("job_date_types")
        .select("*")
        .in("job_id", jobIds);
      
      if (error) {
        console.error("Error fetching job date types:", error);
        return {};
      }
      
      // Create a lookup table with composite keys for faster access
      const dateTypesMap: Record<string, any> = {};
      
      data.forEach(dateType => {
        const key = `${dateType.job_id}-${dateType.date}`;
        dateTypesMap[key] = dateType;
      });
      
      return dateTypesMap;
    },
    enabled: jobs && jobs.length > 0,
  });
  
  useEffect(() => {
    if (!jobs || jobs.length === 0) {
      setJobsByDay({});
      return;
    }
    
    // Group jobs by date
    const jobMap: Record<string, any[]> = {};
    
    jobs.forEach(job => {
      if (!job.start_time) return;
      
      const startDate = new Date(job.start_time);
      const endDate = new Date(job.end_time);
      
      // For each day in the job's range
      let currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateKey = format(currentDate, "yyyy-MM-dd");
        
        if (!jobMap[dateKey]) {
          jobMap[dateKey] = [];
        }
        
        // Only filter by department if specified
        if (!department || 
            job.job_departments?.some((dept: any) => dept.department === department)) {
          jobMap[dateKey].push(job);
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    setJobsByDay(jobMap);
  }, [jobs, department]);
  
  const renderCalendarCell = (day: Date, jobsByDay: Record<string, any[]>) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const jobsForDay = jobsByDay[dateKey] || [];
    
    return (
      <div className="relative h-full w-full p-2">
        <time
          dateTime={format(day, "yyyy-MM-dd")}
          className={`${isToday(day) ? "font-bold" : ""}`}
        >
          {format(day, "d")}
        </time>
        
        {jobsForDay.length > 0 && (
          <div className="absolute bottom-1 right-1">
            <div className="flex -space-x-1">
              {jobsForDay.slice(0, 3).map((job, index) => {
                const dateTypeKey = `${job.id}-${dateKey}`;
                const dateType = dateTypes[dateTypeKey]?.type;
                
                // Only show dot for the first job if there's a date type
                if (index === 0 && dateType) {
                  return (
                    <DateTypeContextMenu 
                      key={`${job.id}-${index}`}
                      jobId={job.id} 
                      date={day}
                      onTypeChange={onDateTypeChange}
                    >
                      <div 
                        className="h-2 w-2 rounded-full border"
                        style={{ 
                          backgroundColor: getDateTypeColor(dateType),
                          borderColor: getDateTypeColor(dateType) 
                        }}
                      />
                    </DateTypeContextMenu>
                  );
                }
                
                return (
                  <div 
                    key={`${job.id}-${index}`}
                    className="h-2 w-2 rounded-full border border-background"
                    style={{ backgroundColor: job.color || "#7E69AB" }}
                  />
                );
              })}
              
              {jobsForDay.length > 3 && (
                <div className="flex h-2 w-2 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
                  +{jobsForDay.length - 3}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <Card>
      <CardContent className="p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateSelect}
          initialFocus
          components={{
            Day: ({ date: day }) => renderCalendarCell(day, jobsByDay)
          }}
        />
      </CardContent>
    </Card>
  );
};

const getDateTypeColor = (type: string): string => {
  switch (type) {
    case "travel":
      return "#3b82f6"; // blue-500
    case "setup":
      return "#eab308"; // yellow-500
    case "show":
      return "#22c55e"; // green-500
    case "off":
      return "#6b7280"; // gray-500
    case "rehearsal":
      return "#8b5cf6"; // violet-500
    default:
      return "#7E69AB"; // default color
  }
};
