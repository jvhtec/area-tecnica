import { type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

import { HttpError, requireBearerToken } from "./http.ts";

export const ADMIN_MANAGEMENT_ROLES = new Set(["admin", "management"]);

export interface AuthenticatedRoleCaller {
  userId: string;
  role: string;
  token: string;
  authorizationHeader: string;
  user: User;
}

export interface ForbiddenRoleContext {
  userId: string;
  role: string;
  user: User;
}

export interface RequireAuthenticatedRoleOptions {
  allowedRoles?: ReadonlySet<string> | readonly string[];
  logContext?: string;
  missingMessage?: string;
  missingCode?: string;
  invalidMessage?: string;
  invalidCode?: string;
  forbiddenMessage?: string;
  forbiddenCode?: string;
  onForbidden?: (context: ForbiddenRoleContext) => void | Promise<void>;
}

type ProfileRoleRow = {
  role?: unknown;
} | null;

const roleSet = (roles: ReadonlySet<string> | readonly string[]) =>
  new Set(Array.from(roles, (role) => role.toLowerCase()));

const normalizeRole = (role: unknown) =>
  typeof role === "string" ? role.toLowerCase() : "";

export async function requireAuthenticatedRole(
  supabase: SupabaseClient,
  req: Request,
  options: RequireAuthenticatedRoleOptions = {},
): Promise<AuthenticatedRoleCaller> {
  const token = requireBearerToken(req, {
    message: options.missingMessage ?? "Missing or malformed authorization header",
    code: options.missingCode ?? "missing_authorization",
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    if (options.logContext) {
      console.error(`[${options.logContext}] Token verification failed:`, authError?.message);
    }

    throw new HttpError(401, options.invalidMessage ?? "Invalid or expired token", {
      code: options.invalidCode ?? "invalid_authorization",
    });
  }

  const { data: callerProfile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    if (options.logContext) {
      console.error(`[${options.logContext}] Profile lookup failed:`, profileError.message);
    }

    throw new HttpError(500, "Authorization lookup failed", {
      code: "authorization_lookup_failed",
      exposeDetails: false,
    });
  }

  const role = normalizeRole((callerProfile as ProfileRoleRow)?.role);
  const allowedRoles = roleSet(options.allowedRoles ?? ADMIN_MANAGEMENT_ROLES);

  if (!allowedRoles.has(role)) {
    if (options.logContext) {
      console.warn(`[${options.logContext}] Forbidden: user`, user.id, "role:", role || "<missing>");
    }

    try {
      await options.onForbidden?.({ userId: user.id, role, user });
    } catch (hookError) {
      if (options.logContext) {
        console.error(`[${options.logContext}] Forbidden hook failed:`, hookError);
      }
    }

    throw new HttpError(403, options.forbiddenMessage ?? "Forbidden: insufficient permissions", {
      code: options.forbiddenCode ?? "insufficient_role",
    });
  }

  return {
    userId: user.id,
    role,
    token,
    authorizationHeader: `Bearer ${token}`,
    user,
  };
}

export const requireAdminOrManagement = (
  supabase: SupabaseClient,
  req: Request,
  options: Omit<RequireAuthenticatedRoleOptions, "allowedRoles"> = {},
) => requireAuthenticatedRole(supabase, req, {
  ...options,
  allowedRoles: ADMIN_MANAGEMENT_ROLES,
});
