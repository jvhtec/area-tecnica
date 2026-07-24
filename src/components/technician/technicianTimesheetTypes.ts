import type { Timesheet } from "@/types/timesheet";
import type { Theme } from "./types";

interface TimesheetJobLocation {
  name?: string | null;
  formatted_address?: string | null;
}

export interface TimesheetJobInfo {
  id: string;
  title?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  timezone?: string | null;
  location?: TimesheetJobLocation | null;
}

export interface TechnicianTimesheetViewProps {
  theme: Theme;
  isDark: boolean;
  job: TimesheetJobInfo | null;
  onClose: () => void;
  userRole: string | null;
  userId: string | null;
}

export const calculateHours = (
  startTime: string,
  endTime: string,
  breakMinutes: number,
  endsNextDay?: boolean,
) => {
  if (!startTime || !endTime) return 0;
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  let diffMs = end.getTime() - start.getTime();
  if (endsNextDay || diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
  return Math.max(0, diffMs / (1000 * 60 * 60) - breakMinutes / 60);
};

export const getStatusBadge = (status: string, isDark: boolean) => {
  switch (status) {
    case "draft":
      return { bg: isDark ? "bg-gray-500/20" : "bg-slate-100", text: isDark ? "text-gray-400" : "text-slate-600", label: "Borrador" };
    case "submitted":
      return { bg: "bg-amber-500/20", text: "text-amber-500", label: "Pendiente" };
    case "approved":
      return { bg: "bg-emerald-500/20", text: "text-emerald-500", label: "Aprobado" };
    case "rejected":
      return { bg: "bg-red-500/20", text: "text-red-500", label: "Rechazado" };
    default:
      return { bg: isDark ? "bg-gray-500/20" : "bg-slate-100", text: isDark ? "text-gray-400" : "text-slate-600", label: status };
  }
};

export const SENDABLE_TIMESHEET_STATUSES: ReadonlyArray<Timesheet["status"]> = ["draft", "rejected"];
