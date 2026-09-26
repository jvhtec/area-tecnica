import { trackError } from "@/lib/errorTracking";

const SAFE_OPERATION = /^[a-zA-Z][A-Za-z0-9.]{0,79}$/;
const SAFE_ERROR_CODE = /^(?:[0-9A-Z]{5}|PGRST\d{3})$/;
const reportedOperations = new Set<string>();

const readSafeErrorCode = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>).code;
  return typeof candidate === "string" && SAFE_ERROR_CODE.test(candidate)
    ? candidate
    : undefined;
};

/** Reports a Hoja de Ruta failure without retaining exception text or domain data. */
export const reportHojaError = (operation: string, error?: unknown): void => {
  const safeOperation = SAFE_OPERATION.test(operation) ? operation : "unknown";
  if (reportedOperations.has(safeOperation)) return;
  reportedOperations.add(safeOperation);

  const safeError = new Error("Hoja de Ruta operation failed");
  safeError.name = "HojaDeRutaError";
  const causeCode = readSafeErrorCode(error);

  void trackError(safeError, {
    system: "documents",
    operation: safeOperation,
    ...(causeCode ? { causeCode } : {}),
  });
};
