
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { createHttpHandler, requireEnvValues } from "../_shared/http.ts";
import { handleGetSecretRequest } from "./handler.ts";

console.log("Edge Function: get-secret initialized");

serve(createHttpHandler(async (req) => {
  console.log("Received request:", req.method);

  const {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => Deno.env.get(name));

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  return await handleGetSecretRequest(req, {
    supabase,
    getEnv: (name) => Deno.env.get(name),
  });
}, {
  allowedMethods: ["POST"],
  onError: (error) => console.error("Error processing request:", error),
}));
