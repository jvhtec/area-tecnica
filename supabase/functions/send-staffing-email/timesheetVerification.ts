/**
 * A failed or incomplete DB lookup must never be interpreted as "no booking".
 * The caller alone decides how to surface the retryable failure.
 */
export type TimesheetVerification<T> =
  | { kind: "unavailable" }
  | { kind: "clear" }
  | { kind: "conflict"; rows: T[] };

export function classifyTimesheetVerification<T>(
  rows: T[] | null | undefined,
  error: unknown,
): TimesheetVerification<T> {
  if (error || !Array.isArray(rows)) return { kind: "unavailable" };
  if (rows.length === 0) return { kind: "clear" };
  return { kind: "conflict", rows };
}
