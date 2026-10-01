import type { Session, User } from "@supabase/supabase-js";

import type { UserRole } from "@/types/user";

export type AuthUser = User & {
  department?: string | null;
};

export interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  nickname?: string;
  lastName: string;
  phone?: string;
  department?: string;
  dni?: string;
  residencia?: string;
}

export interface AuthContextType {
  session: Session | null;
  user: AuthUser | null;
  userRole: string | null;
  userDepartment: string | null;
  hasSoundVisionAccess: boolean;
  assignableAsTech: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isProfileLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (userData: SignUpData) => Promise<void>;
  createUserAsAdmin: (userData: Omit<SignUpData, "password"> & { role?: string; flex_resource_id?: string }) => Promise<{ id: string; email: string } | null>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
  setUserRole: (role: string | null) => void;
  setUserDepartment: (department: string | null) => void;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  clearCache: () => void;
  getCacheStatus: () => { hasCache: boolean; cacheAge: number; isValid: boolean };
}

export interface CachedProfile {
  role: string | null;
  department: string | null;
  soundVisionAccess?: boolean;
  assignableAsTech?: boolean;
  userId: string;
  timestamp: number;
}

export interface ProfileData {
  role: string | null;
  department: string | null;
  soundvision_access?: boolean | null;
  assignable_as_tech?: boolean | null;
}

export interface ProfileQueryResult {
  role: string | null;
  department: string | null;
  soundvision_access?: boolean;
  assignable_as_tech?: boolean;
}

export interface SupabaseErrorLike {
  message?: string;
  code?: string;
}

export const PROFILE_CACHE_KEY = "supabase_user_profile";
export const PROFILE_CACHE_DURATION = 30 * 60 * 1000;

/**
 * The cached profile for `userId`, if it is younger than PROFILE_CACHE_DURATION.
 * `allowStale` drops the age limit and is only for when the server cannot be
 * reached: the last profile the server returned for this same user beats having
 * no role at all, which the route guards turn into a redirect away from the
 * offline festival. The next online fetch replaces it.
 */
export function readCachedProfile(userId: string, allowStale = false, now: number = Date.now()): CachedProfile | null {
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) return null;
    const profile = JSON.parse(cached) as CachedProfile;
    const isExpired = now - profile.timestamp > PROFILE_CACHE_DURATION;
    return profile.userId === userId && (allowStale || !isExpired) ? profile : null;
  } catch (error) {
    console.error('Error reading profile cache:', error);
    return null;
  }
}

/** Stores the profile readCachedProfile serves back. */
export function writeCachedProfile(profile: Omit<CachedProfile, "timestamp">, now: number = Date.now()) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ ...profile, timestamp: now }));
  } catch (error) {
    console.error('Error caching profile:', error);
  }
}

/**
 * Whose role the provider has applied. A profile read for that same user is a
 * background refresh: it must not raise isProfileLoading, which the route
 * guards answer by swapping the whole page for a spinner (what users saw as a
 * reload on returning to a tab, when a token refresh refetched the profile),
 * and an empty result must not clear the role mid-session.
 */
export interface AppliedProfile {
  userId: string | null;
  role: string | null;
}

export const NO_APPLIED_PROFILE: AppliedProfile = { userId: null, role: null };

export const isBackgroundProfileRead = (applied: AppliedProfile, userId: string | null | undefined): boolean =>
  !!userId && applied.userId === userId && applied.role !== null;

/** Keeps the user object when a refreshed session carries the same, unchanged user. */
export const keepSameAuthUser = <U extends { id: string; updated_at?: string | null }>(previous: U | null, next: U | null): U | null =>
  previous && next && previous.id === next.id && previous.updated_at === next.updated_at ? previous : next;

export const VALID_USER_ROLES = new Set<UserRole>([
  "admin",
  "management",
  "logistics",
  "technician",
  "house_tech",
  "wallboard",
  "oscar",
  "conductor",
]);

export const getErrorMessage = (error: unknown, fallback = "Unknown error"): string =>
  error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : fallback;

export const getErrorCode = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;

export const getMetadataString = (metadata: Record<string, unknown>, key: string): string | null => {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};
