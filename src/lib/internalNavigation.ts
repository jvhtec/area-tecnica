const APP_ORIGIN = "https://sector-pro.invalid";

const hasForbiddenPathCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code <= 31 || code === 127;
  });

export function normalizeInternalPath(value: string | null | undefined): string | null {
  if (!value || value !== value.trim() || hasForbiddenPathCharacter(value)) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || hasForbiddenPathCharacter(decoded)) return null;

  try {
    const parsed = new URL(value, APP_ORIGIN);
    if (parsed.origin !== APP_ORIGIN || parsed.username || parsed.password) return null;
    const reconstructed = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    // A path like "/%2e%2e//outside.invalid" passes the pre-parse checks above
    // but can canonicalize to a protocol-relative "//outside.invalid" once the
    // URL parser resolves the encoded traversal. Reject it here too.
    if (reconstructed.startsWith("//")) return null;
    return reconstructed;
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
