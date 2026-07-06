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

// Fixed Flex report constants confirmed against the live Flex account. Only
// PROJECT_ELEMENT_ID varies per job/department for the material-list report.
const FLEX_REPORT_DEFINITIONS = {
  "material-list": {
    generateId: "5367741d-f6fe-4120-af68-a79a68bbfb43",
    projectElementDefinitionId: "9bfb850c-b117-11df-b8d5-00e08175e43e", // matches FLEX_FOLDER_IDS.presupuesto
    documentViewId: "ca6b072c-b122-11df-b8d5-00e08175e43e",
    format: "pdf",
    paperSize: "A4",
    orientation: "portrait",
    storageCategory: "calculators/lista-material",
    fileNamePrefix: "Listado de Material",
    displayName: "lista de material",
    includeCacheBuster: false,
  },
  quote: {
    generateId: "generate-pdf",
    projectElementDefinitionId: "9bfb850c-b117-11df-b8d5-00e08175e43e",
    documentViewId: "ca6b072c-b122-11df-b8d5-00e08175e43e",
    format: "pdf",
    paperSize: "A4",
    orientation: null,
    storageCategory: "flex-reports/presupuestos",
    fileNamePrefix: "Presupuesto",
    displayName: "presupuesto",
    includeCacheBuster: true,
  },
} as const;

type FlexReportType = keyof typeof FLEX_REPORT_DEFINITIONS;

const DEFAULT_REPORT_TYPE: FlexReportType = "material-list";
const isFlexReportType = (value: string): value is FlexReportType =>
  Object.prototype.hasOwnProperty.call(FLEX_REPORT_DEFINITIONS, value);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_DEPARTMENTS = new Set(["sound", "lights", "video", "production"]);
const UNVERIFIED_OVERRIDE_ROLES = new Set(["admin", "management"]);
// Preference order when a job/department has multiple report-capable folders.
// `presupuestos_recibidos` is a container used by the material-list workflow,
// but quote printing must resolve to a real presupuesto element.
const REPORT_FOLDER_TYPES: Record<FlexReportType, string[]> = {
  "material-list": ["comercial_presupuesto", "dryhire_presupuesto", "presupuestos_recibidos"],
  quote: ["comercial_presupuesto", "dryhire_presupuesto"],
};

interface FetchFlexMaterialReportBody extends Record<string, unknown> {
  jobId?: unknown;
  department?: unknown;
  overrideElementId?: unknown;
  reportType?: unknown;
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

const hasPdfMagic = (bytes: Uint8Array) =>
  bytes.length >= 4 &&
  bytes[0] === 0x25 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x44 &&
  bytes[3] === 0x46;

serve(createHttpHandler(async (req: Request) => {
  const body = await readBoundedJsonObject<FetchFlexMaterialReportBody>(req, { maxBytes: 4 * 1024 });

  const jobId = typeof body.jobId === "string" ? body.jobId : null;
  const department = typeof body.department === "string" ? body.department : null;
  const overrideElementId = typeof body.overrideElementId === "string" ? body.overrideElementId : null;
  const reportType = typeof body.reportType === "string" && body.reportType.trim()
    ? body.reportType.trim()
    : DEFAULT_REPORT_TYPE;
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
  if (!isFlexReportType(reportType)) {
    throw new HttpError(400, "Unsupported reportType", { code: "invalid_report_type" });
  }
  if (body.stageNumber !== undefined && stageNumber === null) {
    throw new HttpError(400, "stageNumber must be a positive integer", { code: "invalid_stage_number" });
  }

  const reportDefinition = FLEX_REPORT_DEFINITIONS[reportType];

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
    const { data: matches, error: matchError } = await supabase
      .from("flex_folders")
      .select("job_id, department, folder_type")
      .eq("element_id", overrideElementId)
      .limit(1);
    if (matchError) {
      throw new HttpError(500, "Failed to validate Flex override element", {
        code: "flex_override_lookup_failed",
        exposeDetails: false,
      });
    }
    const match = matches?.[0];
    elementValidated = Boolean(match && match.job_id === jobId && match.department === department);
    elementJobMismatch = Boolean(match && (match.job_id !== jobId || match.department !== department));
    folderType = match?.folder_type ?? null;
    if (!elementValidated && !UNVERIFIED_OVERRIDE_ROLES.has(caller.role)) {
      throw new HttpError(403, "Flex override element is not valid for this job and department", {
        code: "invalid_flex_override_scope",
      });
    }
  } else {
    const reportFolderTypes = REPORT_FOLDER_TYPES[reportType];
    const { data: folders, error: folderError } = await supabase
      .from("flex_folders")
      .select("element_id, folder_type, created_at")
      .eq("job_id", jobId)
      .eq("department", department)
      .in("folder_type", reportFolderTypes)
      .order("created_at", { ascending: false });

    if (folderError) {
      throw new HttpError(500, "Failed to look up Flex quote folders", {
        code: "flex_folder_lookup_failed",
        exposeDetails: false,
      });
    }

    const ranked = (folders || []).slice().sort((a, b) => {
      const rankDiff = reportFolderTypes.indexOf(a.folder_type) - reportFolderTypes.indexOf(b.folder_type);
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

  const reportUrl = new URL(`https://sectorpro.flexrentalsolutions.com/f5/api/report/generate/${reportDefinition.generateId}`);
  if (reportDefinition.includeCacheBuster) {
    reportUrl.searchParams.set("_dc", Date.now().toString());
  }
  reportUrl.searchParams.set("parameterSubmission", "true");
  reportUrl.searchParams.set("REPORT_TIME_ZONE", "Europe/Madrid");
  reportUrl.searchParams.set("REPORT_LOCALE", "es_ES");
  reportUrl.searchParams.set("REPORT_CURRENCY_SYMBOL", "€");
  reportUrl.searchParams.set("PROJECT_ELEMENT_DEFINITION_ID", reportDefinition.projectElementDefinitionId);
  reportUrl.searchParams.set("PROJECT_ELEMENT_ID", elementId);
  reportUrl.searchParams.set("DOCUMENT_VIEW_ID", reportDefinition.documentViewId);
  reportUrl.searchParams.set("REPORT_FORMAT", reportDefinition.format);
  reportUrl.searchParams.set("REPORT_PAPER_SIZE", reportDefinition.paperSize);
  if (reportDefinition.orientation) {
    reportUrl.searchParams.set("REPORT_ORIENTATION", reportDefinition.orientation);
  }

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

  if (!hasPdfMagic(pdfBytes)) {
    throw new HttpError(502, "Flex did not return a valid PDF", {
      code: "invalid_flex_pdf",
    });
  }

  const bucket = "job-documents";
  const category = `${reportDefinition.storageCategory}/${department}`;
  const stageScope = stageNumber ? getTechnicalStageStorageScope(stageNumber, stageName) : null;
  const baseFolder = stageScope ? `${category}/${jobId}/${stageScope}` : `${category}/${jobId}`;
  const fileName = `${reportDefinition.fileNamePrefix} - ${sanitizeFileNameSegment(department)}.pdf`;
  const objectPath = `${baseFolder}/${crypto.randomUUID()}-${sanitizeFileNameSegment(fileName)}`;

  // Clean up any previous auto-fetched report for this exact job/department/stage
  // scope before writing the new one. Scope both the storage removal and the
  // job_documents delete to the same direct-children list -- baseFolder may have
  // stage-scoped sibling subfolders (a non-stage caller like PrintFlexReportAction
  // and a stage-aware Memoria form can both write under the same job/department),
  // and storage.list() doesn't recurse into those, so a broader `LIKE baseFolder/%`
  // delete on job_documents would drop sibling stage rows without removing their
  // underlying storage objects.
  const { data: existingObjects } = await supabase.storage.from(bucket).list(baseFolder);
  const existingObjectPaths = (existingObjects || [])
    .filter((entry) => entry.id)
    .map((entry) => `${baseFolder}/${entry.name}`);
  if (existingObjectPaths.length > 0) {
    await supabase.storage.from(bucket).remove(existingObjectPaths);
    await supabase.from("job_documents").delete().eq("job_id", jobId).in("file_path", existingObjectPaths);
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, pdfBytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    throw new HttpError(500, `Failed to store the generated ${reportDefinition.displayName}`, {
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
    throw new HttpError(500, `Failed to record the generated ${reportDefinition.displayName}`, {
      code: "job_document_insert_failed",
      exposeDetails: false,
    });
  }

  const { data: signedUrlData, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 3600);
  if (signError || !signedUrlData) {
    throw new HttpError(500, `Failed to sign the generated ${reportDefinition.displayName} URL`, {
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
    reportType,
  });
}, { allowedMethods: ["POST"] }));
