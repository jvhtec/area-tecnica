import { format } from "date-fns";
import { es } from "date-fns/locale";

import { JOB_TYPE_LABELS } from "./constants";

export const getJobTypeLabel = (jobType?: string | null) =>
  jobType ? JOB_TYPE_LABELS[jobType] ?? "Un solo día" : "Un solo día";

export const formatShiftTime = (value?: string | null): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length >= 5 && trimmed.includes(":")) return trimmed.slice(0, 5);
  return trimmed;
};

export const formatDateTimeLabel = (value?: string | null): string => {
  if (!value) return "Pendiente";

  const trimmed = value.trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }

  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, "d 'de' MMM yyyy, HH:mm", { locale: es });
  } catch {
    return value;
  }
};

export const formatTransportCategory = (category: string): string => {
  return category.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getTravelTransportTypeLabel = (type?: string | null): string => {
  const labels: Record<string, string> = {
    van: "Furgoneta",
    autobus: "Autobús",
    sleeper_bus: "Autobús cama",
    train: "Tren",
    plane: "Avión",
    rv: "Autocaravana",
    RV: "Autocaravana",
    bus: "Autobús",
  };
  if (!type) return "Transporte";
  return labels[type] || formatTransportCategory(type);
};

export const getLogisticsTransportTypeLabel = (type?: string | null): string => {
  const labels: Record<string, string> = {
    trailer: "Tráiler",
    "9m": "Camión 9m",
    "8m": "Camión 8m",
    "6m": "Camión 6m",
    "4m": "Camión 4m",
    furgoneta: "Furgoneta",
    rv: "Autocaravana",
  };
  if (!type) return "Transporte";
  return labels[type] || formatTransportCategory(type);
};

export const formatCompanyLabel = (company?: string | null): string => {
  if (!company) return "Pendiente";
  const labels: Record<string, string> = {
    pantoja: "Pantoja",
    transluminaria: "Transluminaria",
    transcamarena: "Transcamarena",
    camionaje: "Camionaje",
    sector_pro: "Sector Pro",
    other: "Otra",
    "wild tour": "Wild Tour",
  };
  return labels[company] || formatTransportCategory(company);
};

export const formatRoomTypeLabel = (roomType?: string | null): string => {
  const labels: Record<string, string> = {
    single: "Individual",
    double: "Doble",
    twin: "Twin",
    triple: "Triple",
  };
  if (!roomType) return "Habitación";
  return labels[roomType] || roomType;
};

export const getDateTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    travel: "Viaje",
    setup: "Montaje",
    rigging: "Rigging",
    show: "Show",
    off: "Descanso",
    rehearsal: "Ensayo",
  };
  return labels[type] || type;
};

export const getDateTypeBadgeClass = (type: string, isDark: boolean): string => {
  const colors: Record<string, string> = {
    travel: isDark ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-blue-100 text-blue-700 border-blue-200",
    setup: isDark ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "bg-purple-100 text-purple-700 border-purple-200",
    rigging: isDark ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-orange-100 text-orange-700 border-orange-200",
    show: isDark ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-100 text-emerald-700 border-emerald-200",
    off: isDark ? "bg-slate-500/20 text-slate-400 border-slate-500/30" : "bg-slate-100 text-slate-700 border-slate-200",
    rehearsal: isDark ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-amber-100 text-amber-700 border-amber-200",
  };
  return colors[type] || (isDark ? "bg-slate-500/20 text-slate-400 border-slate-500/30" : "bg-slate-100 text-slate-700 border-slate-200");
};

export const isUuidLike = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
