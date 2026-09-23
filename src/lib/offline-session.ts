import type { Session } from '@supabase/supabase-js';

/** Must match `storageKey` in src/lib/supabase-client.ts. */
export const AUTH_STORAGE_KEY = 'supabase.auth.token';

/**
 * Keeping a signed-in technician signed in without a connection.
 *
 * supabase-js turns an expired access token plus a *network* failure to refresh
 * it into `getSession() -> null` (and an INITIAL_SESSION event with no session),
 * although it deliberately keeps the session in storage for a later retry. Taken
 * at face value that looks like a sign-out: the app dropped the user to /auth,
 * where logging in is impossible offline, and the festival downloaded for the
 * venue became unreachable an hour after the last connection.
 *
 * A dead refresh token, by contrast, is removed from storage by supabase-js, and
 * signOut clears it too, so "no session returned but one is still stored" means
 * only that refreshing could not reach the server. That stored session is used
 * as-is until the network is back; supabase-js's auto-refresh then renews it
 * (TOKEN_REFRESHED) or, if it really is dead, removes it (SIGNED_OUT).
 */
export function readPersistedSession(storage: Pick<Storage, 'getItem'> | undefined = safeLocalStorage()): Session | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    if (
      !parsed
      || typeof parsed.access_token !== 'string'
      || typeof parsed.refresh_token !== 'string'
      || typeof parsed.user?.id !== 'string'
    ) {
      return null;
    }
    return parsed as Session;
  } catch {
    return null;
  }
}

/** True for failures that mean "could not reach the server", not "denied". */
export function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; message?: unknown; status?: unknown; code?: unknown };
  if (candidate.name === 'AuthRetryableFetchError') return true;
  if (typeof candidate.status === 'number' && candidate.status > 0) return false;
  if (typeof candidate.code === 'string' && candidate.code !== '') return false;
  return typeof candidate.message === 'string'
    && /(?:Failed to fetch|NetworkError when attempting to fetch resource|Load failed|Network request failed)/i.test(candidate.message);
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * `session` when supabase-js returned one; otherwise the stored session that
 * supabase-js kept because refreshing it failed on the network (see above).
 * Only for getSession() results and the INITIAL_SESSION event: after a real
 * sign-out the storage is already empty, so this returns null there too.
 */
export function sessionOrPersisted(session: Session | null): Session | null {
  return session ?? readPersistedSession();
}
