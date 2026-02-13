import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AchievementNotificationPayload {
  userId: string;
  achievementId: string;
}

serve(async (req) => {
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
    const payload = (await req.json()) as AchievementNotificationPayload;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get achievement details
    const { data: achievement, error: achievementError } = await supabase
      .from("achievements")
      .select("*")
      .eq("id", payload.achievementId)
      .single();

    if (achievementError || !achievement) {
      console.error("[send-achievement-notification] Achievement not found:", achievementError);
      return new Response(
        JSON.stringify({ error: "Achievement not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", payload.userId)
      .eq("is_active", true);

    if (subError) {
      console.error("[send-achievement-notification] Failed to fetch subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[send-achievement-notification] No active subscriptions for user:", payload.userId);
      return new Response(
        JSON.stringify({ message: "No active subscriptions" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare push notification payload
    const notificationPayload = {
      title: "¡Logro desbloqueado!",
      body: `${achievement.icon} ${achievement.title}: ${achievement.description}`,
      icon: "/icon-192x192.png",
      badge: "/badge-72x72.png",
      data: {
        url: "/achievements",  // Deep link
        type: "achievement",
        achievementId: payload.achievementId,
      },
    };

    // Send push notification to all active subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          // Web Push API call (requires VAPID keys configured)
          const response = await fetch(sub.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "TTL": "86400",  // 24 hours
              // Note: VAPID authorization header would be added here in production
              // "Authorization": `WebPush ${vapidToken}`,
            },
            body: JSON.stringify(notificationPayload),
          });

          if (!response.ok) {
            throw new Error(`Push failed: ${response.status}`);
          }

          return { success: true, subscriptionId: sub.id };
        } catch (error) {
          console.error(
            `[send-achievement-notification] Failed to send to subscription ${sub.id}:`,
            error
          );
          return { success: false, subscriptionId: sub.id, error: error.message };
        }
      })
    );

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    console.log(
      `[send-achievement-notification] Sent ${successCount}/${subscriptions.length} notifications`
    );

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions.length,
        achievement: {
          title: achievement.title,
          description: achievement.description,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[send-achievement-notification] Error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: err.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
