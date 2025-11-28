import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Briefcase,
  CalendarOff,
  Printer,
  Home,
  Palmtree,
  Plane,
  Stethoscope,
  AlertTriangle,
  Volume2,
  Lightbulb,
  Truck
} from "lucide-react";
import { PrintDialog, PrintSettings } from "@/components/dashboard/PrintDialog";
import { format, addDays, subDays, isToday, isSameDay, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { TechContextMenu } from "./TechContextMenu";
import { usePersonalCalendarData } from "./hooks/usePersonalCalendarData";
import { useTechnicianAvailability } from "./hooks/useTechnicianAvailability";
import { TechDetailModal } from "./TechDetailModal";
import { Theme } from "@/components/technician/types";

interface MobilePersonalCalendarProps {
  date: Date;
  onDateSelect: (date: Date) => void;
  readOnly?: boolean;
  theme: Theme;
  isDark: boolean;
}

export const MobilePersonalCalendar: React.FC<MobilePersonalCalendarProps> = ({
  date,
  onDateSelect,
  readOnly = false,
  theme,
  isDark
}) => {
  const [currentDate, setCurrentDate] = useState(date);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'warehouse' | 'job' | 'off'>('all');
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    jobTypes: {
      tourdate: true,
      tour: true,
      single: true,
      dryhire: true,
      festival: true,
    },
  });

  // Modal state for showing assignment/job details like desktop
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState<any | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any | undefined>(undefined);
  const [selectedAvailability, setSelectedAvailability] = useState<
    'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse' | 'unavailable' | null
  >(null);

  useEffect(() => {
    setCurrentDate(date);
  }, [date]);

  const { houseTechs, assignments, isLoading } = usePersonalCalendarData(currentDate);
  const {
    updateAvailability,
    removeAvailability,
    getAvailabilityStatus,
    isLoading: isAvailabilityLoading
  } = useTechnicianAvailability(currentDate);

  const getAssignmentsForDate = useCallback((targetDate: Date) => {
    return assignments.filter(assignment => {
      // Check if this is a single-day assignment (legacy/fallback)
      if (assignment.single_day && assignment.assignment_date) {
        const assignmentDate = new Date(assignment.assignment_date);
        return isSameDay(targetDate, assignmentDate);
      }

      // Check specific dates from timesheets if available
      if (assignment.dates && assignment.dates.length > 0) {
        const dayString = format(targetDate, 'yyyy-MM-dd');
        return assignment.dates.includes(dayString);
      }

      // No fallback - if there are no specific timesheet dates, don't show the assignment
      // This prevents showing techs assigned to the whole job span when they only worked specific days
      return false;
    });
  }, [assignments]);

  const currentDateAssignments = getAssignmentsForDate(currentDate);

  const navigateToPrevious = () => {
    const newDate = subDays(currentDate, 1);
    setCurrentDate(newDate);
    onDateSelect(newDate);
  };

  const navigateToNext = () => {
    const newDate = addDays(currentDate, 1);
    setCurrentDate(newDate);
    onDateSelect(newDate);
  };

  const navigateToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onDateSelect(today);
  };

  const handleAvailabilityChange = (techId: string, status: 'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse' | 'unavailable', targetDate: Date) => {
    updateAvailability(techId, status, targetDate);
  };

  const handleAvailabilityRemove = (techId: string, targetDate: Date) => {
    removeAvailability(techId, targetDate);
  };

  const isWeekend = (day: Date) => {
    const dayOfWeek = day.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  const shouldShowTechOnDay = (tech: any, day: Date) => {
    // Apply department filter if selected
    if (selectedDepartment && (String(tech.department || '').trim() !== selectedDepartment)) {
      return false;
    }

    const dayAssignments = getAssignmentsForDate(day);
    const hasAssignment = dayAssignments.some(
      assignment => assignment.technician_id === tech.id
    );
    const availabilityStatus = getAvailabilityStatus(tech.id, day);

    // If it's a weekend and no assignment and not marked unavailable, don't show
    if (isWeekend(day) && !hasAssignment && !availabilityStatus) {
      return false;
    }

    return true;
  };

  const dayAssignments = useMemo(() => getAssignmentsForDate(currentDate), [getAssignmentsForDate, currentDate]);

  const openDetail = (tech: any) => {
    const dayAssignments = getAssignmentsForDate(currentDate);
    const techAssignment = dayAssignments.find(
      (assignment) => assignment.technician_id === tech.id
    );
    const availabilityStatus = getAvailabilityStatus(tech.id, currentDate);
    setSelectedTech(tech);
    setSelectedAssignment(techAssignment);
    setSelectedAvailability(availabilityStatus || null);
    setDetailOpen(true);
  };

  // Personnel summary for selected date
  const getPersonnelSummary = () => {
    const targetDate = currentDate;
    const targetAssignments = getAssignmentsForDate(targetDate);

    const departmentSummary = houseTechs.reduce((acc, tech) => {
      const dept = tech.department || 'Desconocido';
      if (!acc[dept]) {
        acc[dept] = {
          total: 0,
          assignedAndAvailable: 0,
          assignedButUnavailable: 0,
          unavailable: 0,
          availableAndNotInWarehouse: 0,
        };
      }
      acc[dept].total++;

      const hasAssignment = targetAssignments.some(
        assignment => assignment.technician_id === tech.id
      );
      const availabilityStatus = getAvailabilityStatus(tech.id, targetDate);
      const isUnavailable = !!availabilityStatus;

      if (isUnavailable) {
        acc[dept].unavailable++;
      }

      // Handle warehouse override logic like in totals
      if (availabilityStatus === 'warehouse') {
        // Warehouse override - count as warehouse, not on job even if assigned
        acc[dept].availableAndNotInWarehouse++;
      } else if (hasAssignment) {
        if (!isUnavailable) {
          acc[dept].assignedAndAvailable++;
        } else {
          acc[dept].assignedButUnavailable++;
        }
      } else {
        if (!isUnavailable) {
          acc[dept].availableAndNotInWarehouse++;
        }
      }

      return acc;
    }, {} as Record<string, {
      total: number;
      assignedAndAvailable: number;
      assignedButUnavailable: number;
      unavailable: number;
      availableAndNotInWarehouse: number;
    }>);

    return departmentSummary;
  };

  const getPersonnelTotals = () => {
    const targetDate = currentDate;
    const targetAssignments = getAssignmentsForDate(targetDate);

    let techsInWarehouse = 0;
    let techsOnJobs = 0;
    let techsOnVacation = 0;
    let techsOnDaysOff = 0;
    let techsTravelling = 0;
    let techsSick = 0;

    houseTechs.forEach(tech => {
      const hasAssignment = targetAssignments.some(
        assignment => assignment.technician_id === tech.id
      );
      const availabilityStatus = getAvailabilityStatus(tech.id, targetDate);
      const isUnavailable = !!availabilityStatus;

      // Count warehouse overrides separately
      if (availabilityStatus === 'warehouse') {
        techsInWarehouse++;
      } else if (!hasAssignment && !isUnavailable) {
        // Default warehouse (available but not assigned)
        techsInWarehouse++;
      }

      if (hasAssignment && availabilityStatus !== 'warehouse') {
        techsOnJobs++;
      }

      if (availabilityStatus === 'vacation') {
        techsOnVacation++;
      } else if (availabilityStatus === 'day_off') {
        techsOnDaysOff++;
      } else if (availabilityStatus === 'travel') {
        techsTravelling++;
      } else if (availabilityStatus === 'sick') {
        techsSick++;
      }
    });

    return {
      techsInWarehouse,
      techsOnJobs,
      techsOnVacation,
      techsOnDaysOff,
      techsTravelling,
      techsSick,
    };
  };

  const personnelSummary = getPersonnelSummary();
  const personnelTotals = getPersonnelTotals();

  const visibleTechs = houseTechs.filter(tech => shouldShowTechOnDay(tech, currentDate));
  const offTotal = personnelTotals.techsOnVacation + personnelTotals.techsOnDaysOff + personnelTotals.techsTravelling + personnelTotals.techsSick;

  const getStatusMeta = (tech: any) => {
    const techAssignment = dayAssignments.find(
      assignment => assignment.technician_id === tech.id
    );

    const availabilityStatus = getAvailabilityStatus(tech.id, currentDate);

    if (availabilityStatus === 'vacation') {
      return {
        key: 'off' as const,
        label: 'Vacation',
        badgeClass: 'bg-amber-500/15 text-amber-700 border border-amber-200',
        Icon: Palmtree,
        jobTitle: undefined
      };
    }

    if (availabilityStatus === 'day_off') {
      return {
        key: 'off' as const,
        label: 'Day off',
        badgeClass: 'bg-amber-500/15 text-amber-700 border border-amber-200',
        Icon: CalendarOff,
        jobTitle: undefined
      };
    }

    if (availabilityStatus === 'travel') {
      return {
        key: 'off' as const,
        label: 'Travel',
        badgeClass: 'bg-blue-500/15 text-blue-700 border border-blue-200',
        Icon: Plane,
        jobTitle: undefined
      };
    }

    if (availabilityStatus === 'sick') {
      return {
        key: 'off' as const,
        label: 'Sick day',
        badgeClass: 'bg-red-500/15 text-red-700 border border-red-200',
        Icon: Stethoscope,
        jobTitle: undefined
      };
    }

    if (availabilityStatus === 'unavailable') {
      return {
        key: 'off' as const,
        label: 'Unavailable',
        badgeClass: 'bg-red-500/10 text-red-700 border border-red-200',
        Icon: AlertTriangle,
        jobTitle: undefined
      };
    }

    if (availabilityStatus === 'warehouse') {
      return {
        key: 'warehouse' as const,
        label: 'Warehouse override',
        badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
        Icon: Home,
        jobTitle: undefined
      };
    }

    if (techAssignment) {
      const locationSuffix = techAssignment.job.location?.name ? ` • ${techAssignment.job.location.name}` : '';
      return {
        key: 'job' as const,
        label: 'On job',
        badgeClass: 'bg-emerald-500/15 text-emerald-700 border border-emerald-200',
        Icon: Briefcase,
        jobTitle: `${techAssignment.job.title}${locationSuffix}`
      };
    }

    return {
      key: 'warehouse' as const,
      label: 'Warehouse',
      badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
      Icon: Home,
      jobTitle: undefined
    };
  };

  const filteredTechs = visibleTechs.filter(tech => {
    const statusMeta = getStatusMeta(tech);
    if (statusFilter === 'all') return true;
    if (statusFilter === 'off') return statusMeta.key === 'off';
    return statusMeta.key === statusFilter;
  });

  const generatePDF = (range: "month" | "quarter" | "year") => {
    console.log("PDF móvil para técnicos de planta no implementado para", range);
    setShowPrintDialog(false);
  };

  const generateXLS = (range: "month" | "quarter" | "year") => {
    console.log("XLS móvil para técnicos de planta no implementado para", range);
    setShowPrintDialog(false);
  };

  if (isLoading || isAvailabilityLoading) {
    return (
      <Card className={`h-full flex flex-col ${theme.card}`}>
        <CardContent className="flex-grow p-4 flex items-center justify-center">
          <div className={theme.textMuted}>Cargando calendario...</div>
        </CardContent>
      </Card>
    );
  }

  if (houseTechs.length === 0) {
    return (
      <Card className={`h-full flex flex-col ${theme.card}`}>
        <CardHeader className="pb-4">
          <CardTitle className={`text-lg font-bold ${theme.textMain}`}>Técnicos de planta</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow p-4 flex flex-col items-center justify-center text-center">
          <Users className={`h-8 w-8 mb-2 ${theme.textMuted}`} />
          <p className={theme.textMuted}>No se encontraron técnicos de planta</p>
          <p className={`text-sm mt-1 ${theme.textMuted}`}>
            Asegúrate de que hay usuarios con el rol "house_tech"
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-[520px] mx-auto space-y-4">
      <div className={`rounded-2xl border px-4 py-3 space-y-3 ${theme.card}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-500">Fecha seleccionada</p>
            <div className={`flex items-center gap-2 text-sm font-semibold ${theme.textMain}`}>
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className={cn("", isToday(currentDate) && "text-blue-500")}>{format(currentDate, "EEE, MMM d")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={navigateToPrevious} aria-label="Día anterior" className={theme.textMain}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={navigateToNext} aria-label="Día siguiente" className={theme.textMain}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDepartment(null)}
            disabled={!selectedDepartment}
            className={`rounded-xl ${theme.card} ${theme.textMain}`}
          >
            <Users className="h-4 w-4 mr-2" />
            {selectedDepartment ? `${selectedDepartment}` : 'Todos los departamentos'}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-xl border px-3 py-2 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`flex items-center gap-1 text-[11px] uppercase font-semibold ${theme.textMuted}`}>
              <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
              En trabajo
            </div>
            <div className="text-xl font-bold text-emerald-600">{personnelTotals.techsOnJobs}</div>
          </div>
          <div className={`rounded-xl border px-3 py-2 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`flex items-center gap-1 text-[11px] uppercase font-semibold ${theme.textMuted}`}>
              <Home className="h-3.5 w-3.5" />
              Almacén
            </div>
            <div className={`text-xl font-bold ${theme.textMain}`}>{personnelTotals.techsInWarehouse}</div>
          </div>
          <div className={`rounded-xl border px-3 py-2 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`flex items-center gap-1 text-[11px] uppercase font-semibold ${theme.textMuted}`}>
              <Plane className="h-3.5 w-3.5 text-amber-600" />
              Fuera / Viaje
            </div>
            <div className="text-xl font-bold text-amber-600">{offTotal}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {Object.entries(personnelSummary).map(([department, stats]) => {
            const getDepartmentIcon = (dept: string) => {
              const lower = dept.toLowerCase();
              if (lower === 'sound') return <Volume2 className="h-4 w-4" />;
              if (lower === 'lights') return <Lightbulb className="h-4 w-4" />;
              if (lower === 'logistics') return <Truck className="h-4 w-4" />;
              return <Users className="h-4 w-4" />;
            };

            return (
              <button
                key={department}
                className={cn(
                  "px-3 py-2 rounded-xl border text-left text-xs font-semibold transition-colors flex-shrink-0",
                  selectedDepartment === department
                    ? "border-blue-500/70 bg-blue-500/5 text-blue-500"
                    : `${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'} ${theme.textMuted} hover:${theme.textMain}`
                )}
                onClick={() => setSelectedDepartment(prev => (prev === department ? null : department))}
              >
                <div className="flex items-center gap-1.5 capitalize">
                  {getDepartmentIcon(department)}
                  {department}
                </div>
                <div className={`text-[11px] ${theme.textMuted} mt-0.5`}>
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {stats.assignedAndAvailable}
                  </span>
                  {' • '}
                  <span className="inline-flex items-center gap-1">
                    <Home className="h-3 w-3" />
                    {stats.availableAndNotInWarehouse}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className={`grid grid-cols-4 gap-1 rounded-xl border p-1 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          {[
            { key: 'all' as const, label: 'Todos', count: visibleTechs.length },
            { key: 'job' as const, label: 'Asignados', count: personnelTotals.techsOnJobs },
            { key: 'warehouse' as const, label: 'Base', count: personnelTotals.techsInWarehouse },
            { key: 'off' as const, label: 'Fuera', count: offTotal }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors",
                statusFilter === tab.key ? `${theme.card} shadow-sm text-blue-500` : `${theme.textMuted} hover:${theme.textMain}`
              )}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] ${theme.textMuted}`}>{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filteredTechs.length > 0 ? (
          filteredTechs.map((tech) => {
            const statusMeta = getStatusMeta(tech);
            const techName = `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || "Técnico sin nombre";
            const initials = `${(tech.first_name?.[0] || '').toUpperCase()}${(tech.last_name?.[0] || '').toUpperCase()}` || 'HT';

            return (
              <TechContextMenu
                key={tech.id}
                technician={tech}
                date={currentDate}
                onAvailabilityChange={readOnly ? undefined : (techId, status, date) => handleAvailabilityChange(techId, status, date)}
                onAvailabilityRemove={readOnly ? undefined : handleAvailabilityRemove}
              >
                <div
                  className={`rounded-2xl border px-4 py-3 shadow-sm transition-colors hover:border-blue-500/50 cursor-pointer ${theme.card}`}
                  onClick={() => openDetail(tech)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-full text-sm font-semibold flex items-center justify-center uppercase ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'}`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold truncate ${theme.textMain}`}>{techName}</div>
                        {tech.department && (
                          <div className={`text-xs capitalize truncate ${theme.textMuted}`}>{tech.department}</div>
                        )}
                      </div>
                    </div>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold", statusMeta.badgeClass)}>
                      <statusMeta.Icon className="h-3 w-3" />
                      {statusMeta.label}
                    </span>
                  </div>

                  {statusMeta.jobTitle && (
                    <div className={`mt-2 text-xs line-clamp-1 ${theme.textMuted}`}>{statusMeta.jobTitle}</div>
                  )}
                </div>
              </TechContextMenu>
            );
          })
        ) : (
          <div className={`flex flex-col items-center justify-center py-10 text-center rounded-2xl border ${theme.card}`}>
            <Calendar className={`h-8 w-8 mb-2 ${theme.textMuted}`} />
            <p className={theme.textMuted}>No hay técnicos programados</p>
            <p className={`text-sm ${theme.textMuted}`}>para {format(currentDate, "MMMM d, yyyy")}</p>
          </div>
        )}
      </div>

      <PrintDialog
        showDialog={showPrintDialog}
        setShowDialog={setShowPrintDialog}
        printSettings={printSettings}
        setPrintSettings={setPrintSettings}
        generatePDF={generatePDF}
        generateXLS={generateXLS}
        currentMonth={currentDate}
        selectedJobTypes={[]}
      />

      {selectedTech && (
        <TechDetailModal
          open={detailOpen}
          onOpenChange={setDetailOpen}
          technician={selectedTech}
          assignment={selectedAssignment}
          date={currentDate}
          availabilityStatus={selectedAvailability}
          onAvailabilityChange={(techId, status, d) => handleAvailabilityChange(techId, status, d)}
          onAvailabilityRemove={(techId, d) => handleAvailabilityRemove(techId, d)}
        />
      )}
    </div>
  );
};
