import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { createHttpHandler, HttpError, requireEnvValues } from "../_shared/http.ts";
import { persistSecurityAuditLog } from "../_shared/securityAudit.ts";

const MAX_REPORT_BODY_BYTES = 64 * 1024;
const MAX_REPORTS_PER_REQUEST = 10;
const CSP_REPORT_ACTION = "csp_violation_reported";
const CSP_REPORT_RESOURCE = "browser.csp_report_only";
const CSP_REPORT_SEVERITY = "low";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function getStringField(report: JsonRecord, names: string[], maxLength = 512): string | null {
  for (const name of names) {
    const value = trimString(report[name], maxLength);

    if (value) {
      return value;
    }
  }

  return null;
}

function getNumberField(report: JsonRecord, names: string[]): number | null {
  for (const name of names) {
    const value = report[name];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseInt(value, 10);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function normalizeReportedUrl(value: unknown): string | null {
  const trimmed = trimString(value, 2048);

  if (!trimmed) {
    return null;
  }

  if (["inline", "eval", "wasm-eval", "self"].includes(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("data:")) {
    return "data:";
  }

  if (trimmed.startsWith("blob:")) {
    return "blob:";
  }

  try {
    const url = new URL(trimmed);
    url.search = "";
    url.hash = "";
    return url.toString().slice(0, 512);
  } catch {
    return trimmed.slice(0, 512);
  }
}

function normalizeCspReport(report: JsonRecord): JsonRecord {
  return {
    document_uri: normalizeReportedUrl(
      report["document-uri"] ?? report.documentURL ?? report.documentUrl,
    ),
    referrer: normalizeReportedUrl(report.referrer),
    violated_directive: getStringField(report, ["violated-directive", "violatedDirective"]),
    effective_directive: getStringField(report, ["effective-directive", "effectiveDirective"]),
    disposition: getStringField(report, ["disposition"], 64),
    blocked_uri: normalizeReportedUrl(report["blocked-uri"] ?? report.blockedURL ?? report.blockedUrl),
    source_file: normalizeReportedUrl(report["source-file"] ?? report.sourceFile),
    line_number: getNumberField(report, ["line-number", "lineNumber"]),
    column_number: getNumberField(report, ["column-number", "columnNumber"]),
    status_code: getNumberField(report, ["status-code", "statusCode"]),
    original_policy: getStringField(report, ["original-policy", "originalPolicy"], 2048),
  };
}

function extractReportRecord(input: JsonRecord): JsonRecord | null {
  if (isRecord(input["csp-report"])) {
    return input["csp-report"];
  }

  if (isRecord(input.body)) {
    return input.body;
  }

  return input;
}

function normalizeReports(input: unknown): JsonRecord[] {
  const inputs = Array.isArray(input) ? input : [input];
  const reports: JsonRecord[] = [];

  for (const item of inputs.slice(0, MAX_REPORTS_PER_REQUEST)) {
    if (!isRecord(item)) {
      continue;
    }

    const report = extractReportRecord(item);

    if (report) {
      reports.push(normalizeCspReport(report));
    }
  }

  return reports;
}

async function readBoundedJson(req: Request): Promise<unknown> {
  const contentLengthHeader = req.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;

  if (Number.isFinite(contentLength) && contentLength > MAX_REPORT_BODY_BYTES) {
    throw new HttpError(413, "CSP report body too large");
  }

  const rawBody = await req.text();
  const bodyBytes = new TextEncoder().encode(rawBody).length;

  if (bodyBytes > MAX_REPORT_BODY_BYTES) {
    throw new HttpError(413, "CSP report body too large");
  }

  if (!rawBody.trim()) {
    throw new HttpError(400, "CSP report body is required");
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new HttpError(400, "Invalid CSP report JSON");
  }
}

serve(createHttpHandler(async (req) => {
  const {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => Deno.env.get(name));

  const body = await readBoundedJson(req);
  const reports = normalizeReports(body);

  if (reports.length === 0) {
    throw new HttpError(400, "No CSP report found");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  await persistSecurityAuditLog(req, supabase, {
    action: CSP_REPORT_ACTION,
    resource: CSP_REPORT_RESOURCE,
    severity: CSP_REPORT_SEVERITY,
    metadata: {
      content_type: req.headers.get("content-type"),
      report_count: reports.length,
      reports,
    },
  });

  return new Response(null, { status: 204 });
}, {
  allowedMethods: ["POST"],
  internalErrorMessage: "Failed to persist CSP report",
  onError: (error) => {
    if (!(error instanceof HttpError)) {
      console.error("Error persisting CSP report:", error);
    }
  },
}));
