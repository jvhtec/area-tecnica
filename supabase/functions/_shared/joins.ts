/**
 * Helpers for PostgREST embedded resources.
 *
 * A `select('..., other(...)')` embed arrives as an object for a to-one relationship
 * but as an array for a to-many one, and PostgREST's choice depends on how it resolves
 * the relationship — which is easy to get wrong. Reading a column straight off the
 * array silently yields `undefined` rather than failing, so normalize first.
 */

/** Returns the single embedded row, taking the first element when PostgREST returned an array. */
export function joinedSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Returns the embedded rows as an array, wrapping a single object. */
export function joinedMany<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}
