/**
 * Shared Brevo (Sendinblue) transactional email sender. Returns the raw
 * Response so callers keep their existing error handling; adds a hard
 * timeout so a hung Brevo call can't stall a function invocation.
 */
const BREVO_SMTP_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export async function sendBrevoEmail(
  apiKey: string,
  payload: unknown,
  options: { timeoutMs?: number } = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(BREVO_SMTP_ENDPOINT, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
