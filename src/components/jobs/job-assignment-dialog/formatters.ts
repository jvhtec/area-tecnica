import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

import type { DirectJobAssignment } from "@/hooks/useDirectJobAssignments";

const DEFAULT_JOB_TIME_ZONE = "Europe/Madrid";

export function formatAssignmentTechnicianName(
  assignment: Pick<DirectJobAssignment, "profiles">,
): string {
  if (!assignment.profiles) return "Unknown Technician";

  const firstName = assignment.profiles.first_name || "";
  const lastName = assignment.profiles.last_name || "";
  return `${firstName} ${lastName}`.trim() || "Unnamed Technician";
}

export function formatJobDateLabel(date: string | null | undefined): string {
  if (!date) return "";

  try {
    const dateKey = date.includes("T")
      ? formatInTimeZone(new Date(date), DEFAULT_JOB_TIME_ZONE, "yyyy-MM-dd")
      : date;
    const madridDate = fromZonedTime(`${dateKey}T00:00:00`, DEFAULT_JOB_TIME_ZONE);

    return formatInTimeZone(
      madridDate,
      DEFAULT_JOB_TIME_ZONE,
      "EEEE, d 'de' MMMM 'de' yyyy",
      { locale: es },
    );
  } catch (error) {
    console.warn("Failed to format job date", error);
    return date;
  }
}

export function formatDepartmentName(department: string): string {
  const names: Record<string, string> = {
    sound: "Sonido",
    lights: "Luces",
    video: "Video",
  };

  return names[department.toLowerCase()] || department;
}
