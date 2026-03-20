import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { handleGetGoogleMapsKeyRequest } from "./handler.ts";

const DEFAULT_ALLOWED_ROLES = [
  'admin',
  'management',
  'house_tech',
  'technician',
  'logistics',
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    return await handleGetGoogleMapsKeyRequest(req, {
      supabase,
      getEnv: (name) => Deno.env.get(name),
      allowedRoles: ALLOWED_ROLES,
    });
  } catch (error) {
    console.error("Error fetching Google Maps API key:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
