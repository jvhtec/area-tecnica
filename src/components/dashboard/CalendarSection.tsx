import React, { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDayCalendar } from "./MobileDayCalendar";
import { CalendarHeader } from "./calendar-section/CalendarHeader";
import { CalendarFilters } from "./calendar-section/CalendarFilters";
import { CalendarGrid } from "./calendar-section/CalendarGrid";
import { CalendarJobCard } from "./calendar-section/CalendarJobCard";
import { PrintDialog } from "./calendar-section/PrintDialog";
import type { CalendarExportRange, PrintSettings } from "./calendar-section/types";
import { dataLayerClient } from "@/services/dataLayerClient";
import { generateJobsCalendarPDF } from "@/utils/pdf/jobsCalendarPdfExport";
import { loadExceljs } from "@/utils/lazyExceljs";
import { saveWorkbook, toArgb, tintColor, thinBorder } from "@/utils/excelExport";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  eachMonthOfInterval,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useOptimizedDateTypes } from "@/hooks/useOptimizedDateTypes";
import { useToast } from "@/hooks/use-toast";
import { isJobOnDate } from "@/utils/timezoneUtils";
import { getCalendarJobDisplayTitle } from "@/utils/calendarArtists";
import { DateType, DATE_TYPE_META, DATE_TYPE_ORDER, getDateTypeMeta } from "@/constants/dateTypes";
import {
  buildCalendarDays,
  collectCalendarJobIds,
  filterCalendarJobsForDate,
  formatCalendarDays,
  getCalendarExportInterval,
  prepareCalendarJobs,
} from "@/components/dashboard/calendar-section/calendarViewModel";

type PrintableJobType = keyof PrintSettings["jobTypes"];

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

  const isPrintableJobType = (value: string | undefined): value is PrintableJobType =>
    Boolean(value && value in printSettings.jobTypes);

  const currentMonth = useMemo(() => date ?? new Date(), [date]);

  const allDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const distinctJobTypes = jobs ? Array.from(new Set(jobs.map((job) => job.job_type).filter(Boolean))) : [];
  const distinctJobStatuses = jobs ? Array.from(new Set(jobs.map((job) => job.status).filter(Boolean))) : [];

  // Load user preferences
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const { data: { session } } = await dataLayerClient.auth.getSession();
        if (!session?.user?.id) return;
        const { data: profile, error } = await dataLayerClient.from("profiles")
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
      const { data: { session } } = await dataLayerClient.auth.getSession();
      if (!session?.user?.id) return;

      const updateData = statuses !== undefined
        ? { selected_job_types: types, selected_job_statuses: statuses }
        : { selected_job_types: types };

      const { error } = await dataLayerClient.from("profiles")
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

  const processedJobs = useMemo(() => prepareCalendarJobs(jobs || []), [jobs]);

  // Memoize getJobsForDate to prevent unnecessary re-renders and stabilize its reference for effects
  const getJobsForDate = useMemo(
    () => (selectedDate: Date) => filterCalendarJobsForDate(processedJobs, selectedDate, {
      department,
      selectedJobTypes,
      selectedJobStatuses,
    }),
    [processedJobs, department, selectedJobTypes, selectedJobStatuses],
  );

  const formattedDays = useMemo(() => formatCalendarDays(allDays), [allDays]);

  // Simplified date type fetching optimization
  const jobIdsInView = useMemo(
    () => collectCalendarJobIds(formattedDays, getJobsForDate),
    [formattedDays, getJobsForDate],
  );

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


  const generatePDF = async (range: CalendarExportRange) => {
    await generateJobsCalendarPDF({
      range,
      jobs,
      printSettings,
      dateTypes,
      currentDate: date || new Date(),
    });
    setShowPrintDialog(false);
  };

  // --- XLS Generation Logic ---
  // Date type colors matching the UI icons
  const DATE_TYPE_COLORS: Record<DateType, { bg: string; text: string; label: string; labelEs: string }> = DATE_TYPE_ORDER.reduce((acc, type) => {
    const meta = DATE_TYPE_META[type];
    acc[type] = {
      bg: meta.xlsBg,
      text: meta.xlsText,
      label: meta.shortLabel,
      labelEs: meta.labelEs,
    };
    return acc;
  }, {} as Record<DateType, { bg: string; text: string; label: string; labelEs: string }>);

  const WEEKEND_BG = "F1F5F9"; // slate-100
  const TODAY_BORDER = "2563EB"; // primary blue
  const HEADER_BG = "2980B9";
  const HEADER_TEXT = "FFFFFF";
  const OUT_OF_MONTH_TEXT = "9CA3AF"; // gray-400
  const DEFAULT_JOB_COLOR = "6366F1"; // indigo

  const generateXLS = async (range: CalendarExportRange) => {
    const filteredJobs = jobs.filter((job) => {
      const jobType = job.job_type?.toLowerCase();
      return isPrintableJobType(jobType) && printSettings.jobTypes[jobType] === true;
    });

    const ExcelJS = await loadExceljs();
    const currentDate = date || new Date();
    const { startDate, endDate } = getCalendarExportInterval(range, currentDate);

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
      function getDayIndex(d: Date): number { return (d.getDay() + 6) % 7; }
      const offset = getDayIndex(monthStart);
      const allDays: Array<Date | null> = [
        ...Array.from({ length: offset }, (): null => null),
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
              const dtInfo = getDateTypeMeta(dateType)
                ? DATE_TYPE_COLORS[dateType as DateType]
                : null;
              const jobColor = (job.color || `#${DEFAULT_JOB_COLOR}`).replace(/^#/, "");

              const cell = ws.getRow(startExcelRow + i + 1).getCell(col);
              const label = dtInfo ? `${dtInfo.label} ` : "";
              cell.value = `${label}${getCalendarJobDisplayTitle(job, day)}`;

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

      const legendItems = DATE_TYPE_ORDER.map((type) => {
        const item = DATE_TYPE_COLORS[type];
        return { label: `${item.label} = ${item.labelEs}`, color: item };
      });
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
