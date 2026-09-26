/**
 * Resolves the public app origin used for links sent in outbound
 * emails/WhatsApp messages (e.g. "Revisa y confirma aquí: <origin>/conductor").
 *
 * The app has moved hosting domains over time (most recently off the
 * `*.lovable.app` preview domain onto the production `sector-pro.work`
 * Cloudflare Pages domain — see CLAUDE.md's Deployment section). A stale
 * PUBLIC_APP_URL/SITE_URL/etc. secret left over from before that move can
 * silently keep pointing outbound links at a domain that no longer serves
 * the app, so any candidate resolving to a known-deprecated host is
 * rejected here rather than trusted.
 *
 * A second, distinct failure mode: PUBLIC_APP_URL/SITE_URL/etc. accidentally
 * set to the Supabase *project* URL (SUPABASE_URL) instead of the frontend's
 * own domain — the backend API was never meant to serve `/conductor` or any
 * other SPA route, so that candidate is rejected too, whether or not it
 * happens to match a known-deprecated suffix.
 */

/** Canonical production app origin — the safe default when nothing else applies. */
export const CANONICAL_APP_BASE = "https://sector-pro.work";

// Old/retired hosting domains that must never be used for outbound links,
// even if a stale env var still points at them. Add previous domains here
// as they're retired.
const DEPRECATED_HOST_SUFFIXES = [".lovable.app"];

// The Supabase backend is never a valid app origin: it serves the REST/Auth/
// Storage/Functions API, not the frontend SPA, so a candidate landing here
// (e.g. a SITE_URL secret set to the project URL by mistake) is rejected
// even though it's a live, correctly-spelled domain.
const SUPABASE_API_HOST_SUFFIXES = [".supabase.co", ".supabase.in", ".supabase.net", ".supabase.red"];

function isDeprecatedHost(host: string): boolean {
  const lower = host.toLowerCase();
  return DEPRECATED_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function isSupabaseApiHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (SUPABASE_API_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true;

  // Covers self-hosted/custom-domain Supabase deployments too: reject an
  // exact match against this project's own configured SUPABASE_URL host.
  const configuredApiUrl = Deno.env.get("SUPABASE_URL");
  if (!configuredApiUrl) return false;
  try {
    return lower === new URL(configuredApiUrl).host.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Normalizes an arbitrary URL/host string to `protocol//host`, returning
 * `null` if it's empty, unparsable, or resolves to a deprecated or
 * Supabase-API host.
 */
export function toSafeOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (isDeprecatedHost(url.host) || isSupabaseApiHost(url.host)) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Resolves the app origin from the usual env var candidates (in priority
 * order), skipping any that are unset or point at a deprecated domain.
 * Returns `undefined` (rather than a default) when none is configured, so
 * callers that want to fall back to the request's Origin/Referer first
 * (useful for previews/local dev) can still do so.
 */
export function resolveConfiguredAppBase(): string | undefined {
  const candidates = [
    Deno.env.get("PUBLIC_APP_URL"),
    Deno.env.get("PUBLIC_SITE_URL"),
    Deno.env.get("NEXT_PUBLIC_SITE_URL"),
    Deno.env.get("SITE_URL"),
    Deno.env.get("PUBLIC_CONFIRM_BASE"),
  ];
  for (const value of candidates) {
    const origin = toSafeOrigin(value);
    if (origin) return origin;
  }
  return undefined;
}

/**
 * Same as `resolveConfiguredAppBase()`, but falls back to
 * `CANONICAL_APP_BASE` instead of `undefined` when nothing is configured.
 * Use this when there's no request-origin fallback to try first.
 */
export function pickConfiguredAppBase(): string {
  return resolveConfiguredAppBase() ?? CANONICAL_APP_BASE;
}
