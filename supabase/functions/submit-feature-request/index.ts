import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FeatureRequestRequest {
  title: string;
  description: string;
  useCase?: string;
  reporterEmail: string;
}

/**
 * Get current user if authenticated
 */
async function getCurrentUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }
    return data.user;
  } catch (err) {
    console.warn("[submit-feature-request] Error resolving user", err);
    return null;
  }
}

serve(async (req) => {
  // Validate required environment variables
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[submit-feature-request] Missing required environment variables");
    return new Response(
      JSON.stringify({
        error: "Server configuration error",
        details: "Required environment variables are not configured",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Parse request
    const featureRequest = (await req.json()) as FeatureRequestRequest;

    // Validate required fields
    if (!featureRequest.title || !featureRequest.description || !featureRequest.reporterEmail) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          details: "title, description, and reporterEmail are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get current user if authenticated
    const user = await getCurrentUser(req);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Save to database
    console.log("[submit-feature-request] Saving to database...");
    const { data: savedRequest, error: dbError } = await supabase
      .from("feature_requests")
      .insert({
        title: featureRequest.title,
        description: featureRequest.description,
        use_case: featureRequest.useCase,
        reporter_email: featureRequest.reporterEmail,
        created_by: user?.id,
        status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      console.error("[submit-feature-request] Database error:", dbError);
      return new Response(
        JSON.stringify({
          error: "Failed to save feature request",
          details: dbError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send confirmation email (optional - can be implemented later)
    // TODO: Send confirmation email to reporter

    return new Response(
      JSON.stringify({
        success: true,
        featureRequest: savedRequest,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    // Log full error details server-side for debugging
    const errorId = `FR-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.error(`[submit-feature-request] Error ${errorId}:`, err);

    // Return generic error to client without leaking internal details
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        errorId: errorId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
