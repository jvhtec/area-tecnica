
import jsPDF from "jspdf";
import { format, eachMonthOfInterval, eachDayOfInterval, endOfMonth } from "date-fns";
import { getDateRangeForPrint, getPDFDateTypeLabels, hexToRgb, getContrastColor } from "./CalendarUtils";
import { PrintSettings } from "./PrintSettingsDialog";

export const generateCalendarPDF = async (
  jobs: any[],
  currentDate: Date,
  range: "month" | "quarter" | "year",
  printSettings: PrintSettings,
  dateTypes: Record<string, any>
) => {
  const filteredJobs = jobs.filter((job) => {
    const jobType = job.job_type?.toLowerCase();
    return jobType && printSettings.jobTypes[jobType as keyof typeof printSettings.jobTypes] === true;
  });
  
  const doc = new jsPDF("landscape");
  const { startDate, endDate } = getDateRangeForPrint(currentDate, range);

  // Try to load the logo
  const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
  }).catch(() => null);

  const logoWidth = 50;
  const logoHeight = logo ? logoWidth * (logo.height / logo.width) : 0;
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Define standard vertical spacing values
  const logoTopY = 10;
  const monthTitleY = logo ? logoTopY + logoHeight + 5 : 20;
  const calendarStartY = monthTitleY + 10;
  
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  const cellWidth = 40;
  const cellHeight = 30;
  const startX = 10;
  const daysOfWeek = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
  const dateTypeLabels = getPDFDateTypeLabels();

  for (const [pageIndex, monthStart] of months.entries()) {
    if (pageIndex > 0) doc.addPage("landscape");

    // Add logo if available
    const logoX = logo ? (pageWidth - logoWidth) / 2 : 0;
    if (logo) {
      doc.addImage(logo, "PNG", logoX, logoTopY, logoWidth, logoHeight);
    }

    // Month title
    doc.setFontSize(16);
    doc.setTextColor(51, 51, 51);
    doc.text(format(monthStart, "MMMM yyyy"), pageWidth / 2, monthTitleY, { align: "center" });

    // Days of week header
    daysOfWeek.forEach((day, index) => {
      doc.setFillColor(41, 128, 185);
      doc.rect(startX + index * cellWidth, calendarStartY, cellWidth, 10, "F");
      doc.setTextColor(255);
      doc.setFontSize(10);
      doc.text(day, startX + index * cellWidth + 15, calendarStartY + 7);
    });

    // Draw the calendar for this month
    drawMonthCalendar(
      doc, 
      monthStart, 
      filteredJobs, 
      dateTypes, 
      dateTypeLabels, 
      startX, 
      calendarStartY + 10, 
      cellWidth, 
      cellHeight
    );
    
    // Add legend on first page
    if (pageIndex === 0) {
      const legendY = calendarStartY + 10 + 7 * cellHeight + 10;
      doc.setFontSize(8);
      doc.setTextColor(0);
      Object.entries(dateTypeLabels).forEach(([type, label], index) => {
        doc.text(`${label} = ${type}`, 10 + index * 40, legendY);
      });
    }
  }
  
  doc.save(`calendar-${range}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  return true;
};

const drawMonthCalendar = (
  doc: jsPDF,
  monthStart: Date,
  jobs: any[],
  dateTypes: Record<string, any>,
  dateTypeLabels: Record<string, string>,
  startX: number,
  startY: number,
  cellWidth: number,
  cellHeight: number
) => {
  const monthEnd = endOfMonth(monthStart);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = 1; // Monday
  
  const getDayIndex = (d: Date) => {
    return firstDayOfWeek === 1 ? (d.getDay() + 6) % 7 : d.getDay();
  };
  
  const offset = getDayIndex(monthStart);
  const offsetDays = Array.from({ length: offset }, () => null);
  const allMonthDays = [...offsetDays, ...monthDays];
  const weeks: Array<Array<Date | null>> = [];
  
  while (allMonthDays.length > 0) {
    weeks.push(allMonthDays.splice(0, 7));
  }
  
  let currentY = startY;
  
  for (const week of weeks) {
    for (const [dayIndex, day] of week.entries()) {
      const x = startX + dayIndex * cellWidth;
      doc.setDrawColor(200);
      doc.rect(x, currentY, cellWidth, cellHeight);
      
      if (!day) continue;
      
      // Draw day number
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.text(format(day, "d"), x + 2, currentY + 5);
      
      // Draw jobs for this day
      const dayJobs = getJobsForDay(jobs, day);
      let eventY = currentY + 8;
      
      for (const [index, job] of dayJobs.slice(0, 8).entries()) {
        const key = `${job.id}-${format(day, "yyyy-MM-dd")}`;
        const dateType = dateTypes[key]?.type;
        const typeLabel = dateType ? dateTypeLabels[dateType] : "";
        const baseColor = job.color || "#cccccc";
        const [r, g, b] = hexToRgb(baseColor);
        const textColor = getContrastColor(baseColor);
        
        doc.setFillColor(r, g, b);
        doc.rect(x + 1, eventY + index * 5, cellWidth - 2, 4, "F");
        
        if (typeLabel) {
          doc.setFontSize(8);
          doc.setTextColor(textColor);
          doc.text(typeLabel, x + 3, eventY + index * 5 + 3);
        }
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(textColor);
        const titleX = typeLabel ? x + 8 : x + 3;
        doc.text(job.title.substring(0, 18), titleX, eventY + index * 5 + 3);
      }
    }
    currentY += cellHeight;
  }
};

const getJobsForDay = (jobs: any[], day: Date) => {
  const compareDate = format(day, "yyyy-MM-dd");
  
  return jobs.filter(job => {
    try {
      const startDate = new Date(job.start_time);
      const endDate = new Date(job.end_time);
      const jobStartDate = format(startDate, "yyyy-MM-dd");
      const jobEndDate = format(endDate, "yyyy-MM-dd");
      const isSingleDayJob = jobStartDate === jobEndDate;
      
      return isSingleDayJob
        ? compareDate === jobStartDate
        : compareDate >= jobStartDate && compareDate <= jobEndDate;
    } catch (error) {
      console.error("Error processing job dates for PDF:", error, job);
      return false;
    }
  });
};
