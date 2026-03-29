/**
 * Resolves the Flex API auth token for a given user.
 *
 * If the user has a personal `flex_api_key` in their profile, that key is
 * returned. Otherwise falls back to the global `X_AUTH_TOKEN` env var.
 *
 * This distributes Flex API calls across multiple keys so a single key
 * doesn't hit the 2000-calls/hour rate limit under heavy load.
 */

type SupabaseFrom = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        single: () => Promise<{ data: { flex_api_key?: string } | null; error: unknown }>;
      };
    };
  };
};

/**
 * Resolve the Flex API auth token, preferring a per-user key and falling back to a global environment token.
 *
 * @param userId - User identifier used to look up a per-user `flex_api_key`; if `null`, the per-user lookup is skipped
 * @returns The resolved Flex API auth token string
 * @throws Error if neither `X_AUTH_TOKEN` nor `FLEX_X_AUTH_TOKEN` is set in the environment
 */
export async function resolveFlexAuthToken(
  supabase: SupabaseFrom,
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
    Deno.env.get('FLEX_X_AUTH_TOKEN');

  if (!globalToken) {
    throw new Error('No Flex API token configured. Set X_AUTH_TOKEN or FLEX_X_AUTH_TOKEN environment variable.');
  }

  return globalToken;
}
