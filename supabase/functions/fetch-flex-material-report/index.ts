import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchWithRetry } from "../_shared/flexFetch.ts";
import { requireAuthenticatedRole } from "../_shared/auth.ts";
import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  readBoundedJsonObject,
  requireEnvValues,
} from "../_shared/http.ts";

// Fixed Flex report constants confirmed against the live Flex account -- only the
// PROJECT_ELEMENT_ID (the quote's flex_folders.element_id) varies per job/department.
const FLEX_REPORT_TEMPLATE_ID = "5367741d-f6fe-4120-af68-a79a68bbfb43";
const FLEX_PROJECT_ELEMENT_DEFINITION_ID = "9bfb850c-b117-11df-b8d5-00e08175e43e"; // matches FLEX_FOLDER_IDS.presupuesto
const FLEX_DOCUMENT_VIEW_ID = "ca6b072c-b122-11df-b8d5-00e08175e43e";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_DEPARTMENTS = new Set(["sound", "lights", "video", "production"]);
// Preference order when a job/department has multiple quote-type folders.
const QUOTE_FOLDER_TYPES = ["comercial_presupuesto", "dryhire_presupuesto", "presupuestos_recibidos"];

interface FetchFlexMaterialReportBody extends Record<string, unknown> {
  jobId?: unknown;
  department?: unknown;
  overrideElementId?: unknown;
  stageName?: unknown;
  stageNumber?: unknown;
}

const sanitizeFileNameSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_").replace(/^_|_$/g, "") || "segment";

const normalizePathSegment = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const getTechnicalStageStorageScope = (stageNumber: number, stageName?: string | null) => {
  const nameSlug = normalizePathSegment(stageName || "");
  return nameSlug ? `stage-${stageNumber}-${nameSlug}` : `stage-${stageNumber}`;
};

serve(createHttpHandler(async (req: Request) => {
  const body = await readBoundedJsonObject<FetchFlexMaterialReportBody>(req, { maxBytes: 4 * 1024 });

  const jobId = typeof body.jobId === "string" ? body.jobId : null;
  const department = typeof body.department === "string" ? body.department : null;
  const overrideElementId = typeof body.overrideElementId === "string" ? body.overrideElementId : null;
  const stageNumber =
    typeof body.stageNumber === "number" && Number.isInteger(body.stageNumber) && body.stageNumber > 0
      ? body.stageNumber
      : null;
  const stageName = typeof body.stageName === "string" && body.stageName.trim()
    ? body.stageName.trim()
    : null;

  if (!jobId || !UUID_PATTERN.test(jobId)) {
    throw new HttpError(400, "A valid jobId is required", { code: "invalid_job_id" });
  }
  if (!department || !VALID_DEPARTMENTS.has(department)) {
    throw new HttpError(400, "A valid department is required", { code: "invalid_department" });
  }
  if (overrideElementId && !UUID_PATTERN.test(overrideElementId)) {
    throw new HttpError(400, "overrideElementId must be a UUID", { code: "invalid_override_element_id" });
  }
  if (body.stageNumber !== undefined && stageNumber === null) {
    throw new HttpError(400, "stageNumber must be a positive integer", { code: "invalid_stage_number" });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnvValues(
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const,
    (name) => Deno.env.get(name),
  );

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const caller = await requireAuthenticatedRole(supabase, req, {
    allowedRoles: ["admin", "management", "house_tech"],
    logContext: "fetch-flex-material-report",
  });

  // Resolve which Flex quote element to use.
  let elementId: string;
  let folderType: string | null = null;
  let elementValidated = true;
  let elementJobMismatch = false;

  if (overrideElementId) {
    elementId = overrideElementId;
    const { data: matches } = await supabase
      .from("flex_folders")
      .select("job_id, folder_type")
      .eq("element_id", overrideElementId)
      .limit(1);
    const match = matches?.[0];
    elementValidated = Boolean(match);
    elementJobMismatch = Boolean(match && match.job_id !== jobId);
    folderType = match?.folder_type ?? null;
  } else {
    const { data: folders, error: folderError } = await supabase
      .from("flex_folders")
      .select("element_id, folder_type, created_at")
      .eq("job_id", jobId)
      .eq("department", department)
      .in("folder_type", QUOTE_FOLDER_TYPES)
      .order("created_at", { ascending: false });

    if (folderError) {
      throw new HttpError(500, "Failed to look up Flex quote folders", {
        code: "flex_folder_lookup_failed",
        exposeDetails: false,
      });
    }

    const ranked = (folders || []).slice().sort((a, b) => {
      const rankDiff = QUOTE_FOLDER_TYPES.indexOf(a.folder_type) - QUOTE_FOLDER_TYPES.indexOf(b.folder_type);
      return rankDiff !== 0 ? rankDiff : 0;
    });

    const best = ranked[0];
    if (!best) {
      throw new HttpError(404, "No Flex quote found for this job and department", {
        code: "flex_quote_not_found",
      });
    }

    elementId = best.element_id;
    folderType = best.folder_type;
  }

  const flexAuthToken = Deno.env.get("X_AUTH_TOKEN") || Deno.env.get("FLEX_X_AUTH_TOKEN") || "";
  if (!flexAuthToken) {
    throw new HttpError(503, "Flex auth not configured", {
      code: "flex_auth_missing",
      exposeDetails: false,
    });
  }

  const reportUrl = new URL(`https://sectorpro.flexrentalsolutions.com/f5/api/report/generate/${FLEX_REPORT_TEMPLATE_ID}`);
  reportUrl.searchParams.set("parameterSubmission", "true");
  reportUrl.searchParams.set("REPORT_TIME_ZONE", "Europe/Madrid");
  reportUrl.searchParams.set("REPORT_LOCALE", "es_ES");
  reportUrl.searchParams.set("REPORT_CURRENCY_SYMBOL", "€");
  reportUrl.searchParams.set("PROJECT_ELEMENT_DEFINITION_ID", FLEX_PROJECT_ELEMENT_DEFINITION_ID);
  reportUrl.searchParams.set("PROJECT_ELEMENT_ID", elementId);
  reportUrl.searchParams.set("DOCUMENT_VIEW_ID", FLEX_DOCUMENT_VIEW_ID);
  reportUrl.searchParams.set("REPORT_FORMAT", "pdf");
  reportUrl.searchParams.set("REPORT_PAPER_SIZE", "A4");
  reportUrl.searchParams.set("REPORT_ORIENTATION", "portrait");

  const flexResponse = await fetchWithRetry(reportUrl.toString(), {
    headers: {
      "X-Auth-Token": flexAuthToken,
      "apikey": flexAuthToken,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!flexResponse.ok) {
    throw new HttpError(502, `Flex report generation failed: ${flexResponse.status}`, {
      code: "flex_report_failed",
    });
  }

  // Flex returns the PDF body base64-encoded as text despite the application/pdf
  // content-type -- decode it, falling back to the raw bytes if it's ever a real
  // binary response instead.
  const rawText = await flexResponse.text();
  let pdfBytes: Uint8Array;
  try {
    const decoded = Uint8Array.from(atob(rawText.trim()), (c) => c.charCodeAt(0));
    pdfBytes = decoded.slice(0, 4).every((byte, i) => byte === "%PDF".charCodeAt(i))
      ? decoded
      : new TextEncoder().encode(rawText);
  } catch {
    pdfBytes = new TextEncoder().encode(rawText);
  }

  const bucket = "job-documents";
  const category = `calculators/lista-material/${department}`;
  const stageScope = stageNumber ? getTechnicalStageStorageScope(stageNumber, stageName) : null;
  const baseFolder = stageScope ? `${category}/${jobId}/${stageScope}` : `${category}/${jobId}`;
  const fileName = `Listado de Material - ${sanitizeFileNameSegment(department)}.pdf`;
  const objectPath = `${baseFolder}/${crypto.randomUUID()}-${sanitizeFileNameSegment(fileName)}`;

  // Clean up any previous auto-fetched materials list for this job before writing the new one.
  const { data: existingObjects } = await supabase.storage.from(bucket).list(baseFolder);
  if (existingObjects && existingObjects.length > 0) {
    await supabase.storage.from(bucket).remove(existingObjects.map((f) => `${baseFolder}/${f.name}`));
  }
  await supabase.from("job_documents").delete().eq("job_id", jobId).like("file_path", `${baseFolder}/%`);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, pdfBytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    throw new HttpError(500, "Failed to store the generated materials list", {
      code: "storage_upload_failed",
      exposeDetails: false,
    });
  }

  const { error: insertError } = await supabase.from("job_documents").insert({
    job_id: jobId,
    file_name: fileName,
    file_path: objectPath,
    file_type: "application/pdf",
    file_size: pdfBytes.byteLength,
    uploaded_by: caller.userId,
    original_type: "pdf",
    visible_to_tech: true,
  });
  if (insertError) {
    throw new HttpError(500, "Failed to record the generated materials list", {
      code: "job_document_insert_failed",
      exposeDetails: false,
    });
  }

  const { data: signedUrlData, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 3600);
  if (signError || !signedUrlData) {
    throw new HttpError(500, "Failed to sign the generated materials list URL", {
      code: "sign_url_failed",
      exposeDetails: false,
    });
  }

  return jsonResponse({
    url: signedUrlData.signedUrl,
    fileName,
    elementId,
    folderType,
    elementValidated,
    elementJobMismatch,
  });
}, { allowedMethods: ["POST"] }));
