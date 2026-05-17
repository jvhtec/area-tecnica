import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SIGNED_URL_TTL_SECONDS = 300;

const sha256Hex = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase configuration" }, { status: 500 });
  }

  let body: { token?: unknown; documentId?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";

  if (!token || !documentId) {
    return jsonResponse({ error: "Missing token or documentId" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const tokenHash = await sha256Hex(token);
  const { data: link, error: linkError } = await supabase
    .from("tour_guest_links")
    .select("id, tour_id, allowed_sections, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError) {
    console.error("Unable to validate tour guest link:", linkError);
    return jsonResponse({ error: "Unable to validate link" }, { status: 500 });
  }

  const isExpired = link?.expires_at ? new Date(link.expires_at).getTime() <= Date.now() : false;
  const allowsDocuments = (link?.allowed_sections as Record<string, unknown> | null)?.documents !== false;
  if (!link || link.revoked_at || isExpired || !allowsDocuments) {
    return jsonResponse({ error: "Link not found or expired" }, { status: 404 });
  }

  const { data: document, error: documentError } = await supabase
    .from("tour_documents")
    .select("id, tour_id, file_path, visible_to_guest")
    .eq("id", documentId)
    .eq("tour_id", link.tour_id)
    .maybeSingle();

  if (documentError) {
    console.error("Unable to load tour guest document:", documentError);
    return jsonResponse({ error: "Unable to load document" }, { status: 500 });
  }

  if (!document?.visible_to_guest || !document.file_path) {
    return jsonResponse({ error: "Document not found" }, { status: 404 });
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from("tour-documents")
    .createSignedUrl(document.file_path, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed?.signedUrl) {
    console.error("Unable to sign guest document URL:", signedError);
    return jsonResponse({ error: "Unable to create document URL" }, { status: 500 });
  }

  return jsonResponse({
    signedUrl: signed.signedUrl,
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });
});
