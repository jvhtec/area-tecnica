import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Valid image ID pattern (UUID or Flex-specific ID)
const IMAGE_ID_PATTERN = /^[a-zA-Z0-9-]{1,100}$/;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let imageId: string | null = null;
    let size: "thumb" | "full" = "thumb";

    // Support both GET (query params) and POST (JSON body)
    if (req.method === "GET") {
      const url = new URL(req.url);
      imageId = url.searchParams.get("imageId");
      const sizeParam = url.searchParams.get("size");
      if (sizeParam === "full") size = "full";
    } else if (req.method === "POST") {
      const body = await req.json() as { imageId?: string; size?: string };
      imageId = body.imageId || null;
      if (body.size === "full") size = "full";
    } else {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders
      });
    }

    // Validate imageId
    if (!imageId) {
      return new Response(JSON.stringify({ error: "imageId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!IMAGE_ID_PATTERN.test(imageId)) {
      return new Response(JSON.stringify({ error: "Invalid imageId format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // AuthZ: Require authenticated user (any role can view equipment images)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve Flex auth token
    let flexAuthToken = Deno.env.get("X_AUTH_TOKEN") || "";
    if (!flexAuthToken) {
      try {
        const { data: secretData } = await supabase.functions.invoke("get-secret", {
          body: { secretName: "X_AUTH_TOKEN" },
          headers: { Authorization: authHeader },
        });
        if (secretData?.X_AUTH_TOKEN) {
          flexAuthToken = secretData.X_AUTH_TOKEN as string;
        }
      } catch (_) {
        // Ignore secret fetch errors
      }
    }

    if (!flexAuthToken) {
      return new Response(JSON.stringify({ error: "Flex auth not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch image from Flex API
    const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/image/${encodeURIComponent(imageId)}/${size}`;

    const flexResponse = await fetch(flexUrl, {
      headers: {
        "X-Auth-Token": flexAuthToken,
        "apikey": flexAuthToken,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!flexResponse.ok) {
      // Return a transparent 1x1 pixel for missing images (graceful degradation)
      if (flexResponse.status === 404) {
        return new Response(null, {
          status: 404,
          headers: { ...corsHeaders },
        });
      }
      return new Response(JSON.stringify({
        error: `Flex API error: ${flexResponse.status}`
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the image content
    const imageBlob = await flexResponse.blob();
    const contentType = flexResponse.headers.get("Content-Type") || "image/jpeg";

    // Return the image with appropriate caching headers
    return new Response(imageBlob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });

  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
