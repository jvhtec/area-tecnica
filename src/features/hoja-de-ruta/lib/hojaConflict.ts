/**
 * SQLSTATE the Hoja de Ruta / Tour Ops RPCs raise when a write was based on a
 * stale version. PostgREST maps `PTxxx` to HTTP status xxx and, unlike 40001
 * (serialization_failure), never retries it.
 */
export const HOJA_VERSION_CONFLICT_CODE = "PT409";

/** Raised by RPCs deployed before 20261015190000; kept so mixed deploys still show the conflict UI. */
const LEGACY_HOJA_VERSION_CONFLICT_CODE = "40001";

export const isHojaVersionConflict = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const { code } = error as { code?: unknown };
  return code === HOJA_VERSION_CONFLICT_CODE || code === LEGACY_HOJA_VERSION_CONFLICT_CODE;
};
