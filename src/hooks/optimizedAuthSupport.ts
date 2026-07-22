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

export const VALID_USER_ROLES = new Set<UserRole>([
  "admin",
  "management",
  "logistics",
  "technician",
  "house_tech",
  "wallboard",
  "oscar",
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
