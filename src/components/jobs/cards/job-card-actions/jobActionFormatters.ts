import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import {
  MADRID_TIME_ZONE,
  type JobCardJob,
  type JobCardLocation,
} from "@/components/jobs/cards/job-card-actions/types";

export const resolveJobLocation = (job: JobCardJob): string => {
  const pick = (loc: JobCardLocation): string | null => {
    if (!loc || typeof loc !== "object") return null;
    const name = typeof loc.name === "string" ? loc.name.trim() : "";
    const addr = typeof loc.formatted_address === "string" ? loc.formatted_address.trim() : "";

    if (name && addr) {
      if (name.toLowerCase() === addr.toLowerCase()) return name;
      return `${name} — ${addr}`;
    }
    return name || addr || null;
  };

  const structured = pick(job?.location_data) || pick(job?.location);
  if (structured) return structured;

  if (typeof job?.location === "string" && job.location.trim()) return job.location.trim();

  return "sin ubicación";
};

export const resolveSuggestedCallTime = (job: JobCardJob): string => {
  try {
    if (!job?.start_time) return "";
    return formatInTimeZone(new Date(job.start_time), MADRID_TIME_ZONE, "HH:mm");
  } catch {
    return "";
  }
};

export const formatDateGroupLabel = (date: string): string => {
  try {
    return formatInTimeZone(fromZonedTime(`${date}T00:00:00`, MADRID_TIME_ZONE), MADRID_TIME_ZONE, "dd/MM/yyyy");
  } catch {
    return date;
  }
};

export const buildProductionWhatsappTemplate = (
  job: JobCardJob,
  opts: { groupKey: string; callTime: string }
): string => {
  const jobName = job?.title || job?.name || job?.job_name || "Trabajo";
  const location = resolveJobLocation(job);

  let dateLabel = "";
  if (opts.groupKey === "all") {
    if (job?.start_time && job?.end_time) {
      dateLabel = `${formatInTimeZone(new Date(job.start_time), MADRID_TIME_ZONE, "dd/MM/yyyy")} – ${formatInTimeZone(new Date(job.end_time), MADRID_TIME_ZONE, "dd/MM/yyyy")}`;
    } else if (job?.start_time) {
      dateLabel = `${formatInTimeZone(new Date(job.start_time), MADRID_TIME_ZONE, "dd/MM/yyyy")}`;
    }
  } else if (opts.groupKey.startsWith("day:")) {
    const date = opts.groupKey.replace(/^day:/, "");
    dateLabel = formatDateGroupLabel(date);
  }

  const lines = [
    "Buenas,",
    "",
    `Para el trabajo “${jobName}”:`,
    "",
    `• Ubicación: ${location}`,
    dateLabel ? `• Fecha(s): ${dateLabel}` : undefined,
    `• Hora de citación (REVISAR): ${opts.callTime || "—"}`,
    "",
    "Si alguien llega más tarde / necesita algo, que me diga por aquí.",
    "Gracias.",
  ].filter(Boolean);

  return lines.join("\n");
};
