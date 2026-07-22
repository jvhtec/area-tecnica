/* eslint-disable @typescript-eslint/no-explicit-any */
import { isValid } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

import { labelForCode } from "@/utils/roles";

export interface EnhancedJobDetailsModalProps {
  theme: {
    bg: string;
    card: string;
    textMain: string;
    textMuted: string;
    divider: string;
    accent: string;
    modalOverlay: string;
  };
  isDark: boolean;
  job: any;
  onClose: () => void;
  userRole?: string | null;
  userDepartment?: string | null;
  userId: string | null;
}

export type TabId = "Info" | "Ubicación" | "Personal" | "Docs" | "Restau." | "Clima" | "Tarifas" | "Extras";

export interface StaffAssignment {
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  technician: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    department?: string | null;
    profile_picture_url?: string | null;
  } | null;
}

export const buildEnhancedJobTabs = (showTourRates: boolean, showExtras: boolean): Array<{ id: TabId; label: string }> => {
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "Info", label: "Info" },
    { id: "Ubicación", label: "Ubicación" },
    { id: "Personal", label: "Personal" },
    { id: "Docs", label: "Docs" },
    { id: "Restau.", label: "Restau." },
    { id: "Clima", label: "Clima" },
  ];
  if (showTourRates) tabs.push({ id: "Tarifas", label: "Tarifas" });
  if (showExtras) tabs.push({ id: "Extras", label: "Extras" });
  return tabs;
};

export const getAssignmentDepartment = (assignment: StaffAssignment): string => {
  if (assignment.sound_role) return "sound";
  if (assignment.lights_role) return "lights";
  if (assignment.video_role) return "video";
  return "unknown";
};

export const getAssignmentRole = (assignment: StaffAssignment): string => {
  const role = assignment.sound_role || assignment.lights_role || assignment.video_role;
  return role ? (labelForCode(role) || role) : "Técnico";
};

export const getWeatherIcon = (condition: string): string => {
  const normalized = condition.toLowerCase();
  if (normalized.includes("sun")) return "☀️";
  if (normalized.includes("cloud")) return "☁️";
  if (normalized.includes("rain")) return "🌧️";
  if (normalized.includes("snow")) return "❄️";
  if (normalized.includes("storm")) return "⛈️";
  return "🌤️";
};

export const formatWeatherDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString("es-ES", { month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
};

const MADRID_TIMEZONE = "Europe/Madrid";
const UNAVAILABLE_DATE = "Fecha no disponible";

const formatMadridDate = (value: string | null | undefined, pattern: string): string => {
  if (!value) return UNAVAILABLE_DATE;
  const date = new Date(value);
  if (!isValid(date)) return UNAVAILABLE_DATE;

  try {
    return formatInTimeZone(date, MADRID_TIMEZONE, pattern, { locale: es });
  } catch {
    return UNAVAILABLE_DATE;
  }
};

export const formatJobDate = (value?: string | null): string =>
  formatMadridDate(value, "d 'de' MMMM 'de' yyyy 'a las' HH:mm");

export const formatDocumentUploadDate = (value: string): string =>
  formatMadridDate(value, "d 'de' MMMM 'de' yyyy");
