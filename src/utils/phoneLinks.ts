/**
 * Phone helpers for the contact shortcuts (call / WhatsApp) rendered next to a
 * person's number.
 *
 * The normalization mirrors `normalizePhone` in
 * `supabase/functions/send-job-whatsapp-message/index.ts` so a number that the
 * WhatsApp sender accepts also produces a working wa.me link in the UI. The
 * `/^[67]\d{8}$/` shortcut is deliberately Spain-only: profiles are filled in by
 * Spanish crew who routinely omit the country code.
 */

const DEFAULT_COUNTRY_CODE = "+34";

/**
 * Convert a free-text phone number into E.164 (`+34600111222`).
 * Returns null when the input cannot be read as a dialable number.
 */
export const normalizePhoneToE164 = (raw?: string | null): string | null => {
  if (!raw) return null;

  let digits = raw.trim().replace(/[\s\-()./]/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith("+")) {
    digits = /^[67]\d{8}$/.test(digits) ? `+34${digits}` : `${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  return /^\+\d{7,15}$/.test(digits) ? digits : null;
};

/** `tel:` href for a number, or null when the number is unusable. */
export const buildTelHref = (raw?: string | null): string | null => {
  const normalized = normalizePhoneToE164(raw);
  return normalized ? `tel:${normalized}` : null;
};

/**
 * wa.me link for a number, optionally prefilled with a message.
 * wa.me expects the E.164 number without the leading `+`.
 */
export const buildWhatsAppHref = (raw?: string | null, message?: string): string | null => {
  const normalized = normalizePhoneToE164(raw);
  if (!normalized) return null;

  const base = `https://wa.me/${normalized.slice(1)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};
