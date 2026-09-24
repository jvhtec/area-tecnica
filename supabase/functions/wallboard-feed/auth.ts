import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WALLBOARD_JWT_SECRET = Deno.env.get("WALLBOARD_JWT_SECRET") ?? "";
const WALLBOARD_SHARED_TOKEN = Deno.env.get("WALLBOARD_SHARED_TOKEN") ?? "";
const ALLOWED_SIGNED_IN_ROLES = new Set(["admin", "management", "wallboard"]);

export type AuthResult = {
  method: "jwt" | "shared" | "user";
  presetSlug?: string | null;
};

type AuthDependencies = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  wallboardJwtSecret?: string;
  wallboardSharedToken?: string;
  createClient?: typeof createClient;
};

type AuthenticateOptions = {
  allowSupabaseUser?: boolean;
  requestedPresetSlug?: string;
  dependencies?: AuthDependencies;
};

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const jwtKeyPromises = new Map<string, Promise<CryptoKey>>();

async function getJwtKey(secret: string) {
  if (!secret) {
    throw new HttpError(500, "WALLBOARD_JWT_SECRET is not configured");
  }
  let keyPromise = jwtKeyPromises.get(secret);
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    jwtKeyPromises.set(secret, keyPromise);
  }
  return await keyPromise;
}

async function readWallboardJwt(token: string, secret: string): Promise<AuthResult | null> {
  let payload: Record<string, unknown>;
  try {
    payload = await verify(token, await getJwtKey(secret));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return null;
  }
  if (payload.scope !== "wallboard") {
    throw new HttpError(403, "Invalid wallboard scope");
  }
  return {
    method: "jwt",
    presetSlug: typeof payload.preset === "string" ? payload.preset : undefined,
  };
}

export async function authenticateSupabaseUser(
  token: string,
  requestedPresetSlug?: string,
  dependencies: AuthDependencies = {},
): Promise<AuthResult> {
  const supabaseUrl = dependencies.supabaseUrl ?? SUPABASE_URL;
  const supabaseAnonKey = dependencies.supabaseAnonKey ?? SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = dependencies.supabaseServiceRoleKey ?? SUPABASE_SERVICE_ROLE_KEY;
  const clientFactory = dependencies.createClient ?? createClient;
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new HttpError(500, "Signed-in wallboard authentication is not configured");
  }
  const callerClient = clientFactory(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser(token);
  if (userError || !user) throw new HttpError(401, "Invalid token");

  const roleClient = clientFactory(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await roleClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new HttpError(500, "Unable to authorize wallboard user");
  if (!profile || !ALLOWED_SIGNED_IN_ROLES.has(String(profile.role))) {
    throw new HttpError(403, "Forbidden");
  }
  return { method: "user", presetSlug: requestedPresetSlug };
}

export async function authenticate(
  req: Request,
  url: URL,
  options: AuthenticateOptions = {},
): Promise<AuthResult> {
  const wallboardJwtSecret = options.dependencies?.wallboardJwtSecret ?? WALLBOARD_JWT_SECRET;
  const wallboardSharedToken = options.dependencies?.wallboardSharedToken ?? WALLBOARD_SHARED_TOKEN;
  const headerJwt = req.headers.get("x-wallboard-jwt")?.trim();
  if (headerJwt) {
    const result = await readWallboardJwt(headerJwt, wallboardJwtSecret);
    if (!result) throw new HttpError(401, "Invalid token");
    return result;
  }

  const headerToken = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (headerToken.startsWith("Bearer ")) {
    const token = headerToken.slice(7).trim();
    if (!token) throw new HttpError(401, "Missing bearer token");
    const wallboardAuth = wallboardJwtSecret ? await readWallboardJwt(token, wallboardJwtSecret) : null;
    if (wallboardAuth) return wallboardAuth;
    if (options.allowSupabaseUser) {
      return await authenticateSupabaseUser(token, options.requestedPresetSlug, options.dependencies);
    }
    if (!wallboardJwtSecret) {
      throw new HttpError(500, "WALLBOARD_JWT_SECRET is not configured");
    }
    throw new HttpError(401, "Invalid token");
  }

  const sharedHeader =
    req.headers.get("x-wallboard-token") ??
    req.headers.get("x-wallboard-shared-token") ??
    req.headers.get("x-wallboard-shared") ??
    url.searchParams.get("wallboardToken");
  if (sharedHeader) {
    if (!wallboardSharedToken) throw new HttpError(500, "WALLBOARD_SHARED_TOKEN is not configured");
    if (sharedHeader !== wallboardSharedToken) throw new HttpError(403, "Forbidden");
    return {
      method: "shared",
      presetSlug: url.searchParams.get("preset")?.trim().toLowerCase() ?? options.requestedPresetSlug,
    };
  }

  throw new HttpError(401, "Unauthorized");
}
