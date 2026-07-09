import { dataLayerClient } from "@/services/dataLayerClient";
import {
  getTechnicalStageStorageScope,
  type TechnicalStage,
} from "@/features/technical-tools/stage/stageUtils";

export interface StageAwareJobDocument {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string | null;
}

export type StageAwareJobDocumentFilter = (document: StageAwareJobDocument) => boolean;

/**
 * Generated PDFs may use the legacy `${category}/${jobId}/...` layout or the
 * RLS-compatible `${jobId}/${category}/...` layout. Return the scope segment
 * (e.g. "stage-2-mainstage") if present, or null for an unscoped upload.
 */
export const parseStageScopeSegment = (
  filePath: string,
  jobId: string,
  category: string
): string | null => {
  const legacyPrefix = `${category}/${jobId}/`;
  const jobScopedPrefix = `${jobId}/${category}/`;
  const matchedPrefix = filePath.startsWith(legacyPrefix)
    ? legacyPrefix
    : filePath.startsWith(jobScopedPrefix)
      ? jobScopedPrefix
      : null;
  if (!matchedPrefix) return null;

  const rest = filePath.slice(matchedPrefix.length);
  const segments = rest.split("/");
  // The last segment is always the `${uuid}-${name}` file itself; anything before
  // it is the stage-scope folder written by getTechnicalStageStorageScope().
  return segments.length >= 2 ? segments[0] : null;
};

/**
 * Latest job_documents row for a job+category, scoped to a specific festival stage
 * (or the unscoped upload, for single-stage jobs / no stage selected).
 */
export const findLatestJobDocumentForStage = async (
  jobId: string,
  category: string,
  stage?: TechnicalStage | null,
  filter?: StageAwareJobDocumentFilter
): Promise<StageAwareJobDocument | null> => {
  const { data, error } = await dataLayerClient
    .from("job_documents")
    .select("id, file_name, file_path, uploaded_at")
    .eq("job_id", jobId)
    .or(`file_path.like.${category}/${jobId}/%,file_path.like.${jobId}/${category}/%`)
    .order("uploaded_at", { ascending: false });

  if (error) throw error;

  const wantedScope = getTechnicalStageStorageScope(stage ?? null) ?? null;

  const match = (data || []).find(
    (doc) =>
      parseStageScopeSegment(doc.file_path, jobId, category) === wantedScope &&
      (!filter || filter(doc))
  );

  return match ?? null;
};
