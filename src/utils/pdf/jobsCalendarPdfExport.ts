import { loadJsPDF } from "@/utils/pdf/lazyPdf";
import {
  REPORT_FAINT,
  REPORT_HAIRLINE,
  REPORT_INK,
  REPORT_PAPER_TINT,
  REPORT_RULE,
  REPORT_SOFT,
  drawReportRunningHead,
  loadReportIssuerMark,
  reportGeometry,
  setReportMonoText,
  setReportText,
  stampReportFolios,
  type ReportChromeOptions,
} from "@/utils/pdf/report-system";
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  format,
  isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import { hexToRgb, getContrastHexColor } from "@/utils/excelExport";
import { isJobOnDate } from "@/utils/timezoneUtils";
import { getCalendarJobDisplayTitle } from "@/utils/calendarArtists";
import {
  DATE_TYPE_META,
  DATE_TYPE_ORDER,
  getDateTypeMeta,
  type DateType,
} from "@/constants/dateTypes";
import { getCalendarExportInterval } from "@/components/dashboard/calendar-section/calendarViewModel";
import type { CalendarArtist } from "@/utils/calendarArtists";
import type { JobDateTypeMap } from "@/utils/jobDateTypes";
import type {
  CalendarExportRange,
  PrintSettings,
} from "@/components/dashboard/calendar-section/types";

/** Only the columns the printed sheet reads off a job row. */
export interface JobsCalendarJob {
  id: string;
  title?: string | null;
  job_name?: string | null;
  start_time: string;
  end_time: string;
  color?: string | null;
  job_type?: string | null;
  timezone?: string | null;
  festival_artists?: CalendarArtist[] | null;
}

export interface JobsCalendarPdfOptions {
  range: CalendarExportRange;
  jobs: JobsCalendarJob[];
  printSettings: PrintSettings;
  dateTypes: JobDateTypeMap;
  currentDate: Date;
}

type PrintableJobType = keyof PrintSettings["jobTypes"];

/**
 * The A3 jobs calendar printed from the dashboard.
 *
 * Kept out of `CalendarSection` so the component stays inside the file-size
 * budget and the export can be exercised on its own.
 */
export const generateJobsCalendarPDF = async ({
  range,
  jobs,
  printSettings,
  dateTypes,
  currentDate: selectedDate,
}: JobsCalendarPdfOptions): Promise<void> => {
  const isPrintableJobType = (value: string | undefined): value is PrintableJobType =>
    Boolean(value && value in printSettings.jobTypes);

  const filteredJobs = jobs.filter((job) => {
    const jobType = job.job_type?.toLowerCase();
    return isPrintableJobType(jobType) && printSettings.jobTypes[jobType] === true;
  });

  const jsPDF = await loadJsPDF();
  const doc = new jsPDF("landscape", "mm", [420, 297]); // A3 dimensions explicitly
  const { startDate, endDate } = getCalendarExportInterval(range, selectedDate);

  await loadReportIssuerMark();

  const pageHeight = doc.internal.pageSize.getHeight();

  // The grid starts and ends on the same edges as the chrome above it, and
  // reserves exactly what the chrome occupies at the foot of the sheet.
  const calendarGeo = reportGeometry(doc);
  const monthTitleY = 40;
  const calendarStartY = monthTitleY + 8;
  const footerSpace = pageHeight - calendarGeo.contentBottom + 6;
  const legendSpace = 15;

  const months = eachMonthOfInterval({ start: startDate, end: endDate });

  const startX = calendarGeo.left;
  const cellWidth = calendarGeo.contentWidth / 7;
  const eventHeight = 3.2;
  const eventSpacing = 0.3;
  const dayNumberHeight = 8;
  const cellPadding = 2;

  const daysOfWeek = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  // The legend reads in Spanish: `DATE_TYPE_META` already carries `labelEs`,
  // and the key was being title-cased into English ("Prep_day").
  const dateTypeLegend = DATE_TYPE_ORDER.map((type) => ({
    short: DATE_TYPE_META[type].shortLabel,
    label: DATE_TYPE_META[type].labelEs,
  }));
  const dateTypeLabels: Record<DateType, string> = DATE_TYPE_ORDER.reduce((acc, type) => {
    acc[type] = DATE_TYPE_META[type].shortLabel;
    return acc;
  }, {} as Record<DateType, string>);

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
      // The slack is shared out in proportion to how busy each week is, but
      // the shares are normalised so they add up to the whole slack: weighting
      // a per-week average by a factor that is almost always below 1 left the
      // bottom third of an A3 sheet empty.
      const extraSpace = availableHeight - totalMinHeight;
      const weightFor = (index: number) => Math.max(weekEventData[index].maxEvents / 12, 0.2);
      const weightSum = minHeights.reduce((sum, _height, index) => sum + weightFor(index), 0);

      return minHeights.map(
        (minHeight, index) => minHeight + (extraSpace * weightFor(index)) / weightSum,
      );
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

    const monthLabel = format(monthStart, "MMMM yyyy", { locale: es });
    const chrome: ReportChromeOptions = {
      kind: "schedule",
      kindLabel: "Calendario de trabajos",
      eventTitle: "Calendario de trabajos",
      contextLabel: monthLabel,
    };
    const geo = drawReportRunningHead(doc, chrome);

    setReportText(doc, REPORT_INK, 18, "bold");
    doc.text(
      monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      geo.left,
      monthTitleY,
      { charSpace: -0.08 },
    );

    // Weekday heads are set in mono caps over a hairline rather than in a
    // filled blue band: the grid below already carries all the structure the
    // eye needs, and a solid band across an A3 sheet only adds weight.
    daysOfWeek.forEach((day, index) => {
      const cellX = startX + index * cellWidth;
      setReportMonoText(doc, REPORT_SOFT, 6.4, "bold");
      doc.text(day.toUpperCase(), cellX + cellWidth / 2, calendarStartY + 5, {
        align: "center",
        charSpace: 0.25,
      });
    });
    doc.setDrawColor(...REPORT_INK);
    doc.setLineWidth(0.25);
    doc.line(startX, calendarStartY + 8, startX + cellWidth * 7, calendarStartY + 8);

    const monthEnd = endOfMonth(monthStart);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const firstDayOfWeek = 1; // Monday is the first day (0=Sunday, 1=Monday)

    function getDayIndex(d: Date): number {
      return firstDayOfWeek === 1 ? (d.getDay() + 6) % 7 : d.getDay();
    }

    const offset = getDayIndex(monthStart);
    const offsetDays = Array.from({ length: offset }, (): null => null);
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

        // Cell borders are hairlines in the rule tone: on an A3 grid a 0.5mm
        // mid-grey box draws more attention than the events inside it.
        doc.setDrawColor(...REPORT_RULE);
        doc.setLineWidth(REPORT_HAIRLINE);
        doc.rect(x, currentY, cellWidth, weekHeight);

        if (!day) {
          continue;
        }

        // Day numbers are counted, so they are set in mono; days spilling in
        // from the neighbouring month drop to the faint tone.
        setReportMonoText(
          doc,
          isSameMonth(day, monthStart) ? REPORT_INK : REPORT_FAINT,
          9,
          "bold",
        );
        doc.text(format(day, "d"), x + 2, currentY + 5.6);

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
          const typeLabel = getDateTypeMeta(dateType)?.shortLabel || "";
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

          let displayTitle = getCalendarJobDisplayTitle(job, day);
          if (displayTitle.length > maxTitleLength) {
            displayTitle = displayTitle.substring(0, maxTitleLength - 3) + "...";
          }

          doc.text(displayTitle, titleX, yPos + 2.2);
        }

        // "More events" indicator
        if (dayJobs.length > maxEventsToShow) {
          const moreY = eventY + maxEventsToShow * (eventHeight + eventSpacing);
          if (moreY + eventHeight < currentY + weekHeight - cellPadding) {
            doc.setFillColor(...REPORT_PAPER_TINT);
            doc.rect(x + 1, moreY, cellWidth - 2, eventHeight, "F");
            setReportMonoText(doc, REPORT_SOFT, 5.4, "normal");
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
      setReportMonoText(doc, REPORT_SOFT, 6.4, "bold");
      doc.text("TIPOS DE FECHA", startX, legendY, { charSpace: 0.25 });

      // Entries are placed against their measured width rather than on a
      // fixed 60 mm step, which used to wrap a seven-item legend onto two
      // ragged lines while leaving most of an A3 sheet empty.
      const legendLeft = startX + 34;
      let legendX = legendLeft;
      setReportText(doc, REPORT_SOFT, 7.4, "normal");
      dateTypeLegend.forEach(({ short, label }) => {
        const entry = `${short} = ${label}`;
        const entryWidth = doc.getTextWidth(entry);
        if (legendX > legendLeft && legendX + entryWidth > calendarGeo.right) {
          legendX = legendLeft;
          legendY += 5;
        }
        doc.text(entry, legendX, legendY);
        legendX += entryWidth + 10;
      });
    }
  }

  stampReportFolios(doc);

  doc.save(`calendario-${range}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
};
