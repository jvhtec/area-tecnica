import type { HojaStatus } from "@/features/hoja-de-ruta/model/HojaDocument";

export const shouldStopTransitionAfterSave = (
  currentStatus: HojaStatus,
  nextStatus: "review" | "approved" | "final",
  wasDirty: boolean,
  isAdmin = false,
) => wasDirty && (
  (currentStatus === "approved" && nextStatus === "final")
  || (!isAdmin && currentStatus === "review" && nextStatus === "approved")
);
