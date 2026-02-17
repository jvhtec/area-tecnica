import React, { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDayCalendar } from "./MobileDayCalendar";
import { CalendarHeader } from "./calendar-section/CalendarHeader";
import { CalendarFilters } from "./calendar-section/CalendarFilters";
import { CalendarGrid } from "./calendar-section/CalendarGrid";
import { CalendarJobCard } from "./calendar-section/CalendarJobCard";
import { PrintDialog } from "./calendar-section/PrintDialog";
import type { CalendarExportRange, PrintSettings } from "./calendar-section/types";
import { supabase } from "@/lib/supabase";
import { loadJsPDF } from "@/utils/pdf/lazyPdf";
import { loadExceljs } from "@/utils/lazyExceljs";
import { saveWorkbook, toArgb, tintColor, thinBorder, hexToRgb, getContrastHexColor } from "@/utils/excelExport";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  parseISO,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useOptimizedDateTypes } from "@/hooks/useOptimizedDateTypes";
import { useToast } from "@/hooks/use-toast";
import { isJobOnDate } from "@/utils/timezoneUtils";

interface CalendarSectionProps {
  date: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  jobs?: any[];
  department?: string;
  onDateTypeChange?: () => void;
}

export const CalendarSection: React.FC<CalendarSectionProps> = ({
  date = new Date(),
  onDateSelect,
  jobs = [],
  department,
  onDateTypeChange = () => {},
}) => {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedJobStatuses, setSelectedJobStatuses] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    range: "month",
    jobTypes: {
      tourdate: true,
      tour: true,
      single: true,
      dryhire: true,
      festival: true,
    },
  });
  const { toast } = useToast();

  const currentMonth = date || new Date();
  const currentMonthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;

  const allDays = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentMonth);
    const lastDayOfMonth = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
    const startDay = firstDayOfMonth.getDay();

    // Adjust startDay for Monday as first day (0=Sunday, 1=Monday -> 0=Monday, 6=Sunday)
    const paddingDays = startDay === 0 ? 6 : startDay - 1;
    const prefixDays = Array.from({ length: paddingDays }).map((_, i) => {
      const day = new Date(firstDayOfMonth);
      day.setDate(day.getDate() - (paddingDays - i));
      return day;
    });
    const totalDaysNeeded = 42; // Ensures 6 full weeks
    const suffixDays = Array.from({ length: totalDaysNeeded - (prefixDays.length + daysInMonth.length) }).map((_, i) => {
      const day = new Date(lastDayOfMonth);
      day.setDate(day.getDate() + (i + 1));
      return day;
    });

    return [...prefixDays, ...daysInMonth, ...suffixDays];
  }, [currentMonthKey]);
  const distinctJobTypes = jobs ? Array.from(new Set(jobs.map((job) => job.job_type).filter(Boolean))) : [];
  const distinctJobStatuses = jobs ? Array.from(new Set(jobs.map((job) => job.status).filter(Boolean))) : [];

  // Load user preferences
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("selected_job_types, selected_job_statuses")
          .eq("id", session.user.id)
          .single();
        if (error) {
          console.error("Error loading user preferences:", error);
          return;
        }
        if (profile?.selected_job_types) {
          setSelectedJobTypes(profile.selected_job_types);
        }
        if (profile?.selected_job_statuses) {
          setSelectedJobStatuses(profile.selected_job_statuses);
        }
      } catch (error) {
        console.error("Error in loadUserPreferences:", error);
      }
    };
    loadUserPreferences();
  }, []);

  const saveUserPreferences = async (types: string[], statuses?: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const updateData = statuses !== undefined
        ? { selected_job_types: types, selected_job_statuses: statuses }
        : { selected_job_types: types };

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", session.user.id);
      if (error) {
        console.error("Error saving user preferences:", error);
        toast({
          title: "Error saving preferences",
          description: "Your filter preferences couldn't be saved.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in saveUserPreferences:", error);
    }
  };

  const handleJobTypeSelection = (type: string) => {
    const newTypes = selectedJobTypes.includes(type)
      ? selectedJobTypes.filter((t) => t !== type)
      : [...selectedJobTypes, type];
    setSelectedJobTypes(newTypes);
    saveUserPreferences(newTypes);
    setIsDropdownOpen(false);
  };

  const handleJobStatusSelection = (status: string) => {
    const newStatuses = selectedJobStatuses.includes(status)
      ? selectedJobStatuses.filter((s) => s !== status)
      : [...selectedJobStatuses, status];
    setSelectedJobStatuses(newStatuses);
    saveUserPreferences(selectedJobTypes, newStatuses);
    setIsStatusDropdownOpen(false);
  };

  const processedJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs.map((job) => ({
      ...job,
      jobTimezone: job.timezone || 'Europe/Madrid',
      departmentIds: job.job_departments?.map((d: any) => d.department) || [],
    }));
  }, [jobs]);

  // Memoize getJobsForDate to prevent unnecessary re-renders and stabilize its reference for effects
  const getJobsForDate = useMemo(() => (date: Date) => {
    if (!processedJobs.length) return [];
    return processedJobs.filter((job) => {
      try {
        if (!job.start_time || !job.end_time) {
          console.warn("Invalid date found for job:", job);
          return false;
        }

        const isWithinDuration = isJobOnDate(job.start_time, job.end_time, date, job.jobTimezone);

        const matchesDepartment = department
          ? isWithinDuration && job.departmentIds.some((dept: string) => dept === department)
          : isWithinDuration;
        const matchesJobType = selectedJobTypes.length === 0 || selectedJobTypes.includes(job.job_type);
        const matchesJobStatus = selectedJobStatuses.length === 0 || selectedJobStatuses.includes(job.status);
        return matchesDepartment && matchesJobType && matchesJobStatus;
      } catch (error) {
        console.error("Error processing job dates:", error, job);
        return false;
      }
    });
  }, [processedJobs, department, selectedJobTypes, selectedJobStatuses]); // Dependencies for getJobsForDate

  const formattedDays = useMemo(() =>
    allDays.map((d) => ({ date: d, formatted: format(d, 'yyyy-MM-dd') })),
    [allDays]
  );

  // Simplified date type fetching optimization
  const jobIdsInView = useMemo(() => {
    const jobIdSet = new Set<string>();
    formattedDays.forEach(({ date }) => {
      getJobsForDate(date).forEach((job) => jobIdSet.add(job.id));
    });
    return Array.from(jobIdSet);
  }, [formattedDays, getJobsForDate]);

  const formattedDatesInView = useMemo(() =>
    Array.from(new Set(formattedDays.map(({ formatted }) => formatted))),
    [formattedDays]
  );

  const { data: dateTypes = {} } = useOptimizedDateTypes(jobIdsInView, formattedDatesInView);

  // Early return for mobile view after all hooks are initialized
  if (isMobile) {
    return (
      <MobileDayCalendar
        date={date}
        onDateSelect={onDateSelect}
        jobs={jobs}
        department={department}
        onDateTypeChange={onDateTypeChange}
        selectedJobTypes={selectedJobTypes}
        onJobTypeSelection={handleJobTypeSelection}
        selectedJobStatuses={selectedJobStatuses}
        onJobStatusSelection={handleJobStatusSelection}
      />
    );
  }


  // --- PDF Generation Logic (Existing) ---
  const generatePDF = async (range: CalendarExportRange) => {
    const filteredJobs = jobs.filter((job) => {
      const jobType = job.job_type?.toLowerCase();
      return jobType && printSettings.jobTypes[jobType] === true;
    });

    const jsPDF = await loadJsPDF();
    const doc = new jsPDF("landscape", "mm", [420, 297]); // A3 dimensions explicitly
    const currentDate = date || new Date();
    let startDate: Date, endDate: Date;

    const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png";
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
    }).catch(() => null);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const logoWidth = 60;
    const logoHeight = logo ? logoWidth * (logo.height / logo.width) : 0;

    const logoTopY = 15;
    const monthTitleY = logo ? logoTopY + logoHeight + 8 : 25;
    const calendarStartY = monthTitleY + 15;
    const footerSpace = 40;
    const legendSpace = 15;

    switch (range) {
      case "month":
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
        break;
      case "quarter":
        startDate = startOfQuarter(addMonths(currentDate, 1));
        endDate = endOfQuarter(addMonths(startDate, 2));
        break;
      case "year":
        startDate = startOfYear(currentDate);
        endDate = endOfYear(currentDate);
        break;
      default:
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
    }

    const months = eachMonthOfInterval({ start: startDate, end: endDate });

    const cellWidth = 57;
    const eventHeight = 3.2;
    const eventSpacing = 0.3;
    const startX = 15;
    const dayNumberHeight = 8;
    const cellPadding = 2;

    const daysOfWeek = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const dateTypeLabels: Record<string, string> = {
      travel: "V",
      setup: "M",
      show: "S",
      off: "O",
      rehearsal: "E",
    };

    // Helper function to calculate events for a day
    const getEventsForDayPdf = (day: Date) => { // Renamed to avoid conflict with memoized one
      return filteredJobs.filter((job) => {
        try {
          const jobTimezone = job.timezone || 'Europe/Madrid';
          return isJobOnDate(job.start_time, job.end_time, day, jobTimezone);
        } catch (error) {
          console.error("Error processing job dates:", error, job);
          return false;
        }
      });
    };

    // Enhanced function to calculate optimal week heights with better distribution
    const calculateOptimalWeekHeights = (weeks: Array<Array<Date | null>>, monthStart: Date) => {
      const availableHeight = pageHeight - calendarStartY - 8 - footerSpace - legendSpace;

      // Calculate event counts for each day in each week
      const weekEventData = weeks.map(week => {
        const dayEventCounts = week.map(day => {
          if (!day || !isSameMonth(day, monthStart)) return 0; // Only count jobs for days in the current month
          const dayEvents = getEventsForDayPdf(day);
          return dayEvents.length;
        });
        const maxEvents = Math.max(...dayEventCounts);
        const totalEvents = dayEventCounts.reduce((sum, count) => sum + count, 0);
        const avgEvents = totalEvents / (dayEventCounts.filter(count => count > 0).length || 1);

        return {
          maxEvents,
          totalEvents,
          avgEvents,
          dayEventCounts
        };
      });

      // Calculate minimum required height for each week
      const minHeights = weekEventData.map(weekData => {
        const { maxEvents } = weekData;
        const maxDisplayEvents = Math.min(maxEvents, 12); // Cap at 12 events for minimum height calculation
        const eventsSpace = maxDisplayEvents * (eventHeight + eventSpacing);
        const moreIndicatorSpace = maxEvents > 12 ? (eventHeight + eventSpacing) : 0;

        return dayNumberHeight + cellPadding * 2 + eventsSpace + moreIndicatorSpace;
      });

      const totalMinHeight = minHeights.reduce((sum, height) => sum + height, 0);

      // If minimum heights fit, use them with some extra space
      if (totalMinHeight <= availableHeight) {
        const extraSpace = availableHeight - totalMinHeight;
        const extraPerWeek = extraSpace / weeks.length;

        return minHeights.map((minHeight, index) => {
          const weekData = weekEventData[index];
          const eventFactor = Math.max(weekData.maxEvents / 12, 0.2); // Give more space to weeks with more events
          const additionalSpace = extraPerWeek * eventFactor;
          return minHeight + additionalSpace;
        });
      }

      // If we need to compress, use intelligent distribution
      const totalWeight = weekEventData.reduce((sum, data) => sum + Math.max(data.maxEvents, 1), 0);

      return weekEventData.map(data => {
        const weight = Math.max(data.maxEvents, 1) / totalWeight;
        const allocatedHeight = availableHeight * weight;

        const minReasonableHeight = dayNumberHeight + cellPadding * 2 +
          Math.min(data.maxEvents, 3) * (eventHeight + eventSpacing); // Ensure at least 3 events space

        return Math.max(allocatedHeight, minReasonableHeight);
      });
    };

    for (const [pageIndex, monthStart] of months.entries()) {
      if (pageIndex > 0) doc.addPage([420, 297], "landscape");

      // Add logo
      const logoX = logo ? (pageWidth - logoWidth) / 2 : 0;
      if (logo) {
        doc.addImage(logo, "PNG", logoX, logoTopY, logoWidth, logoHeight);
      }

      // Month title
      doc.setFontSize(20);
      doc.setTextColor(51, 51, 51);
      doc.text(format(monthStart, "MMMM yyyy").toUpperCase(), pageWidth / 2, monthTitleY, { align: "center" });

      // Days of week header
      daysOfWeek.forEach((day, index) => {
        doc.setFillColor(41, 128, 185);
        doc.rect(startX + index * cellWidth, calendarStartY, cellWidth, 8, "F");
        doc.setTextColor(255);
        doc.setFontSize(12);
        const textX = startX + index * cellWidth + cellWidth / 2;
        doc.text(day, textX, calendarStartY + 6, { align: "center" });
      });

      const monthEnd = endOfMonth(monthStart);
      const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const firstDayOfWeek = 1; // Monday is the first day (0=Sunday, 1=Monday)

      function getDayIndex(d: Date) {
        return firstDayOfWeek === 1 ? (d.getDay() + 6) % 7 : d.getDay();
      }

      const offset = getDayIndex(monthStart);
      const offsetDays = Array.from({ length: offset }, () => null);
      const allMonthDays = [...offsetDays, ...monthDays];
      const weeks: Array<Array<Date | null>> = [];

      while (allMonthDays.length > 0) {
        weeks.push(allMonthDays.splice(0, 7));
      }

      let currentY = calendarStartY + 8;

      // Calculate optimal heights for all weeks
      const weekHeights = calculateOptimalWeekHeights(weeks, monthStart);

      for (const [weekIndex, week] of weeks.entries()) {
        const weekHeight = weekHeights[weekIndex];

        for (const [dayIndex, day] of week.entries()) {
          const x = startX + dayIndex * cellWidth;

          // Draw cell border
          doc.setDrawColor(200);
          doc.setLineWidth(0.5);
          doc.rect(x, currentY, cellWidth, weekHeight);

          if (!day) {
            continue;
          }

          // Day number with better positioning
          doc.setTextColor(isSameMonth(day, monthStart) ? 0 : 150);
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(format(day, "d"), x + 2, currentY + 6);

          const dayJobs = getEventsForDayPdf(day); // Use getEventsForDayPdf

          if (dayJobs.length === 0) continue;

          // Calculate available space for events
          const availableEventSpace = weekHeight - dayNumberHeight - (cellPadding * 2);
          const maxPossibleEvents = Math.floor(availableEventSpace / (eventHeight + eventSpacing));
          const maxEventsToShow = Math.min(dayJobs.length, Math.max(maxPossibleEvents, 1));

          const eventY = currentY + dayNumberHeight + cellPadding;

          // Render events with improved layout
          for (const [index, job] of dayJobs.slice(0, maxEventsToShow).entries()) {
            const key = `${job.id}-${format(day, "yyyy-MM-dd")}`;
            const dateType = dateTypes[key]?.type;
            const typeLabel = dateType ? dateTypeLabels[dateType] : "";
            const baseColor = job.color || "#cccccc";
            const [r, g, b] = hexToRgb(baseColor);
            const textColor = getContrastHexColor(baseColor);

            const yPos = eventY + index * (eventHeight + eventSpacing);

            // Event background
            doc.setFillColor(r, g, b);
            doc.rect(x + 1, yPos, cellWidth - 2, eventHeight, "F");

            // Date type label
            if (typeLabel) {
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7);
              doc.setTextColor(textColor);
              doc.text(typeLabel, x + 2, yPos + 2.2);
            }

            // Job title
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            doc.setTextColor(textColor);
            const titleX = typeLabel ? x + 8 : x + 2;
            const maxTitleWidth = cellWidth - (titleX - x) - 2;
            const maxTitleLength = Math.floor(maxTitleWidth / 1.2);

            let displayTitle = job.title;
            if (displayTitle.length > maxTitleLength) {
              displayTitle = displayTitle.substring(0, maxTitleLength - 3) + "...";
            }

            doc.text(displayTitle, titleX, yPos + 2.2);
          }

          // "More events" indicator
          if (dayJobs.length > maxEventsToShow) {
            const moreY = eventY + maxEventsToShow * (eventHeight + eventSpacing);
            if (moreY + eventHeight < currentY + weekHeight - cellPadding) {
              doc.setFillColor(240, 240, 240);
              doc.rect(x + 1, moreY, cellWidth - 2, eventHeight, "F");
              doc.setFont("helvetica", "italic");
              doc.setFontSize(6);
              doc.setTextColor(100);
              const moreText = `+${dayJobs.length - maxEventsToShow} más`;
              doc.text(moreText, x + 2, moreY + 2.2);
            }
          }
        }
        currentY += weekHeight;
      }

      // Enhanced legend with better positioning
      if (pageIndex === 0) { // Only add legend on the first page
        let legendY = currentY + 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text("Date Types:", startX, legendY);

        let legendX = startX + 50;
        Object.entries(dateTypeLabels).forEach(([type, label], index) => {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(`${label} = ${type.charAt(0).toUpperCase() + type.slice(1)}`, legendX, legendY);
          legendX += 60;

          // Wrap to next line if needed
          if (legendX > pageWidth - 60 && index < Object.entries(dateTypeLabels).length - 1) {
            legendX = startX + 50;
            legendY += 10;
          }
        });
      }
    }

    doc.save(`calendar-${range}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    setShowPrintDialog(false);
  };

  // --- XLS Generation Logic ---
  // Date type colors matching the UI icons
  const DATE_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    travel:    { bg: "DBEAFE", text: "2563EB", label: "V" },   // Blue
    setup:     { bg: "FEF9C3", text: "A16207", label: "M" },   // Yellow
    show:      { bg: "DCFCE7", text: "16A34A", label: "S" },   // Green
    off:       { bg: "F3F4F6", text: "6B7280", label: "O" },   // Gray
    rehearsal: { bg: "EDE9FE", text: "7C3AED", label: "E" },   // Violet
  };

  const WEEKEND_BG = "F1F5F9"; // slate-100
  const TODAY_BORDER = "2563EB"; // primary blue
  const HEADER_BG = "2980B9";
  const HEADER_TEXT = "FFFFFF";
  const OUT_OF_MONTH_TEXT = "9CA3AF"; // gray-400
  const DEFAULT_JOB_COLOR = "6366F1"; // indigo

  const generateXLS = async (range: CalendarExportRange) => {
    const filteredJobs = jobs.filter((job) => {
      const jobType = job.job_type?.toLowerCase();
      return jobType && printSettings.jobTypes[jobType] === true;
    });

    const ExcelJS = await loadExceljs();
    const currentDate = date || new Date();
    let startDate: Date, endDate: Date;

    switch (range) {
      case "month":
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
        break;
      case "quarter":
        startDate = startOfQuarter(addMonths(currentDate, 1));
        endDate = endOfQuarter(addMonths(startDate, 2));
        break;
      case "year":
        startDate = startOfYear(currentDate);
        endDate = endOfYear(currentDate);
        break;
      default:
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
    }

    const daysOfWeek = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];

    const getEventsForDayXls = (day: Date) => {
      return filteredJobs.filter((job) => {
        try {
          const jobTimezone = job.timezone || 'Europe/Madrid';
          return isJobOnDate(job.start_time, job.end_time, day, jobTimezone);
        } catch (error) {
          console.error("Error processing job dates for XLS:", error, job);
          return false;
        }
      });
    };

    const buildStyledSheet = (wb: InstanceType<typeof ExcelJS.Workbook>, monthStart: Date, sheetName: string) => {
      const ws = wb.addWorksheet(sheetName);
      const monthEnd = endOfMonth(monthStart);
      const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const today = toZonedTime(new Date(), "Europe/Madrid");

      // Column widths - wide enough for job titles
      for (let i = 1; i <= 7; i++) {
        ws.getColumn(i).width = 22;
      }

      // Row 1: Month title (merged)
      const titleRow = ws.addRow([format(monthStart, "MMMM yyyy").toUpperCase()]);
      ws.mergeCells("A1:G1");
      const titleCell = titleRow.getCell(1);
      titleCell.font = { bold: true, size: 16, color: { argb: toArgb(HEADER_TEXT) } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(HEADER_BG) } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      titleCell.border = thinBorder(HEADER_BG);
      titleRow.height = 28;

      // Row 2: Day of week headers
      const headerRow = ws.addRow(daysOfWeek);
      headerRow.height = 20;
      for (let c = 1; c <= 7; c++) {
        const cell = headerRow.getCell(c);
        const isWeekendCol = c >= 6; // Sat=6, Sun=7
        cell.font = { bold: true, size: 10, color: { argb: toArgb(isWeekendCol ? "F59E0B" : HEADER_TEXT) } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(isWeekendCol ? "1E3A5F" : "34495E") } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder("34495E");
      }

      // Build week arrays
      function getDayIndex(d: Date) { return (d.getDay() + 6) % 7; }
      const offset = getDayIndex(monthStart);
      const allDays: Array<Date | null> = [
        ...Array.from({ length: offset }, () => null),
        ...monthDays,
      ];
      const weeks: Array<Array<Date | null>> = [];
      while (allDays.length > 0) {
        weeks.push(allDays.splice(0, 7));
      }

      // Determine max jobs in any day for row sizing
      let maxJobsInAnyDay = 0;
      for (const week of weeks) {
        for (const day of week) {
          if (day && isSameMonth(day, monthStart)) {
            const dayJobs = getEventsForDayXls(day);
            if (dayJobs.length > maxJobsInAnyDay) maxJobsInAnyDay = dayJobs.length;
          }
        }
      }
      const rowsPerDay = Math.max(2, maxJobsInAnyDay + 1);

      // Render each week
      for (const week of weeks) {
        const startExcelRow = ws.rowCount + 1;

        // Add empty rows for this week block
        for (let r = 0; r < rowsPerDay; r++) {
          ws.addRow(Array(7).fill(""));
        }

        for (const [colIdx, day] of week.entries()) {
          const col = colIdx + 1; // 1-based
          const isWeekendCol = colIdx >= 5;
          const isInMonth = day ? isSameMonth(day, monthStart) : false;
          const isToday = day && format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");

          // Day number row
          const dayNumCell = ws.getRow(startExcelRow).getCell(col);
          if (day) {
            dayNumCell.value = parseInt(format(day, "d"));
          }
          dayNumCell.font = {
            bold: true,
            size: isToday ? 12 : 10,
            color: { argb: toArgb(
              !isInMonth ? OUT_OF_MONTH_TEXT
              : isToday ? TODAY_BORDER
              : isWeekendCol ? "DC2626"
              : "1F2937"
            ) },
          };
          dayNumCell.alignment = { horizontal: "left", vertical: "top" };

          // Background for all rows in this day cell
          for (let r = 0; r < rowsPerDay; r++) {
            const cell = ws.getRow(startExcelRow + r).getCell(col);
            const bgColor = !isInMonth ? "F9FAFB"
              : isToday ? "EFF6FF"
              : isWeekendCol ? WEEKEND_BG
              : "FFFFFF";
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(bgColor) } };

            // Today: thick blue border
            if (isToday) {
              cell.border = {
                top: r === 0 ? { style: "medium", color: { argb: toArgb(TODAY_BORDER) } } : thinBorder("D1D5DB").top,
                bottom: r === rowsPerDay - 1 ? { style: "medium", color: { argb: toArgb(TODAY_BORDER) } } : thinBorder("D1D5DB").bottom,
                left: { style: "medium", color: { argb: toArgb(TODAY_BORDER) } },
                right: { style: "medium", color: { argb: toArgb(TODAY_BORDER) } },
              };
            } else {
              cell.border = thinBorder("E5E7EB");
            }
          }

          // Job rows
          if (day && isInMonth) {
            const dayJobs = getEventsForDayXls(day);
            for (let i = 0; i < dayJobs.length && i + 1 < rowsPerDay; i++) {
              const job = dayJobs[i];
              const key = `${job.id}-${format(day, "yyyy-MM-dd")}`;
              const dateType = dateTypes[key]?.type;
              const dtInfo = dateType ? DATE_TYPE_COLORS[dateType] : null;
              const jobColor = (job.color || `#${DEFAULT_JOB_COLOR}`).replace(/^#/, "");

              const cell = ws.getRow(startExcelRow + i + 1).getCell(col);
              const label = dtInfo ? `${dtInfo.label} ` : "";
              cell.value = `${label}${job.title}`;

              // Use job color as tinted background (20% opacity equivalent)
              const bgHex = dtInfo ? dtInfo.bg : tintColor(jobColor, 0.2);
              const textHex = dtInfo ? dtInfo.text : jobColor;

              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(bgHex) } };
              cell.font = { size: 9, bold: !!dtInfo, color: { argb: toArgb(textHex) } };
              cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

              // Preserve today border if applicable
              if (isToday) {
                cell.border = {
                  top: thinBorder("D1D5DB").top,
                  bottom: i + 2 === rowsPerDay ? { style: "medium", color: { argb: toArgb(TODAY_BORDER) } } : thinBorder("D1D5DB").bottom,
                  left: { style: "medium", color: { argb: toArgb(TODAY_BORDER) } },
                  right: { style: "medium", color: { argb: toArgb(TODAY_BORDER) } },
                };
              }
            }

          }
        }

        // Set row heights
        ws.getRow(startExcelRow).height = 18; // Day number row
        for (let r = 1; r < rowsPerDay; r++) {
          ws.getRow(startExcelRow + r).height = 15;
        }
      }

      // Legend row at the bottom
      const legendRow = ws.addRow([]);
      legendRow.height = 8;
      const legendHeaderRow = ws.addRow(["Leyenda:"]);
      legendHeaderRow.getCell(1).font = { bold: true, size: 9, color: { argb: toArgb("374151") } };

      const legendItems = [
        { label: "V = Viaje", color: DATE_TYPE_COLORS.travel },
        { label: "M = Montaje", color: DATE_TYPE_COLORS.setup },
        { label: "S = Show", color: DATE_TYPE_COLORS.show },
        { label: "O = Libre", color: DATE_TYPE_COLORS.off },
        { label: "E = Ensayo", color: DATE_TYPE_COLORS.rehearsal },
      ];
      const legendDataRow = ws.addRow(legendItems.map((l) => l.label).concat(["", ""]));
      for (let i = 0; i < legendItems.length; i++) {
        const cell = legendDataRow.getCell(i + 1);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(legendItems[i].color.bg) } };
        cell.font = { bold: true, size: 9, color: { argb: toArgb(legendItems[i].color.text) } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder("D1D5DB");
      }
    };

    const workbook = new ExcelJS.Workbook();

    if (range === "year" || range === "quarter") {
      const monthsInPeriod = eachMonthOfInterval({ start: startDate, end: endDate });
      for (const month of monthsInPeriod) {
        buildStyledSheet(workbook, month, format(month, "MMM yyyy"));
      }
    } else {
      buildStyledSheet(workbook, currentDate, format(currentDate, "MMMM yyyy"));
    }

    await saveWorkbook(workbook, `calendar-${range}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    setShowPrintDialog(false);
  };
  // --- End XLS Generation Logic ---

  const handlePreviousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateSelect(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateSelect(newDate);
  };

  const handleTodayClick = () => {
    onDateSelect(new Date());
  };

  const renderJobCard = (job: any, day: Date) => <CalendarJobCard key={job.id} job={job} date={day} dateTypes={dateTypes} />;

  return (
    <div className="h-full flex flex-col bg-transparent">
      <div className="flex-grow p-4">
        <CalendarHeader
          currentMonth={currentMonth}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onTodayClick={handleTodayClick}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          onPrintClick={() => setShowPrintDialog(true)} // Pass handler to open print dialog
        />
        <PrintDialog
          showDialog={showPrintDialog}
          setShowDialog={setShowPrintDialog}
          printSettings={printSettings}
          setPrintSettings={setPrintSettings}
          generatePDF={generatePDF}
          generateXLS={generateXLS} // Pass XLS generation function
          currentMonth={currentMonth}
          selectedJobTypes={selectedJobTypes}
        />
        <CalendarFilters
          distinctJobTypes={distinctJobTypes}
          selectedJobTypes={selectedJobTypes}
          isDropdownOpen={isDropdownOpen}
          setIsDropdownOpen={setIsDropdownOpen}
          onJobTypeSelection={handleJobTypeSelection}
          distinctJobStatuses={distinctJobStatuses}
          selectedJobStatuses={selectedJobStatuses}
          isStatusDropdownOpen={isStatusDropdownOpen}
          setIsStatusDropdownOpen={setIsStatusDropdownOpen}
          onJobStatusSelection={handleJobStatusSelection}
        />
        {!isCollapsed && (
          <CalendarGrid
            allDays={allDays}
            currentMonth={currentMonth}
            getJobsForDate={getJobsForDate}
            renderJobCard={renderJobCard}
            onDateSelect={onDateSelect}
          />
        )}
      </div>
    </div>
  );
};
