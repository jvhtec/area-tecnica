import type { Json } from "@/integrations/supabase/types";

/**
 * Converts a plain value into the Supabase `Json` type with `JSON.stringify`
 * semantics: object keys holding `undefined`, functions or symbols are dropped,
 * array slots holding them become `null`, non-finite numbers become `null` and
 * dates are serialized to ISO strings. Use it to send typed RPC payloads
 * without casting.
 */
export const toJsonValue = (value: unknown): Json => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => toJsonValue(entry));
  if (typeof value === "object") {
    const result: { [key: string]: Json } = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined || typeof entry === "function" || typeof entry === "symbol") continue;
      result[key] = toJsonValue(entry);
    }
    return result;
  }
  return null;
};
