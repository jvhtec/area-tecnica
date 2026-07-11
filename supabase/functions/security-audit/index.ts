import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { handleSecurityAuditRequest } from "./handler.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateLimitSalt = Deno.env.get("EDGE_RATE_LIMIT_HASH_SECRET");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase configuration" }, { status: 500 });
  }

  // Linked/hosted projects must use a salt that can rotate independently of
  // the service-role key, so credential rotation does not reset rate buckets.
  if (!rateLimitSalt && supabaseUrl.includes(".supabase.co")) {
    return jsonResponse({ error: "Missing security audit rate-limit configuration" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    return await handleSecurityAuditRequest(req, {
      supabase,
      rateLimitSalt: rateLimitSalt ?? serviceRoleKey,
    });
  } catch (error) {
    console.error("Error persisting security audit event:", error);
    return jsonResponse(
      { error: "Failed to persist security audit event" },
      { status: 500 },
    );
  }
});
