import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { MADRID_TIMEZONE, utcToLocalInput } from "@/utils/timezoneUtils";
import type { TourGuestLink, TourOpsRoomAssignment } from "@/features/tour-ops/types";

export const EVENT_TYPE_OPTIONS = [
  "show",
  "rehearsal",
  "travel",
  "load_in",
  "show_call",
  "meeting",
  "day_off",
  "hotel",
  "note",
  "other",
];

export const TRANSPORT_OPTIONS = ["bus", "van", "plane", "train", "ferry", "truck", "personal"];

const dateOnlyAsMadridNoon = (value: string) => (value.includes("T") ? value : `${value}T12:00:00`);

export const formatDate = (value: string) =>
  formatInTimeZone(dateOnlyAsMadridNoon(value), MADRID_TIMEZONE, "EEE d MMM yyyy", { locale: es });

export const formatTime = (value?: string | null) => {
  if (!value) return "";
  if (value.includes("T")) {
    return formatInTimeZone(value, MADRID_TIMEZONE, "d MMM HH:mm", { locale: es });
  }
  return value.slice(0, 5);
};

export const dateTimeInputValue = (value?: string | null) => {
  if (!value) return "";
  if (!value.includes("T")) return value;
  try {
    return utcToLocalInput(value, MADRID_TIMEZONE);
  } catch {
    return "";
  }
};

export const finiteNumberOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const sourceLabel = (source?: string) =>
  source === "hoja" ? "Importado de hoja" : source === "legacy" ? "Heredado" : "Operaciones";

export const syncStatusLabel = (status?: string) => {
  switch (status) {
    case "synced":
      return "Sincronizado";
    case "needs_sync":
      return "Requiere sincronización";
    case "no_hoja":
      return "Sin hoja para la fecha";
    case "imported":
      return "Importado de hoja";
    case "legacy":
      return "Heredado";
    default:
      return "Requiere sincronización";
  }
};

export const syncStatusVariant = (
  status?: string,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "synced":
      return "default";
    case "needs_sync":
      return "destructive";
    case "imported":
      return "secondary";
    default:
      return "outline";
  }
};

export const hasTourHomeBase = (settings: Record<string, unknown>) => {
  const homeBase = settings.homeBase as { latitude?: unknown; longitude?: unknown } | undefined;
  return (
    homeBase?.latitude != null &&
    homeBase?.longitude != null &&
    Number.isFinite(Number(homeBase.latitude)) &&
    Number.isFinite(Number(homeBase.longitude))
  );
};

export const guestLinkUrl = (link: Pick<TourGuestLink, "token">) =>
  link.token && typeof window !== "undefined" ? `${window.location.origin}/tour-share/${link.token}` : null;

export const roomOccupants = (room: TourOpsRoomAssignment) =>
  [room.staffMember1Name || room.staffMember1Id, room.staffMember2Name || room.staffMember2Id]
    .filter(Boolean)
    .join(" / ");
