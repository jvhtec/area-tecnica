import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

const MADRID_TIME_ZONE = "Europe/Madrid";

export const formatMemoriaUploadDate = (uploadedAt: string): string => {
  try {
    return formatInTimeZone(uploadedAt, MADRID_TIME_ZONE, "dd/MM/yyyy", { locale: es });
  } catch {
    return "";
  }
};
