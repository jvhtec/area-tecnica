import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { createHttpHandler, requireEnvValues } from "../_shared/http.ts";
import { handleEnrichArtistMetadataRequest } from "./handler.ts";

serve(createHttpHandler(async (req) => {
  const {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => Deno.env.get(name));

  const supabase = createClient(supabaseUrl, serviceKey);

  return await handleEnrichArtistMetadataRequest(req, { supabase });
}, {
  allowedMethods: ["POST"],
  internalErrorMessage: "No se pudo consultar la metadata del artista.",
  onError: (error) => console.error("Error enriching artist metadata:", error),
}));
