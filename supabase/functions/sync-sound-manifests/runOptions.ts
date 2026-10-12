import { HttpError, readBoundedText } from "../_shared/http.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keep manual runs inside normal job discovery; never accept arbitrary Flex IDs. */
export async function readRunOptions(request: Request): Promise<{ jobId?: string; dryRun: boolean }> {
  const text = await readBoundedText(request, { maxBytes: 1024 });
  let body: unknown;
  try { body = text.trim() ? JSON.parse(text) : {}; }
  catch { throw new HttpError(400, "Invalid JSON body"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Invalid run options");
  const options = body as Record<string, unknown>;
  if (Object.keys(options).some((key) => !["job_id", "dry_run", "triggered_by"].includes(key)) ||
    (options.triggered_by !== undefined && options.triggered_by !== "pg_cron") ||
    (options.job_id !== undefined && (typeof options.job_id !== "string" || !UUID.test(options.job_id))) ||
    (options.dry_run !== undefined && typeof options.dry_run !== "boolean")) {
    throw new HttpError(400, "Invalid run options");
  }
  return { jobId: typeof options.job_id === "string" ? options.job_id.toLowerCase() : undefined, dryRun: options.dry_run === true };
}
