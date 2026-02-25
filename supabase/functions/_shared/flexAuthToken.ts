/**
 * Resolves the Flex API auth token for a given user.
 *
 * If the user has a personal `flex_api_key` in their profile, that key is
 * returned. Otherwise falls back to the global `X_AUTH_TOKEN` env var.
 *
 * This distributes Flex API calls across multiple keys so a single key
 * doesn't hit the 2000-calls/hour rate limit under heavy load.
 */
export async function resolveFlexAuthToken(
  supabase: { from: (table: string) => any },
  userId: string | null
): Promise<string> {
  // Try per-user key first
  if (userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('flex_api_key')
        .eq('id', userId)
        .single();

      if (data?.flex_api_key) {
        return data.flex_api_key;
      }
    } catch {
      // Ignore lookup errors, fall through to global key
    }
  }

  // Fallback to global environment variable
  const globalToken =
    Deno.env.get('X_AUTH_TOKEN') ||
    Deno.env.get('FLEX_X_AUTH_TOKEN') ||
    '';

  return globalToken;
}
