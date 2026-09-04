/**
 * PostgREST embeds a to-one relation as an object for an unambiguous foreign key,
 * but some query shapes and offline payloads expose the same relation as an array.
 * Normalize both representations at the data boundary before reading fields.
 */
export function unwrapPostgrestRelation<T>(value: T | T[] | null | undefined): T | null;
export function unwrapPostgrestRelation(value: unknown): unknown {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
