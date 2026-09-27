import type { HojaStatus } from "@/features/hoja-de-ruta/model/HojaDocument";

export const shouldStopTransitionAfterSave = (
  currentStatus: HojaStatus,
  nextStatus: "review" | "approved" | "final",
  wasDirty: boolean,
) => currentStatus === "approved" && nextStatus === "final" && wasDirty;
