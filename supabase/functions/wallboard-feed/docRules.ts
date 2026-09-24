/**
 * Detects which required documents a job already has.
 *
 * Every document the wallboard checks is produced inside the app, so it can be
 * recognised from where the app saves it rather than by counting files:
 *
 * - calculator PDFs live in `job_documents` under `calculators/<category>/…`
 *   (legacy layout) or `<jobId>/calculators/<category>/…` (job-scoped copies);
 * - memorias técnicas are rows in the per-department memoria tables and count
 *   once their final document has been generated.
 *
 * Sound and video Consumos share `calculators/consumos/`; they are told apart
 * by file name exactly like `getTechnicalPowerDepartmentFromDocument` in
 * `src/utils/powerReportReadiness.ts`, so the wallboard and the app agree.
 */

export type DocDept = "sound" | "lights" | "video";

export type JobDocumentRow = {
  job_id: string;
  file_path: string | null;
  file_name: string | null;
};

export type MemoriaRow = {
  job_id: string | null;
  final_document_url: string | null;
};

export type MemoriaRowsByDept = Record<DocDept, MemoriaRow[]>;

const LIGHTS_CONSUMOS_PREFIX = "calculators/lights-consumos/";
const SHARED_CONSUMOS_PREFIX = "calculators/consumos/";

const normalize = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase().replace(/\\/g, "/");

/** Drops the leading `<jobId>/` of the job-scoped layout. */
export function stripJobScopedPrefix(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments[1] === "calculators" ? segments.slice(1).join("/") : path;
}

function powerDepartment(path: string, fileName: string): DocDept | null {
  if (path.startsWith(LIGHTS_CONSUMOS_PREFIX)) return "lights";
  if (!path.startsWith(SHARED_CONSUMOS_PREFIX)) return null;
  const name = fileName.replace(/[\s-]+/g, "_");
  if (name.includes("video_power_report") || name.includes("_video_")) return "video";
  // Same default as the app: an unlabelled shared Consumos report is sound's.
  return "sound";
}

/** Returns the `dept:key` document keys a single job_documents row satisfies. */
export function classifyJobDocument(row: Pick<JobDocumentRow, "file_path" | "file_name">): string[] {
  const path = stripJobScopedPrefix(normalize(row.file_path));
  const name = normalize(row.file_name);
  const keys: string[] = [];

  const power = powerDepartment(path, name);
  if (power) keys.push(`${power}:consumos`);
  if (path.startsWith("calculators/pesos/")) keys.push("sound:pesos");
  if (path.startsWith("calculators/lista-material/sound/")) keys.push("sound:lista_material");
  if (path.startsWith("calculators/sv-report/")) keys.push("sound:soundvision");

  return keys;
}

/** Builds `jobId -> Set<"dept:key">` of delivered documents. */
export function buildDeliveredDocIndex(
  documents: JobDocumentRow[],
  memorias: MemoriaRowsByDept,
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  const add = (jobId: string, key: string) => {
    const bucket = index.get(jobId) ?? new Set<string>();
    bucket.add(key);
    index.set(jobId, bucket);
  };

  documents.forEach((row) => {
    classifyJobDocument(row).forEach((key) => add(row.job_id, key));
  });

  (Object.keys(memorias) as DocDept[]).forEach((dept) => {
    memorias[dept].forEach((row) => {
      if (row.job_id && row.final_document_url && row.final_document_url.trim()) {
        add(row.job_id, `${dept}:memoria`);
      }
    });
  });

  return index;
}
