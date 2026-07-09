import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import { requireAuthenticatedRole } from "./auth.ts";
import { HttpError, readBoundedJsonObject, requireEnvValues } from "./http.ts";
import { parseMemoriaRequestInput, type MemoriaRequestInput } from "./memoriaInput.ts";

export {
  assertAllowedStorageSourceUrl,
  fetchMemoriaSource,
  fetchOptionalMemoriaLogo,
  getSupportedImageFormat,
  isPdfBytes,
  parseMemoriaRequestInput,
  SourceByteBudget,
} from "./memoriaInput.ts";

const MEMORIA_GENERATOR_ROLES = ["admin", "management", "house_tech"] as const;
const MAX_REQUEST_BYTES = 24 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const OUTPUT_BUCKET_CANDIDATES = ["Memoria Tecnica", "memoria-tecnica"];

export interface MemoriaContext extends MemoriaRequestInput {
  supabase: SupabaseClient;
  userId: string;
}

/** Authenticates a permitted caller and validates a small, whitelisted request body. */
export async function requireMemoriaContext(
  req: Request,
  allowedDocumentKeys: readonly string[],
  logContext: string,
): Promise<MemoriaContext> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnvValues(
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const,
    (name) => Deno.env.get(name),
  );
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const caller = await requireAuthenticatedRole(supabase, req, {
    allowedRoles: MEMORIA_GENERATOR_ROLES,
    logContext,
  });
  const body = await readBoundedJsonObject(req, { maxBytes: MAX_REQUEST_BYTES });
  const input = parseMemoriaRequestInput(body, SUPABASE_URL, allowedDocumentKeys);

  return { ...input, supabase, userId: caller.userId };
}

const sanitizePathSegment = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80) || "proyecto";

export async function uploadGeneratedMemoriaPdf(
  supabase: SupabaseClient,
  projectName: string,
  fileName: string,
  pdfBytes: Uint8Array,
  options: { bucketCandidates?: readonly string[] } = {},
) {
  const objectPath = `${sanitizePathSegment(projectName)}/generated/${crypto.randomUUID()}.pdf`;
  let lastError: Error | null = null;
  let bucket = "";

  for (const candidate of options.bucketCandidates ?? OUTPUT_BUCKET_CANDIDATES) {
    const { error } = await supabase.storage.from(candidate).upload(objectPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (!error) {
      bucket = candidate;
      break;
    }
    lastError = error;
  }

  if (!bucket) {
    console.error("Memoria PDF upload failed", lastError?.message);
    throw new HttpError(500, "Unable to store generated PDF", {
      code: "output_upload_failed",
      exposeDetails: false,
    });
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("Memoria PDF signing failed", error?.message);
    throw new HttpError(500, "Unable to sign generated PDF", {
      code: "output_sign_failed",
      exposeDetails: false,
    });
  }

  return {
    expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    expiresIn: SIGNED_URL_TTL_SECONDS,
    fileName,
    url: data.signedUrl,
  };
}
