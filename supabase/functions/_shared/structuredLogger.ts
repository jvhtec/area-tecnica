const SENSITIVE_KEY = /(?:authorization|body|content|cookie|device|email|endpoint|html|message|password|payload|phone|secret|token|url)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_QUERY = /([?&](?:key|sig|signature|token|code|secret)=)[^&#\s]+/gi;

export type SafeLogValue = string | number | boolean | null | undefined;
export type SafeLogFields = Record<string, SafeLogValue>;

export function redactLogFields(fields: SafeLogFields): Record<string, SafeLogValue> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (SENSITIVE_KEY.test(key)) return [key, "[REDACTED]"];
    if (typeof value !== "string") return [key, value];
    return [key, value.replace(EMAIL, "[REDACTED_EMAIL]").replace(URL_QUERY, "$1[REDACTED]").slice(0, 500)];
  }));
}

export function logEvent(
  level: "info" | "warn" | "error",
  event: string,
  fields: SafeLogFields = {},
): void {
  const record = JSON.stringify({ event, ...redactLogFields(fields) });
  console[level](record);
}
