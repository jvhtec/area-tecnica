import type { LucideIcon } from "lucide-react";
import type { HojaDeRutaPdfSectionId } from "@/utils/hoja-de-ruta/pdf";

export type HojaDeRutaTabOption = {
  id: HojaDeRutaPdfSectionId;
  label: string;
  icon: LucideIcon;
  color: string;
};
