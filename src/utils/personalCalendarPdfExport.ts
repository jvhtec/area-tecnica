import { loadJsPDF } from "@/utils/pdf/lazyPdf";
import { loadExceljs } from "@/utils/lazyExceljs";
import { populateSheet, saveWorkbook } from "@/utils/excelExport";
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
import type { MadridHoliday } from "./madridCalendar";
import { getMadridHolidayName, isMadridWorkingDaySync } from "./madridCalendar";

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
  return firstName || lastName || "Unknown";
};

const hexToRgb = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

const getContrastColor = (hex: string): string => {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
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

  const daysOfWeek = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

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
      `PERSONAL CALENDAR - ${format(monthStart, "MMMM yyyy").toUpperCase()}`,
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
          const textColor = getContrastColor(statusColor);

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
            const moreText = `+${dayTechsData.length - maxTechsToShow} more`;
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

  const daysOfWeek = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

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

  const generateSheetData = (monthStart: Date) => {
    const sheetData: (string | null)[][] = [];

    sheetData.push([
      `PERSONAL CALENDAR - ${format(monthStart, "MMMM yyyy").toUpperCase()}`,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);

    sheetData.push(daysOfWeek);

    const monthEnd = endOfMonth(monthStart);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const firstDayOfWeek = 1;

    function getDayIndex(d: Date) {
      return firstDayOfWeek === 1 ? (d.getDay() + 6) % 7 : d.getDay();
    }

    const offset = getDayIndex(monthStart);
    const offsetDays = Array.from({ length: offset }, () => null);
    const allMonthDaysWithPadding = [...offsetDays, ...monthDays];
    const weeks: Array<Array<Date | null>> = [];

    while (allMonthDaysWithPadding.length > 0) {
      weeks.push(allMonthDaysWithPadding.splice(0, 7));
    }

    let maxTechsInAnyDay = 0;
    for (const week of weeks) {
      for (const day of week) {
        if (day && isSameMonth(day, monthStart)) {
          const techs = getTechsForDayXls(day);
          if (techs.length > maxTechsInAnyDay) {
            maxTechsInAnyDay = techs.length;
          }
        }
      }
    }

    const rowsPerDayCell = Math.max(1, maxTechsInAnyDay + 1);

    for (const week of weeks) {
      const weekRows = Array.from({ length: rowsPerDayCell }, () => Array(7).fill(null));

      for (const [dayIndex, day] of week.entries()) {
        if (!day) {
          continue;
        }

        const dayString = format(day, "d");
        const dayTechs = getTechsForDayXls(day);

        // Add holiday indicator if it's a Madrid holiday
        const holidayName = getMadridHolidayName(day, madridHolidays);
        const dayDisplayString = holidayName ? `${dayString} 🏖️` : dayString;

        weekRows[0][dayIndex] = isSameMonth(day, monthStart) ? dayDisplayString : format(day, "d");

        for (let i = 0; i < dayTechs.length; i++) {
          if (i + 1 < rowsPerDayCell) {
            const { tech, assignment, availabilityStatus } = dayTechs[i];
            const statusLabel = availabilityStatus ? `[${getStatusLabel(availabilityStatus)}]` : "";
            const jobTitle = assignment?.jobs?.title || "";
            const techName = getTechnicianName(tech);
            const displayText = statusLabel
              ? `${techName} ${statusLabel}`
              : jobTitle
              ? `${techName} (${jobTitle})`
              : techName;
            weekRows[i + 1][dayIndex] = displayText;
          } else {
            weekRows[rowsPerDayCell - 1][dayIndex] = `+${dayTechs.length - i} more...`;
            break;
          }
        }
      }
      sheetData.push(...weekRows);
    }
    return sheetData;
  };

  const addSheetFromData = (workbook: InstanceType<typeof ExcelJS.Workbook>, sheetData: (string | null)[][], sheetName: string) => {
    const ws = workbook.addWorksheet(sheetName);
    populateSheet(ws, sheetData);

    // Calculate column widths from content
    const maxColWidths = sheetData.reduce(
      (acc, row) => {
        row.forEach((cell, i) => {
          const cellText = cell ? cell.toString() : "";
          const cellLength = cellText.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
          acc[i] = Math.max(acc[i] || 0, cellLength);
        });
        return acc;
      },
      Array(7).fill(0)
    );

    for (let i = 0; i < 7; i++) {
      ws.getColumn(i + 1).width = maxColWidths[i] + 2;
    }

    if (sheetData.length > 0) {
      ws.mergeCells("A1:G1");
    }
  };

  const workbook = new ExcelJS.Workbook();

  if (range === "year" || range === "quarter") {
    const monthsInPeriod = eachMonthOfInterval({ start: startDate, end: endDate });
    for (const month of monthsInPeriod) {
      const sheetData = generateSheetData(month);
      addSheetFromData(workbook, sheetData, format(month, "MMM yyyy"));
    }
  } else {
    const sheetData = generateSheetData(currentDate);
    addSheetFromData(workbook, sheetData, format(currentDate, "MMMM yyyy"));
  }

  await saveWorkbook(workbook, `personal-calendar-${range}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
};
