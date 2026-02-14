/** Default CORS headers for Supabase Edge Functions. */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

/** Create a JSON response with CORS + Content-Type headers. */
export function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...(init || {}),
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
}
