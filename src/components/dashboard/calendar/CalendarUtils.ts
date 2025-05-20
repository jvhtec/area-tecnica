
import { parseISO, format, startOfMonth, endOfMonth, eachDayOfInterval, startOfQuarter, endOfQuarter, startOfYear, endOfYear, eachMonthOfInterval } from "date-fns";

export const getJobsForDate = (jobs: any[], date: Date, department?: string, selectedJobTypes: string[] = []) => {
  if (!jobs) return [];
  
  return jobs.filter((job) => {
    try {
      const startDate = job.start_time ? parseISO(job.start_time) : null;
      const endDate = job.end_time ? parseISO(job.end_time) : null;
      
      if (!startDate || !endDate) {
        console.warn("Invalid date found for job:", job);
        return false;
      }
      
      const compareDate = format(date, "yyyy-MM-dd");
      const jobStartDate = format(startDate, "yyyy-MM-dd");
      const jobEndDate = format(endDate, "yyyy-MM-dd");
      const isSingleDayJob = jobStartDate === jobEndDate;
      
      const isWithinDuration = isSingleDayJob
        ? compareDate === jobStartDate
        : compareDate >= jobStartDate && compareDate <= jobEndDate;
        
      const matchesDepartment = department
        ? isWithinDuration && job.job_departments.some((d: any) => d.department === department)
        : isWithinDuration;
        
      const matchesJobType = selectedJobTypes.length === 0 || selectedJobTypes.includes(job.job_type);
      
      return matchesDepartment && matchesJobType;
    } catch (error) {
      console.error("Error processing job dates:", error, job);
      return false;
    }
  });
};

export const hexToRgb = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

export const getContrastColor = (hex: string): string => {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
};

export const getCalendarDays = (currentMonth: Date) => {
  const firstDayOfMonth = startOfMonth(currentMonth);
  const lastDayOfMonth = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
  const startDay = firstDayOfMonth.getDay();
  const paddingDays = startDay === 0 ? 6 : startDay - 1;
  const prefixDays = Array.from({ length: paddingDays }).map((_, i) => {
    const day = new Date(firstDayOfMonth);
    day.setDate(day.getDate() - (paddingDays - i));
    return day;
  });
  const totalDaysNeeded = 42;
  const suffixDays = Array.from({ length: totalDaysNeeded - (prefixDays.length + daysInMonth.length) }).map((_, i) => {
    const day = new Date(lastDayOfMonth);
    day.setDate(day.getDate() + (i + 1));
    return day;
  });
  
  return {
    daysInMonth,
    prefixDays,
    suffixDays,
    allDays: [...prefixDays, ...daysInMonth, ...suffixDays]
  };
};

export const getDateRangeForPrint = (currentDate: Date, range: "month" | "quarter" | "year") => {
  switch (range) {
    case "month":
      return {
        startDate: startOfMonth(currentDate),
        endDate: endOfMonth(currentDate)
      };
    case "quarter":
      const quarterStart = startOfQuarter(currentDate);
      return {
        startDate: quarterStart,
        endDate: endOfQuarter(quarterStart)
      };
    case "year":
      return {
        startDate: startOfYear(currentDate),
        endDate: endOfYear(currentDate)
      };
    default:
      return {
        startDate: startOfMonth(currentDate),
        endDate: endOfMonth(currentDate)
      };
  }
};

export const getPDFDateTypeLabels = (): Record<string, string> => {
  return {
    travel: "V",
    setup: "M",
    show: "S",
    off: "O",
    rehearsal: "E",
  };
};
