const APP_ORIGIN = "https://sector-pro.invalid";

export function normalizeInternalPath(value: string | null | undefined): string | null {
  if (!value || value !== value.trim() || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null;

  try {
    const parsed = new URL(value, APP_ORIGIN);
    if (parsed.origin !== APP_ORIGIN || parsed.username || parsed.password) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function resolvePostAuthPath(
  returnTo: string | null | undefined,
  fallback: string,
): string {
  const normalized = normalizeInternalPath(returnTo);
  if (!normalized || normalized === "/" || normalized.startsWith("/auth")) return fallback;
  return normalized;
}
