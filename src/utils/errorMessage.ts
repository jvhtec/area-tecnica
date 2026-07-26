type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function toText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function stringifySafe(value: unknown): string {
  try {
    const seen = new WeakSet<object>();
    const serialized = JSON.stringify(value, (_key, current) => {
      if (typeof current === 'object' && current !== null) {
        if (seen.has(current)) return '[Circular]';
        seen.add(current);
      }
      return current;
    });

    if (serialized && serialized !== '{}' && serialized !== '[]') {
      return serialized;
    }
  } catch {
    // Fall through to String(value)
  }

  try {
    const text = String(value);
    if (text && text !== '[object Object]') return text;
  } catch {
    // Some thrown values have no prototype or define a throwing toString().
  }

  return 'Unexpected error';
}

function uniqueParts(parts: Array<string | null>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const part of parts) {
    if (!part) continue;
    if (seen.has(part)) continue;
    seen.add(part);
    output.push(part);
  }

  return output;
}

/**
 * Convert unknown runtime errors (including Supabase/PostgREST objects)
 * into deterministic, user-readable strings.
 */
export function getErrorMessage(error: unknown, fallback = 'Unexpected error'): string {
  if (error instanceof Error) {
    const msg = toText(error.message);
    const specificName = error.name === 'Error' ? null : toText(error.name);
    return msg ?? specificName ?? fallback;
  }

  if (Array.isArray(error)) {
    const nested = uniqueParts(error.map((item) => getErrorMessage(item, fallback)));
    return nested.length > 0 ? nested.join('; ') : fallback;
  }

  if (isRecord(error)) {
    const message = toText(error.message) ?? toText(error.error_description) ?? toText(error.error);
    const details = toText(error.details);
    const hint = toText(error.hint);
    const code = toText(error.code);

    const combined = uniqueParts([
      message,
      details,
      hint ? `Hint: ${hint}` : null,
      code ? `Code: ${code}` : null,
    ]);

    if (combined.length > 0) {
      return combined.join(' — ');
    }
  }

  const direct = toText(error);
  if (direct) return direct;
  const serialized = stringifySafe(error);
  return serialized === 'Unexpected error' ? fallback : serialized;
}


/**
 * Reads the `name` of an unknown thrown value — used to branch on well-known
 * `Error`/`DOMException` names such as 'AbortError' or 'NotSupportedError'.
 */
export function getErrorName(error: unknown): string | undefined {
  if (error instanceof Error) return error.name;
  if (isRecord(error)) {
    const name = toText(error.name);
    if (name) return name;
  }
  return undefined;
}

/** Reads the stack of an unknown thrown value, for diagnostic logging only. */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack;
  if (isRecord(error)) {
    const stack = toText(error.stack);
    if (stack) return stack;
  }
  return undefined;
}

/**
 * Reads an HTTP-ish status off an unknown error — Supabase/PostgREST errors and
 * fetch wrappers both carry one, and retry policies branch on it.
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const status = error.status ?? error.statusCode;
  const numericStatus =
    typeof status === 'number'
      ? status
      : typeof status === 'string' && status.trim().length > 0
        ? Number(status)
        : Number.NaN;

  return Number.isInteger(numericStatus) && numericStatus >= 400 && numericStatus <= 599
    ? numericStatus
    : undefined;
}
