import { loadJsPDF } from "@/utils/pdf/lazyPdf";
import { loadExceljs } from "@/utils/lazyExceljs";
import { applyStyle, saveWorkbook, toArgb, tintColor, thinBorder, hexToRgb, getContrastHexColor } from "@/utils/excelExport";
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
  isSameDay,
  parse,
} from "date-fns";
import type { MadridHoliday } from "@/utils/madridCalendar";
import { getMadridHolidayName, isMadridWorkingDaySync } from "@/utils/madridCalendar";

interface HouseTech {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department?: string | null;
}

interface Assignment {
  id: string;
  technician_id: string;
  job_id: string;
  assignment_date?: string;
  single_day?: boolean;
  dates?: string[];
  jobs?: {
    title: string;
    color?: string;
  };
}

interface PersonalCalendarExportData {
  houseTechs: HouseTech[];
  assignments: Assignment[];
  getAvailabilityStatus: (techId: string, date: Date) => string | null;
  currentDate: Date;
  selectedDepartments?: string[];
  madridHolidays?: MadridHoliday[];
}

const getTechnicianName = (tech: HouseTech): string => {
  const firstName = tech.first_name || "";
  const lastName = tech.last_name || "";
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  return firstName || lastName || "Desconocido";
};

const getStatusColor = (status: string | null): string => {
  switch (status) {
    case "warehouse":
      return "#E5E7EB"; // Light gray
    case "vacation":
      return "#FEE2E2"; // Light red/orange
    case "travel":
      return "#DBEAFE"; // Light blue
    case "sick":
      return "#FCE7F3"; // Light pink
    case "day_off":
      return "#FEF9C3"; // Light yellow
    default:
      return "#BFDBFE"; // Default light blue for jobs
  }
};

const getStatusLabel = (status: string | null): string => {
  switch (status) {
    case "warehouse":
      return "A"; // Almacén
    case "vacation":
      return "VC"; // Vacaciones
    case "travel":
      return "VJ"; // Viaje
    case "sick":
      return "E"; // Enfermo
    case "day_off":
      return "L"; // Libre
    default:
      return "";
  }
};

const isWeekend = (day: Date): boolean => {
  const dayOfWeek = day.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
};

const getAssignmentsForDate = (
  day: Date,
  assignments: Assignment[]
): Assignment[] => {
  return assignments.filter((assignment) => {
    if (assignment.single_day && assignment.assignment_date) {
      const assignmentDate = parse(assignment.assignment_date, "yyyy-MM-dd", new Date());
      return isSameDay(day, assignmentDate);
    }

    if (assignment.dates && assignment.dates.length > 0) {
      const dayString = format(day, "yyyy-MM-dd");
      return assignment.dates.includes(dayString);
    }

    return false;
  });
};

const shouldShowTechOnDay = (
  tech: HouseTech,
  day: Date,
  dayAssignments: Assignment[],
  getAvailabilityStatus: (techId: string, date: Date) => string | null,
  selectedDepartments?: string[],
  madridHolidays?: MadridHoliday[]
): boolean => {
  // If departments are selected, only show techs from those departments
  if (selectedDepartments && selectedDepartments.length > 0) {
    if (!tech.department || !selectedDepartments.includes(tech.department)) {
      return false;
    }
  }

  const hasAssignment = dayAssignments.some(
    (assignment) => assignment.technician_id === tech.id
  );
  const availabilityStatus = getAvailabilityStatus(tech.id, day);

  // If it's a non-working day (weekend or holiday) and no assignment and not marked unavailable, don't show
  const isMadridWorkingDay = madridHolidays
    ? isMadridWorkingDaySync(day, madridHolidays)
    : !isWeekend(day); // Fallback to weekend check if holidays not provided

  if (!isMadridWorkingDay && !hasAssignment && !availabilityStatus) {
    return false;
  }

  return true;
};

export const generatePersonalCalendarPDF = async (
  range: "month" | "quarter" | "year",
  data: PersonalCalendarExportData
) => {
  const jsPDF = await loadJsPDF();
  const { houseTechs, assignments, getAvailabilityStatus, currentDate, selectedDepartments, madridHolidays = [] } = data;

  const doc = new jsPDF("landscape", "mm", [420, 297]); // A3 dimensions

  let startDate: Date, endDate: Date;

  // Load logo
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
  const legendSpace = 20;

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
  const techHeight = 3.5;
  const techSpacing = 0.4;
  const startX = 15;
  const dayNumberHeight = 8;
  const cellPadding = 2;

  const daysOfWeek = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  const getTechsForDay = (day: Date) => {
    const dayAssignments = getAssignmentsForDate(day, assignments);
    const visibleTechs = houseTechs.filter((tech) =>
      shouldShowTechOnDay(tech, day, dayAssignments, getAvailabilityStatus, selectedDepartments, madridHolidays)
    );

    // Group by department
    const soundTechs = visibleTechs.filter(
      (tech) => tech.department && tech.department.trim().toLowerCase() === "sound"
    );
    const lightsTechs = visibleTechs.filter(
      (tech) => tech.department && tech.department.trim().toLowerCase() === "lights"
    );
    const otherTechs = visibleTechs.filter(
      (tech) =>
        !tech.department ||
        (tech.department.trim().toLowerCase() !== "sound" &&
          tech.department.trim().toLowerCase() !== "lights")
    );

    return [...soundTechs, ...lightsTechs, ...otherTechs].map((tech) => {
      const techAssignment = dayAssignments.find((a) => a.technician_id === tech.id);
      const availabilityStatus = getAvailabilityStatus(tech.id, day);
      return { tech, assignment: techAssignment, availabilityStatus };
    });
  };

  const calculateOptimalWeekHeights = (weeks: Array<Array<Date | null>>, monthStart: Date) => {
    const availableHeight = pageHeight - calendarStartY - 8 - footerSpace - legendSpace;

    const weekTechCounts = weeks.map((week) => {
      const dayTechCounts = week.map((day) => {
        if (!day || !isSameMonth(day, monthStart)) return 0;
        const dayTechs = getTechsForDay(day);
        return dayTechs.length;
      });
      const maxTechs = Math.max(...dayTechCounts);
      return maxTechs;
    });

    const minHeights = weekTechCounts.map((maxTechs) => {
      const maxDisplayTechs = Math.min(maxTechs, 12);
      const techsSpace = maxDisplayTechs * (techHeight + techSpacing);
      const moreIndicatorSpace = maxTechs > 12 ? techHeight + techSpacing : 0;
      return dayNumberHeight + cellPadding * 2 + techsSpace + moreIndicatorSpace;
    });

    const totalMinHeight = minHeights.reduce((sum, height) => sum + height, 0);

    if (totalMinHeight <= availableHeight) {
      const extraSpace = availableHeight - totalMinHeight;
      const extraPerWeek = extraSpace / weeks.length;
      return minHeights.map((minHeight, index) => {
        const techFactor = Math.max(weekTechCounts[index] / 12, 0.2);
        const additionalSpace = extraPerWeek * techFactor;
        return minHeight + additionalSpace;
      });
    }

    const totalWeight = weekTechCounts.reduce((sum, count) => sum + Math.max(count, 1), 0);
    return weekTechCounts.map((count) => {
      const weight = Math.max(count, 1) / totalWeight;
      const allocatedHeight = availableHeight * weight;
      const minReasonableHeight =
        dayNumberHeight + cellPadding * 2 + Math.min(count, 3) * (techHeight + techSpacing);
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
    doc.text(
      `CALENDARIO DE PERSONAL - ${format(monthStart, "MMMM yyyy", { locale: es }).toUpperCase()}`,
,
      pageWidth / 2,
      monthTitleY,
      { align: "center" }
    );

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
    const firstDayOfWeek = 1;

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
    const weekHeights = calculateOptimalWeekHeights(weeks, monthStart);

    for (const [weekIndex, week] of weeks.entries()) {
      const weekHeight = weekHeights[weekIndex];

      for (const [dayIndex, day] of week.entries()) {
        const x = startX + dayIndex * cellWidth;

        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.rect(x, currentY, cellWidth, weekHeight);

        if (!day) {
          continue;
        }

        doc.setTextColor(isSameMonth(day, monthStart) ? 0 : 150);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(format(day, "d"), x + 2, currentY + 6);

        // Show holiday indicator if it's a Madrid holiday
        const holidayName = getMadridHolidayName(day, madridHolidays);
        if (holidayName) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(180, 100, 0); // Amber color
          doc.text("H", x + cellWidth - 8, currentY + 6);
        }

        const dayTechsData = getTechsForDay(day);

        if (dayTechsData.length === 0) continue;

        const availableEventSpace = weekHeight - dayNumberHeight - cellPadding * 2;
        const maxPossibleTechs = Math.floor(availableEventSpace / (techHeight + techSpacing));
        const maxTechsToShow = Math.min(dayTechsData.length, Math.max(maxPossibleTechs, 1));

        const techY = currentY + dayNumberHeight + cellPadding;

        for (const [index, techData] of dayTechsData.slice(0, maxTechsToShow).entries()) {
          const { tech, assignment, availabilityStatus } = techData;
          const yPos = techY + index * (techHeight + techSpacing);

          const statusColor = assignment
            ? assignment.jobs?.color || "#BFDBFE"
            : getStatusColor(availabilityStatus);
          const [r, g, b] = hexToRgb(statusColor);
          const textColor = getContrastHexColor(statusColor);

          doc.setFillColor(r, g, b);
          doc.rect(x + 1, yPos, cellWidth - 2, techHeight, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(textColor);

          const statusLabel = availabilityStatus ? getStatusLabel(availabilityStatus) : "";
          const jobTitle = assignment?.jobs?.title || "";
          const techName = getTechnicianName(tech);
          const displayText = statusLabel
            ? `${statusLabel} - ${techName}`
            : jobTitle
            ? `${techName} (${jobTitle})`
            : techName;

          const maxTextWidth = cellWidth - 4;
          const maxTextLength = Math.floor(maxTextWidth / 1.2);

          let displayTextTrimmed = displayText;
          if (displayText && displayText.length > maxTextLength) {
            displayTextTrimmed = displayText.substring(0, maxTextLength - 3) + "...";
          }

          doc.text(displayTextTrimmed, x + 2, yPos + 2.5);
        }

        if (dayTechsData.length > maxTechsToShow) {
          const moreY = techY + maxTechsToShow * (techHeight + techSpacing);
          if (moreY + techHeight < currentY + weekHeight - cellPadding) {
            doc.setFillColor(240, 240, 240);
            doc.rect(x + 1, moreY, cellWidth - 2, techHeight, "F");
            doc.setFont("helvetica", "italic");
            doc.setFontSize(6);
            doc.setTextColor(100);
            const moreText = `+${dayTechsData.length - maxTechsToShow} más`;
            doc.text(moreText, x + 2, moreY + 2.5);
          }
        }
      }
      currentY += weekHeight;
    }

    // Legend
    if (pageIndex === 0) {
      let legendY = currentY + 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text("Indicadores de Estado:", startX, legendY);

      let legendX = startX + 50;
      const statusLabels = [
        { label: "A", description: "Almacén" },
        { label: "VC", description: "Vacaciones" },
        { label: "VJ", description: "Viaje" },
        { label: "E", description: "Enfermo" },
        { label: "L", description: "Libre" },
      ];

      statusLabels.forEach((status, index) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`${status.label} = ${status.description}`, legendX, legendY);
        legendX += 60;

        if (legendX > pageWidth - 60 && index < statusLabels.length - 1) {
          legendX = startX + 50;
          legendY += 10;
        }
      });
    }
  }

  doc.save(`personal-calendar-${range}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
};

// Department colors matching the UI
const DEPT_COLORS: Record<string, { bg: string; text: string }> = {
  sound:  { bg: "DBEAFE", text: "1E40AF" }, // blue-100/blue-800
  lights: { bg: "FEF9C3", text: "854D0E" }, // yellow-100/yellow-800
  video:  { bg: "F3E8FF", text: "6B21A8" }, // purple-100/purple-800
};
const DEFAULT_DEPT_COLOR = { bg: "F3F4F6", text: "374151" }; // gray-100/gray-800

// Availability status colors matching the UI
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  warehouse: { bg: "E5E7EB", text: "374151" }, // Gray
  vacation:  { bg: "FEE2E2", text: "DC2626" }, // Red
  travel:    { bg: "DBEAFE", text: "2563EB" }, // Blue
  sick:      { bg: "FCE7F3", text: "BE185D" }, // Pink
  day_off:   { bg: "FEF9C3", text: "A16207" }, // Yellow
};
const JOB_ASSIGNMENT_COLOR = { bg: "BFDBFE", text: "1E40AF" }; // Light blue

const WEEKEND_BG_PERSONAL = "F1F5F9"; // slate-100
const HOLIDAY_BG = "FFFBEB"; // amber-50
const HEADER_BG_PERSONAL = "2980B9";

export const generatePersonalCalendarXLS = async (
  range: "month" | "quarter" | "year",
  data: PersonalCalendarExportData
) => {
  const ExcelJS = await loadExceljs();
  const { houseTechs, assignments, getAvailabilityStatus, currentDate, selectedDepartments, madridHolidays = [] } = data;

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

  const getTechsForDayXls = (day: Date) => {
    const dayAssignments = getAssignmentsForDate(day, assignments);
    const visibleTechs = houseTechs.filter((tech) =>
      shouldShowTechOnDay(tech, day, dayAssignments, getAvailabilityStatus, selectedDepartments, madridHolidays)
    );

    const soundTechs = visibleTechs.filter(
      (tech) => tech.department && tech.department.trim().toLowerCase() === "sound"
    );
    const lightsTechs = visibleTechs.filter(
      (tech) => tech.department && tech.department.trim().toLowerCase() === "lights"
    );
    const otherTechs = visibleTechs.filter(
      (tech) =>
        !tech.department ||
        (tech.department.trim().toLowerCase() !== "sound" &&
          tech.department.trim().toLowerCase() !== "lights")
    );

    return [...soundTechs, ...lightsTechs, ...otherTechs].map((tech) => {
      const techAssignment = dayAssignments.find((a) => a.technician_id === tech.id);
      const availabilityStatus = getAvailabilityStatus(tech.id, day);
      return { tech, assignment: techAssignment, availabilityStatus };
    });
  };

  const buildStyledSheet = (wb: InstanceType<typeof ExcelJS.Workbook>, monthStart: Date, sheetName: string) => {
    const ws = wb.addWorksheet(sheetName);
    const monthEnd = endOfMonth(monthStart);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Column widths
    for (let i = 1; i <= 7; i++) {
      ws.getColumn(i).width = 24;
    }

    // Row 1: Month title
    const titleRow = ws.addRow([`CALENDARIO DE PERSONAL - ${format(monthStart, "MMMM yyyy").toUpperCase()}`]);
    ws.mergeCells("A1:G1");
    const titleCell = titleRow.getCell(1);
    titleCell.font = { bold: true, size: 14, color: { argb: toArgb("FFFFFF") } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(HEADER_BG_PERSONAL) } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleRow.height = 26;

    // Row 2: Day headers
    const headerRow = ws.addRow(daysOfWeek);
    headerRow.height = 20;
    for (let c = 1; c <= 7; c++) {
      const cell = headerRow.getCell(c);
      const isWeekendCol = c >= 6;
      cell.font = { bold: true, size: 10, color: { argb: toArgb(isWeekendCol ? "F59E0B" : "FFFFFF") } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(isWeekendCol ? "1E3A5F" : "34495E") } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }

    // Build weeks
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

    // Max techs per day
    let maxTechsInAnyDay = 0;
    for (const week of weeks) {
      for (const day of week) {
        if (day && isSameMonth(day, monthStart)) {
          const techs = getTechsForDayXls(day);
          if (techs.length > maxTechsInAnyDay) maxTechsInAnyDay = techs.length;
        }
      }
    }
    const rowsPerDay = Math.max(2, maxTechsInAnyDay + 1);

    // Render weeks
    for (const week of weeks) {
      const startExcelRow = ws.rowCount + 1;

      for (let r = 0; r < rowsPerDay; r++) {
        ws.addRow(Array(7).fill(""));
      }

      for (const [colIdx, day] of week.entries()) {
        const col = colIdx + 1;
        const isWeekendCol = colIdx >= 5;
        const isInMonth = day ? isSameMonth(day, monthStart) : false;
        const holidayName = day ? getMadridHolidayName(day, madridHolidays) : null;
        const isHoliday = !!holidayName;

        // Day number
        const dayNumCell = ws.getRow(startExcelRow).getCell(col);
        if (day) {
          const dayStr = format(day, "d");
          dayNumCell.value = isHoliday ? `${dayStr} 🏖️ ${holidayName}` : parseInt(dayStr);
        }
        dayNumCell.font = {
          bold: true,
          size: isHoliday ? 9 : 10,
          color: { argb: toArgb(
            !isInMonth ? "9CA3AF"
            : isHoliday ? "B45309"
            : isWeekendCol ? "DC2626"
            : "1F2937"
          ) },
        };
        dayNumCell.alignment = { horizontal: "left", vertical: "top", wrapText: true };

        // Background for all rows in this day
        for (let r = 0; r < rowsPerDay; r++) {
          const cell = ws.getRow(startExcelRow + r).getCell(col);
          const bgColor = !isInMonth ? "F9FAFB"
            : isHoliday ? HOLIDAY_BG
            : isWeekendCol ? WEEKEND_BG_PERSONAL
            : "FFFFFF";
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(bgColor) } };
          cell.border = thinBorder("E5E7EB");
        }

        // Technician rows
        if (day && isInMonth) {
          const dayTechs = getTechsForDayXls(day);

          for (let i = 0; i < dayTechs.length && i + 1 < rowsPerDay; i++) {
            const { tech, assignment, availabilityStatus } = dayTechs[i];
            const cell = ws.getRow(startExcelRow + i + 1).getCell(col);

            // Determine text
            const statusLabel = availabilityStatus ? `[${getStatusLabel(availabilityStatus)}]` : "";
            const jobTitle = assignment?.jobs?.title || "";
            const techName = getTechnicianName(tech);
            const displayText = statusLabel
              ? `${techName} ${statusLabel}`
              : jobTitle
              ? `${techName} (${jobTitle})`
              : techName;
            cell.value = displayText;

            // Color: status > job color > department color
            let cellColors: { bg: string; text: string };
            if (availabilityStatus && STATUS_COLORS[availabilityStatus]) {
              cellColors = STATUS_COLORS[availabilityStatus];
            } else if (assignment?.jobs?.color) {
              const jobColor = assignment.jobs.color.replace(/^#/, "");
              cellColors = { bg: tintColor(jobColor, 0.2), text: jobColor };
            } else if (assignment) {
              cellColors = JOB_ASSIGNMENT_COLOR;
            } else {
              const dept = tech.department?.trim().toLowerCase() || "";
              cellColors = DEPT_COLORS[dept] || DEFAULT_DEPT_COLOR;
            }

            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(cellColors.bg) } };
            cell.font = { size: 8, color: { argb: toArgb(cellColors.text) } };
            cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

            // Preserve holiday/weekend bg blend
            if (isHoliday || isWeekendCol) {
              cell.border = thinBorder("E5E7EB");
            }
          }

        }
      }

      // Row heights
      ws.getRow(startExcelRow).height = 18;
      for (let r = 1; r < rowsPerDay; r++) {
        ws.getRow(startExcelRow + r).height = 14;
      }
    }

    // Legend
    ws.addRow([]);
    const legendHeader = ws.addRow(["Leyenda:"]);
    legendHeader.getCell(1).font = { bold: true, size: 9 };

    // Department legend
    const deptLegendRow = ws.addRow(["Sonido", "Luces", "Vídeo", "", "", "", ""]);
    const deptLegendColors = [DEPT_COLORS.sound, DEPT_COLORS.lights, DEPT_COLORS.video];
    for (let i = 0; i < 3; i++) {
      const cell = deptLegendRow.getCell(i + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(deptLegendColors[i].bg) } };
      cell.font = { bold: true, size: 8, color: { argb: toArgb(deptLegendColors[i].text) } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = thinBorder("D1D5DB");
    }

    // Status legend
    const statusItems = [
      { label: "A = Almacén", key: "warehouse" },
      { label: "VC = Vacaciones", key: "vacation" },
      { label: "VJ = Viaje", key: "travel" },
      { label: "E = Enfermo", key: "sick" },
      { label: "L = Libre", key: "day_off" },
    ];
    const statusLegendRow = ws.addRow(statusItems.map((s) => s.label).concat(["", ""]));
    for (let i = 0; i < statusItems.length; i++) {
      const colors = STATUS_COLORS[statusItems[i].key];
      const cell = statusLegendRow.getCell(i + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(colors.bg) } };
      cell.font = { bold: true, size: 8, color: { argb: toArgb(colors.text) } };
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

  await saveWorkbook(workbook, `personal-calendar-${range}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
};
