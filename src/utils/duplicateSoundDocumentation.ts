import { dataLayerClient } from "@/services/dataLayerClient";
import { maybeRewriteCopiedGeneratedPdf } from "@/utils/duplicateSoundDocumentationPdf";
import { resolveJobDocLocation } from "@/utils/jobDocuments";
import { getTechnicalPowerDepartmentFromDocument } from "@/utils/powerReportReadiness";

export const SOUND_DOCUMENTATION_COPY_SCOPES = [
  "soundDocuments",
  "power",
  "soundvision",
  "material",
  "memoria",
] as const;

export type SoundDocumentationCopyScope = (typeof SOUND_DOCUMENTATION_COPY_SCOPES)[number];

export type SoundDocumentationCopyResult = {
  copiedDocuments: number;
  copiedMemoriaRows: number;
  copiedPowerTables: number;
  skippedDocuments: number;
  documentsByScope: Partial<Record<SoundDocumentationCopyScope, number>>;
};

export type SoundDocumentationSourceJob = {
  end_time: string | null;
  id: string;
  start_time: string | null;
  title: string;
};

type SupabaseLikeError = {
  message?: string;
  code?: string;
};

type SupabaseLikeResult<T> = {
  data: T | null;
  error: SupabaseLikeError | null;
};

type SupabaseLikeQuery<T> = PromiseLike<SupabaseLikeResult<T>> & {
  delete: () => SupabaseLikeQuery<T>;
  eq: (column: string, value: unknown) => SupabaseLikeQuery<T>;
  insert: (payload: unknown) => SupabaseLikeQuery<T>;
  is: (column: string, value: unknown) => SupabaseLikeQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseLikeQuery<T>;
  select: (columns?: string) => SupabaseLikeQuery<T>;
};

type SupabaseLikeStorageBucket = {
  download: (path: string) => Promise<SupabaseLikeResult<Blob>>;
  upload: (
    path: string,
    file: Blob,
    options?: { cacheControl?: string; contentType?: string; upsert?: boolean }
  ) => Promise<SupabaseLikeResult<unknown>>;
};

type SupabaseLikeClient = {
  auth?: {
    getUser: () => Promise<{ data?: { user?: { id?: string | null } | null } | null }>;
  };
  from: <T = unknown>(table: string) => SupabaseLikeQuery<T>;
  storage: {
    from: (bucket: string) => SupabaseLikeStorageBucket;
  };
};

type JobDocumentRow = {
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  has_preview?: boolean | null;
  id: string;
  original_type: string | null;
  preview_generated_at?: string | null;
  preview_url?: string | null;
  read_only: boolean | null;
  template_type: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  visible_to_tech: boolean | null;
};

type PowerRequirementRow = {
  created_at: string | null;
  current_per_phase: number;
  custom_pdu_type: string | null;
  custom_position: string | null;
  department: string | null;
  id: string;
  includes_hoist: boolean | null;
  job_id: string | null;
  pdu_type: string;
  position: string | null;
  stage_name: string | null;
  stage_number: number | null;
  table_data: unknown;
  table_name: string;
  total_watts: number;
};

type MemoriaTecnicaRow = Record<string, unknown> & {
  id?: string;
  job_id?: string | null;
  project_name?: string;
};

type ClassifiedDocument = {
  doc: JobDocumentRow;
  groupKey: string;
  scope: SoundDocumentationCopyScope;
};

export type DuplicateSoundDocumentationOptions = {
  client?: SupabaseLikeClient;
  idFactory?: () => string;
  scopes?: SoundDocumentationCopyScope[];
  sourceJobId: string;
  sourceJobTitle?: string | null;
  targetJobDate?: string | null;
  targetJobId: string;
  targetJobTitle?: string | null;
};

const JOB_DOCUMENT_SELECT = [
  "id",
  "job_id",
  "file_name",
  "file_path",
  "file_size",
  "file_type",
  "uploaded_at",
  "uploaded_by",
  "original_type",
  "visible_to_tech",
  "read_only",
  "template_type",
  "has_preview",
  "preview_url",
  "preview_generated_at",
].join(", ");

const generatedDocumentPrefixes = {
  material: "calculators/lista-material/sound",
  power: "calculators/consumos",
  soundvision: "calculators/sv-report",
} as const;

export const fetchSoundDocumentationSourceJobs = async (
  targetJobId: string
): Promise<SoundDocumentationSourceJob[]> => {
  const { data, error } = await dataLayerClient
    .from("jobs")
    .select("id, title, start_time, end_time")
    .neq("id", targetJobId)
    .in("job_type", ["single", "festival", "ciclo", "tourdate"])
    .order("start_time", { ascending: false })
    .limit(250);

  if (error) throw error;
  return (data || []) as SoundDocumentationSourceJob[];
};

const emptyResult = (): SoundDocumentationCopyResult => ({
  copiedDocuments: 0,
  copiedMemoriaRows: 0,
  copiedPowerTables: 0,
  skippedDocuments: 0,
  documentsByScope: {},
});

const normalizePath = (path: string) => path.replace(/^\/+/, "");

const sanitizeFileName = (fileName: string) =>
  fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "") || "document.pdf";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const slugLikeTitle = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");

const createDocumentVersionSegment = (idFactory?: () => string) =>
  idFactory?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const renameCopiedSoundDocumentFile = ({
  sourceFileName,
  sourceJobTitle,
  targetJobTitle,
}: {
  sourceFileName: string;
  sourceJobTitle?: string | null;
  targetJobTitle?: string | null;
}) => {
  const sourceTitle = sourceJobTitle?.trim();
  const targetTitle = targetJobTitle?.trim();
  if (!sourceTitle || !targetTitle || sourceTitle === targetTitle) {
    return sourceFileName;
  }

  const variants = [
    { source: sourceTitle, target: targetTitle },
    { source: sourceTitle.replace(/\s+/g, "_"), target: targetTitle.replace(/\s+/g, "_") },
    { source: slugLikeTitle(sourceTitle), target: slugLikeTitle(targetTitle) },
  ].filter((variant) => variant.source && variant.target);

  let nextFileName = sourceFileName;
  for (const variant of variants) {
    nextFileName = nextFileName.replace(new RegExp(escapeRegExp(variant.source), "gi"), variant.target);
  }

  return nextFileName;
};

export const buildCopiedSoundDocumentPath = ({
  idFactory,
  jobScopedStorage = false,
  sourceFilePath,
  sourceJobId,
  targetFileName,
  targetJobId,
}: {
  idFactory?: () => string;
  jobScopedStorage?: boolean;
  sourceFilePath: string;
  sourceJobId: string;
  targetFileName: string;
  targetJobId: string;
}) => {
  const normalized = normalizePath(sourceFilePath);
  const segments = normalized.split("/").filter(Boolean);
  const sourceIndex = segments.indexOf(sourceJobId);

  if (sourceIndex < 0) {
    throw new Error(`Document path does not include source job id: ${sourceFilePath}`);
  }

  const beforeJobSegments = segments.slice(0, sourceIndex);
  const afterSegments = segments.slice(sourceIndex + 1);
  const scopeSegments = afterSegments.slice(0, -1);
  const destinationSegments = jobScopedStorage
    ? [targetJobId, ...beforeJobSegments, ...scopeSegments]
    : [...beforeJobSegments, targetJobId, ...scopeSegments];
  const destinationFolder = destinationSegments.filter(Boolean).join("/");
  const version = createDocumentVersionSegment(idFactory);

  return `${destinationFolder}/${version}-${sanitizeFileName(targetFileName)}`;
};

const incrementScope = (
  counts: SoundDocumentationCopyResult["documentsByScope"],
  scope: SoundDocumentationCopyScope
) => {
  counts[scope] = (counts[scope] ?? 0) + 1;
};

const parseGeneratedScope = (filePath: string, sourceJobId: string, prefix: string) => {
  const legacyPrefix = `${prefix}/${sourceJobId}/`;
  const jobScopedPrefix = `${sourceJobId}/${prefix}/`;
  const matchedPrefix = filePath.startsWith(legacyPrefix)
    ? legacyPrefix
    : filePath.startsWith(jobScopedPrefix)
      ? jobScopedPrefix
      : null;
  if (!matchedPrefix) return null;

  const rest = filePath.slice(matchedPrefix.length);
  const segments = rest.split("/").filter(Boolean);
  return segments.length > 1 ? segments[0] : "unscoped";
};

const classifySoundDocument = (
  doc: JobDocumentRow,
  sourceJobId: string,
  wantedScopes: Set<SoundDocumentationCopyScope>
): ClassifiedDocument | null => {
  const filePath = normalizePath(doc.file_path);

  if (
    wantedScopes.has("soundvision") &&
    doc.template_type === "soundvision" &&
    filePath.startsWith("soundvision-files/")
  ) {
    return { doc, groupKey: "soundvision-template", scope: "soundvision" };
  }

  if (wantedScopes.has("soundDocuments") && filePath.startsWith(`sound/${sourceJobId}/`)) {
    const afterJob = filePath.slice(`sound/${sourceJobId}/`.length);
    if (!afterJob.startsWith("task-")) {
      return { doc, groupKey: `sound-document:${doc.id}`, scope: "soundDocuments" };
    }
  }

  if (wantedScopes.has("material")) {
    const materialScope = parseGeneratedScope(filePath, sourceJobId, generatedDocumentPrefixes.material);
    if (materialScope) {
      return { doc, groupKey: `material:${materialScope}`, scope: "material" };
    }
  }

  if (wantedScopes.has("soundvision")) {
    const soundvisionScope = parseGeneratedScope(filePath, sourceJobId, generatedDocumentPrefixes.soundvision);
    if (soundvisionScope) {
      return { doc, groupKey: `soundvision-report:${soundvisionScope}`, scope: "soundvision" };
    }
  }

  if (wantedScopes.has("power")) {
    const powerScope = parseGeneratedScope(filePath, sourceJobId, generatedDocumentPrefixes.power);
    if (powerScope && getTechnicalPowerDepartmentFromDocument(doc) === "sound") {
      return { doc, groupKey: `power:${powerScope}`, scope: "power" };
    }
  }

  return null;
};

export const selectSoundDocumentsForCopy = (
  docs: JobDocumentRow[],
  sourceJobId: string,
  scopes: SoundDocumentationCopyScope[]
) => {
  const wantedScopes = new Set(scopes);
  const latestByGroup = new Map<string, ClassifiedDocument>();

  docs.forEach((doc) => {
    const classified = classifySoundDocument(doc, sourceJobId, wantedScopes);
    if (!classified) return;

    if (classified.scope === "soundDocuments") {
      latestByGroup.set(classified.groupKey, classified);
      return;
    }

    const existing = latestByGroup.get(classified.groupKey);
    const existingTime = Date.parse(existing?.doc.uploaded_at || "") || 0;
    const nextTime = Date.parse(classified.doc.uploaded_at || "") || 0;
    if (!existing || nextTime >= existingTime) {
      latestByGroup.set(classified.groupKey, classified);
    }
  });

  return [...latestByGroup.values()];
};

const getCurrentUserId = async (client: SupabaseLikeClient) => {
  const response = await client.auth?.getUser();
  return response?.data?.user?.id ?? null;
};

const insertCopiedTemplateDocument = async ({
  client,
  doc,
  targetJobId,
  uploadedBy,
}: {
  client: SupabaseLikeClient;
  doc: JobDocumentRow;
  targetJobId: string;
  uploadedBy: string | null;
}) => {
  const { error } = await client.from("job_documents").insert({
    job_id: targetJobId,
    file_name: doc.file_name,
    file_path: doc.file_path,
    file_size: doc.file_size,
    file_type: doc.file_type,
    uploaded_by: uploadedBy,
    original_type: doc.original_type,
    visible_to_tech: doc.visible_to_tech ?? true,
    read_only: true,
    template_type: "soundvision",
    has_preview: false,
    preview_url: null,
    preview_generated_at: null,
  });
  if (error) throw error;
};

const copyJobDocumentFile = async ({
  client,
  doc,
  idFactory,
  scope,
  sourceJobId,
  sourceJobTitle,
  targetJobDate,
  targetJobId,
  targetJobTitle,
  uploadedBy,
}: {
  client: SupabaseLikeClient;
  doc: JobDocumentRow;
  idFactory?: () => string;
  scope: SoundDocumentationCopyScope;
  sourceJobId: string;
  sourceJobTitle?: string | null;
  targetJobDate?: string | null;
  targetJobId: string;
  targetJobTitle?: string | null;
  uploadedBy: string | null;
}) => {
  const sourceLocation = resolveJobDocLocation(doc.file_path);
  const { data: blob, error: downloadError } = await client.storage
    .from(sourceLocation.bucket)
    .download(sourceLocation.path);

  if (downloadError) throw downloadError;
  if (!blob) throw new Error(`No file data returned for ${doc.file_name}`);

  const targetFileName = renameCopiedSoundDocumentFile({
    sourceFileName: doc.file_name,
    sourceJobTitle,
    targetJobTitle,
  });
  const targetPath = buildCopiedSoundDocumentPath({
    idFactory,
    jobScopedStorage: ["power", "soundvision", "material"].includes(scope),
    sourceFilePath: doc.file_path,
    sourceJobId,
    targetFileName,
    targetJobId,
  });
  const targetLocation = resolveJobDocLocation(targetPath);
  const uploadBlob = await maybeRewriteCopiedGeneratedPdf({
    blob,
    doc,
    scope,
    targetJobDate,
    targetJobTitle,
  });

  const { error: uploadError } = await client.storage
    .from(targetLocation.bucket)
    .upload(targetLocation.path, uploadBlob, {
      cacheControl: "0",
      contentType: doc.file_type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { error: insertError } = await client.from("job_documents").insert({
    job_id: targetJobId,
    file_name: targetFileName,
    file_path: targetPath,
    file_size: uploadBlob.size,
    file_type: doc.file_type,
    uploaded_by: uploadedBy,
    original_type: doc.original_type,
    visible_to_tech: doc.visible_to_tech ?? true,
    read_only: doc.read_only ?? false,
    template_type: doc.template_type,
    has_preview: false,
    preview_url: null,
    preview_generated_at: null,
  });
  if (insertError) throw insertError;
};

const copyPowerRequirementRows = async ({
  client,
  sourceJobId,
  targetJobId,
}: {
  client: SupabaseLikeClient;
  sourceJobId: string;
  targetJobId: string;
}) => {
  const { data, error } = await client
    .from<PowerRequirementRow[]>("power_requirement_tables")
    .select("*")
    .eq("job_id", sourceJobId)
    .eq("department", "sound")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = data || [];
  if (rows.length === 0) return 0;

  const { error: deleteError } = await client
    .from("power_requirement_tables")
    .delete()
    .eq("job_id", targetJobId)
    .eq("department", "sound");
  if (deleteError) throw deleteError;

  const now = new Date().toISOString();
  const payload = rows.map((row) => {
    const tableData =
      row.table_data && typeof row.table_data === "object" && !Array.isArray(row.table_data)
        ? { ...row.table_data, generationTimestamp: now }
        : row.table_data;

    return {
      current_per_phase: row.current_per_phase,
      custom_pdu_type: row.custom_pdu_type,
      custom_position: row.custom_position,
      department: "sound",
      includes_hoist: row.includes_hoist,
      job_id: targetJobId,
      pdu_type: row.pdu_type,
      position: row.position,
      stage_name: row.stage_name,
      stage_number: row.stage_number,
      table_data: tableData,
      table_name: row.table_name,
      total_watts: row.total_watts,
      created_at: now,
    };
  });

  const { error: insertError } = await client.from("power_requirement_tables").insert(payload);
  if (insertError) throw insertError;
  return payload.length;
};

const copyMemoriaRows = async ({
  client,
  sourceJobId,
  targetJobId,
  targetJobTitle,
}: {
  client: SupabaseLikeClient;
  sourceJobId: string;
  targetJobId: string;
  targetJobTitle?: string | null;
}) => {
  const { data, error } = await client
    .from<MemoriaTecnicaRow[]>("memoria_tecnica_documents")
    .select("*")
    .eq("job_id", sourceJobId);
  if (error) throw error;

  const rows = data || [];
  if (rows.length === 0) return 0;

  const { error: deleteError } = await client
    .from("memoria_tecnica_documents")
    .delete()
    .eq("job_id", targetJobId);
  if (deleteError) throw deleteError;

  const payload = rows.map((row) => {
    const clearedUrl: string | null = null;
    const {
      id,
      job_id,
      created_at,
      updated_at,
      cover_page_url,
      final_document_url,
      material_list_url,
      power_report_url,
      rigging_plot_url,
      soundvision_report_url,
      weight_report_url,
      ...rest
    } = row;

    return {
      ...rest,
      job_id: targetJobId,
      project_name: targetJobTitle?.trim() || row.project_name || "Trabajo",
      cover_page_url: clearedUrl,
      final_document_url: clearedUrl,
      material_list_url: clearedUrl,
      power_report_url: clearedUrl,
      rigging_plot_url: clearedUrl,
      soundvision_report_url: clearedUrl,
      weight_report_url: clearedUrl,
    };
  });

  const { error: insertError } = await client.from("memoria_tecnica_documents").insert(payload);
  if (insertError) throw insertError;
  return payload.length;
};

export const duplicateSoundDocumentation = async ({
  client = dataLayerClient as unknown as SupabaseLikeClient,
  idFactory,
  scopes = [...SOUND_DOCUMENTATION_COPY_SCOPES],
  sourceJobId,
  sourceJobTitle,
  targetJobDate,
  targetJobId,
  targetJobTitle,
}: DuplicateSoundDocumentationOptions): Promise<SoundDocumentationCopyResult> => {
  if (!sourceJobId || !targetJobId) {
    throw new Error("Source and target jobs are required");
  }

  if (sourceJobId === targetJobId) {
    throw new Error("Choose a different source job");
  }

  const result = emptyResult();
  const wantedScopes = new Set(scopes);
  const uploadedBy = await getCurrentUserId(client);

  if (wantedScopes.has("power")) {
    result.copiedPowerTables = await copyPowerRequirementRows({ client, sourceJobId, targetJobId });
  }

  if (wantedScopes.has("memoria")) {
    result.copiedMemoriaRows = await copyMemoriaRows({
      client,
      sourceJobId,
      targetJobId,
      targetJobTitle,
    });
  }

  const documentScopes = scopes.filter((scope) => scope !== "memoria");
  if (documentScopes.length === 0) return result;

  const { data: docs, error } = await client
    .from<JobDocumentRow[]>("job_documents")
    .select(JOB_DOCUMENT_SELECT)
    .eq("job_id", sourceJobId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;

  const selectedDocuments = selectSoundDocumentsForCopy(docs || [], sourceJobId, documentScopes);
  const hasTemplate = selectedDocuments.some(
    ({ doc }) => doc.template_type === "soundvision" && normalizePath(doc.file_path).startsWith("soundvision-files/")
  );

  if (hasTemplate) {
    const { error: deleteTemplateError } = await client
      .from("job_documents")
      .delete()
      .eq("job_id", targetJobId)
      .eq("template_type", "soundvision");
    if (deleteTemplateError) throw deleteTemplateError;
  }

  for (const { doc, scope } of selectedDocuments) {
    try {
      if (doc.template_type === "soundvision" && normalizePath(doc.file_path).startsWith("soundvision-files/")) {
        await insertCopiedTemplateDocument({ client, doc, targetJobId, uploadedBy });
      } else {
        await copyJobDocumentFile({
          client,
          doc,
          idFactory,
          scope,
          sourceJobId,
          sourceJobTitle,
          targetJobDate,
          targetJobId,
          targetJobTitle,
          uploadedBy,
        });
      }
      result.copiedDocuments += 1;
      incrementScope(result.documentsByScope, scope);
    } catch (error) {
      result.skippedDocuments += 1;
      console.error("[duplicateSoundDocumentation] Failed to copy document", {
        error,
        filePath: doc.file_path,
        sourceJobId,
        targetJobId,
      });
    }
  }

  return result;
};
