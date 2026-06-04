import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { createHttpHandler, requireEnvValues } from "../_shared/http.ts";
import { handleGetGoogleMapsKeyRequest } from "./handler.ts";

const DEFAULT_ALLOWED_ROLES = [
  'admin',
  'management',
]

const getAllowedRoles = () => {
  const configuredRoles = Deno.env.get('GOOGLE_MAPS_ALLOWED_ROLES')

  if (!configuredRoles) {
    return DEFAULT_ALLOWED_ROLES
  }

  if (configuredRoles.trim() === '*') {
    // Wildcard allows every authenticated user to request the key.
    return null
  }

  return configuredRoles
    .split(',')
    .map((role) => role.trim())
    .filter((role) => role.length > 0)
}

const ALLOWED_ROLES = getAllowedRoles()

serve(createHttpHandler(async (req) => {
  const {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => Deno.env.get(name));

  const supabase = createClient(supabaseUrl, serviceKey);

  return await handleGetGoogleMapsKeyRequest(req, {
    supabase,
    getEnv: (name) => Deno.env.get(name),
    allowedRoles: ALLOWED_ROLES,
  });
}, {
  allowedMethods: ["POST"],
  internalErrorMessage: "Unable to fetch API key",
  onError: (error) => console.error("Error fetching Google Maps API key:", error),
}));
