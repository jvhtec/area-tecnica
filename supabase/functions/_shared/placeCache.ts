// Shared helpers for the persistent Places API cache (place_api_cache table).
//
// These keep paid Google Places usage under the free tier by ensuring repeated
// lookups for the same venue/query are served from the database instead of
// hitting Google again. All access uses the service role (RLS-bypassing).

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

/**
 * Returns the cached payload for `cacheKey`, or null on miss / expiry / error.
 * Cache failures are non-fatal: callers should fall back to the live API.
 */
export async function getCachedPayload<T = unknown>(
  supabase: SupabaseLike,
  cacheKey: string,
): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from("place_api_cache")
      .select("payload, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (error || !data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return null;
    }
    return data.payload as T;
  } catch (err) {
    console.warn("place cache read failed:", err);
    return null;
  }
}

/**
 * Upserts a payload into the cache. `ttlSeconds <= 0` stores it without expiry.
 * Failures are swallowed (caching is best-effort).
 */
export async function setCachedPayload(
  supabase: SupabaseLike,
  cacheKey: string,
  kind: string,
  payload: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    const expires_at = ttlSeconds > 0
      ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
      : null;

    const { error } = await supabase.from("place_api_cache").upsert({
      cache_key: cacheKey,
      kind,
      payload,
      created_at: new Date().toISOString(),
      expires_at,
    });
    if (error) {
      console.warn("place cache write failed:", error);
    }
  } catch (err) {
    console.warn("place cache write failed:", err);
  }
}
