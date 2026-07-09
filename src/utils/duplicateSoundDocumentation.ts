import { dataLayerClient } from "@/services/dataLayerClient";
import { resolveJobDocLocation } from "@/utils/jobDocuments";
import { getTechnicalPowerDepartmentFromDocument } from "@/utils/powerReportReadiness";
import type { Color, PDFFont, PDFPage } from "pdf-lib";

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

const isPdfDocument = (doc: Pick<JobDocumentRow, "file_name" | "file_type">) =>
  doc.file_type?.toLowerCase().includes("pdf") || doc.file_name.toLowerCase().endsWith(".pdf");

const formatDateForCopiedPdf = (
  dateValue: string | null | undefined,
  formatStyle: "short" | "long" = "short"
) => {
  if (!dateValue) return "";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "";

  return formatStyle === "long"
    ? new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(parsed)
    : new Intl.DateTimeFormat("en-GB").format(parsed);
};

const drawCenteredPdfText = (
  page: Pick<PDFPage, "drawText" | "getWidth">,
  text: string,
  y: number,
  options: {
    color: Color;
    font: PDFFont;
    maxWidth?: number;
    minSize?: number;
    size: number;
  }
) => {
  const pageWidth = page.getWidth();
  const maxWidth = options.maxWidth ?? pageWidth - 72;
  let size = options.size;

  while (size > (options.minSize ?? 8) && options.font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }

  const textWidth = options.font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    color: options.color,
    font: options.font,
    size,
    x: Math.max(18, (pageWidth - textWidth) / 2),
    y,
  });
};

const getGeneratedPdfHeader = ({
  scope,
  targetJobDate,
  targetJobTitle,
}: {
  scope: SoundDocumentationCopyScope;
  targetJobDate?: string | null;
  targetJobTitle?: string | null;
}) => {
  const title = targetJobTitle?.trim() || "Trabajo";

  switch (scope) {
    case "power":
      return {
        background: "corporate" as const,
        lines: [
          { text: "Informe de Distribución de Potencia", size: 20, weight: "bold" as const },
          { text: title, size: 14, weight: "regular" as const },
          { text: `Fecha del Trabajo: ${formatDateForCopiedPdf(targetJobDate) || "Sin fecha"}`, size: 11, weight: "regular" as const },
        ],
      };
    case "soundvision":
      return {
        background: "corporate" as const,
        lines: [
          { text: "SOUNDVISION REPORT", size: 20, weight: "bold" as const },
          { text: title, size: 13, weight: "regular" as const },
          { text: formatDateForCopiedPdf(targetJobDate, "long") || "No date", size: 11, weight: "regular" as const },
        ],
      };
    case "material":
      return {
        background: "white" as const,
        lines: [
          { text: "Listado de Material", size: 16, weight: "bold" as const },
          { text: title, size: 12, weight: "regular" as const },
          { text: formatDateForCopiedPdf(targetJobDate) ? `Fecha del Trabajo: ${formatDateForCopiedPdf(targetJobDate)}` : "", size: 10, weight: "regular" as const },
        ].filter((line) => line.text),
      };
    default:
      return null;
  }
};

const rewriteGeneratedPdfHeader = async ({
  blob,
  scope,
  targetJobDate,
  targetJobTitle,
}: {
  blob: Blob;
  scope: SoundDocumentationCopyScope;
  targetJobDate?: string | null;
  targetJobTitle?: string | null;
}) => {
  const header = getGeneratedPdfHeader({ scope, targetJobDate, targetJobTitle });
  if (!header) return blob;

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.load(await blob.arrayBuffer());
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const corporate = rgb(125 / 255, 1 / 255, 1 / 255);
  const white = rgb(1, 1, 1);
  const dark = rgb(0.12, 0.12, 0.12);
  const topBandHeight = header.background === "corporate" ? 114 : 76;

  pdf.getPages().forEach((page) => {
    const pageHeight = page.getHeight();
    const pageWidth = page.getWidth();
    const bandY = pageHeight - topBandHeight;

    page.drawRectangle({
      x: 0,
      y: bandY,
      width: pageWidth,
      height: topBandHeight,
      color: header.background === "corporate" ? corporate : white,
    });

    const textColor = header.background === "corporate" ? white : corporate;
    const secondaryTextColor = header.background === "corporate" ? white : dark;
    const yPositions =
      header.background === "corporate"
        ? [pageHeight - 55, pageHeight - 82, pageHeight - 104]
        : [pageHeight - 24, pageHeight - 45, pageHeight - 62];

    header.lines.forEach((line, index) => {
      drawCenteredPdfText(page, line.text, yPositions[index] ?? yPositions[yPositions.length - 1], {
        color: index === 0 ? textColor : secondaryTextColor,
        font: line.weight === "bold" ? boldFont : regularFont,
        maxWidth: pageWidth - 72,
        minSize: 7,
        size: line.size,
      });
    });
  });

  const bytes = await pdf.save();
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return new Blob([arrayBuffer], { type: "application/pdf" });
};

const maybeRewriteCopiedPdf = async ({
  blob,
  doc,
  scope,
  targetJobDate,
  targetJobTitle,
}: {
  blob: Blob;
  doc: JobDocumentRow;
  scope: SoundDocumentationCopyScope;
  targetJobDate?: string | null;
  targetJobTitle?: string | null;
}) => {
  if (!isPdfDocument(doc) || !["power", "soundvision", "material"].includes(scope)) {
    return blob;
  }

  try {
    return await rewriteGeneratedPdfHeader({
      blob,
      scope,
      targetJobDate,
      targetJobTitle,
    });
  } catch (error) {
    console.warn("[duplicateSoundDocumentation] PDF header rewrite failed; copying original PDF", {
      error,
      filePath: doc.file_path,
    });
    return blob;
  }
};

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
  sourceFilePath,
  sourceJobId,
  targetFileName,
  targetJobId,
}: {
  idFactory?: () => string;
  sourceFilePath: string;
  sourceJobId: string;
  targetFileName: string;
  targetJobId: string;
}) => {
  const normalized = normalizePath(sourceFilePath);
  const sourceSegment = `/${sourceJobId}/`;
  const sourceIndex = normalized.indexOf(sourceSegment);

  if (sourceIndex < 0) {
    throw new Error(`Document path does not include source job id: ${sourceFilePath}`);
  }

  const beforeJob = normalized.slice(0, sourceIndex + 1);
  const afterJob = normalized.slice(sourceIndex + sourceSegment.length);
  const afterSegments = afterJob.split("/").filter(Boolean);
  const scopeSegments = afterSegments.slice(0, -1);
  const destinationFolder = [beforeJob.replace(/\/$/, ""), targetJobId, ...scopeSegments]
    .filter(Boolean)
    .join("/");
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
  const fullPrefix = `${prefix}/${sourceJobId}/`;
  if (!filePath.startsWith(fullPrefix)) return null;

  const rest = filePath.slice(fullPrefix.length);
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
    sourceFilePath: doc.file_path,
    sourceJobId,
    targetFileName,
    targetJobId,
  });
  const targetLocation = resolveJobDocLocation(targetPath);
  const uploadBlob = await maybeRewriteCopiedPdf({
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
