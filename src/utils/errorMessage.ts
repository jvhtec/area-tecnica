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

  const text = String(value);
  if (text && text !== '[object Object]') return text;
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
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = toText(error.message);
    return msg ?? error.name ?? 'Unexpected error';
  }

  if (Array.isArray(error)) {
    const nested = uniqueParts(error.map((item) => getErrorMessage(item)));
    return nested.length > 0 ? nested.join('; ') : 'Unexpected error';
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
  return stringifySafe(error);
}

