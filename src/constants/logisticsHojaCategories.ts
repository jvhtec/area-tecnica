export const LOGISTICS_HOJA_CATEGORY_OPTIONS = [
  "sonido_madera",
  "sonido_escenario",
  "iluminacion_hierro",
  "iluminacion_aparatos",
  "video",
  "rigging_motores",
] as const;

export type LogisticsHojaCategory = (typeof LOGISTICS_HOJA_CATEGORY_OPTIONS)[number];

export const LOGISTICS_HOJA_CATEGORY_MAX_SELECTION = 3;

export const LOGISTICS_HOJA_CATEGORY_LABELS: Record<LogisticsHojaCategory, string> = {
  sonido_madera: "Sonido -- Madera",
  sonido_escenario: "Sonido - Escenario",
  iluminacion_hierro: "Iluminacion - Hierro",
  iluminacion_aparatos: "Iluminacion - Aparatos",
  video: "Video",
  rigging_motores: "Rigging (Motores)",
};

export const formatLogisticsHojaCategories = (categories?: string[] | null): string =>
  (categories || [])
    .map((category) =>
      LOGISTICS_HOJA_CATEGORY_LABELS[category as LogisticsHojaCategory] || category
    )
    .join(", ");
