import {
  corsHeaders,
  extractBearerToken,
  jsonResponse,
} from "../_shared/http.ts";

export { corsHeaders, jsonResponse };

export function ensureAuthHeader(req: Request) {
  const token = extractBearerToken(req);

  if (!token) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return token;
}
