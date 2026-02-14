import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const body = await req.json().catch(() => ({}));
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Mode 1: Evaluate a specific user
    if (body.user_id) {
      console.log("Evaluating achievements for user:", body.user_id);
      const { data, error } = await admin.rpc("evaluate_user_achievements", {
        p_user_id: body.user_id,
      });

      if (error) {
        console.error("Error evaluating user achievements:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(
        JSON.stringify({ user_id: body.user_id, new_unlocks: data }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mode 2: Daily batch evaluation (default)
    console.log("Running daily achievement evaluation...");
    const { data, error } = await admin.rpc("evaluate_daily_achievements");

    if (error) {
      console.error("Error in daily evaluation:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const results = data || [];
    console.log(`Daily evaluation complete. ${results.length} users received new achievements.`);

    return new Response(
      JSON.stringify({ evaluated: results.length, results }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error in evaluate-achievements function:", error);
    return new Response("Server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
