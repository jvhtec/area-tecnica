export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Keeps only truthy entries, dropping `null | undefined | false | 0 | ''` from the type.
 *
 * `Array.prototype.filter(Boolean)` does not narrow in TypeScript, which matters under
 * `strictNullChecks` and for rows built with the `cond && [...]` idiom.
 */
export const isTruthy = <T>(value: T): value is Exclude<T, null | undefined | false | 0 | ''> =>
  Boolean(value);

/** Keeps only entries that are neither `null` nor `undefined`. */
export const isPresent = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;
