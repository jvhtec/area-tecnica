import { HttpError } from "./http.ts";

const MAX_PROJECT_NAME_LENGTH = 160;
const MAX_SOURCE_URL_LENGTH = 4 * 1024;
const MAX_DOCUMENTS = 5;
export const MAX_MEMORIA_PDF_BYTES = 20 * 1024 * 1024;
const MAX_LOGO_BYTES = 3 * 1024 * 1024;
export const MAX_MEMORIA_TOTAL_SOURCE_BYTES = 50 * 1024 * 1024;
const SOURCE_TIMEOUT_MS = 12_000;

type UnknownRecord = Record<string, unknown>;

export interface MemoriaRequestInput {
  documentUrls: Record<string, string>;
  logoUrl: string | null;
  projectName: string;
}

export class SourceByteBudget {
  private usedBytes = 0;

  constructor(private readonly limitBytes = MAX_MEMORIA_TOTAL_SOURCE_BYTES) {}

  reserve(bytes: number) {
    if (bytes > this.limitBytes - this.usedBytes) {
      throw new HttpError(413, "Los documentos de origen superan el tamaño total permitido", {
        code: "source_total_too_large",
        details: {
          attemptedBytes: bytes,
          maxBytes: this.limitBytes,
          usedBytes: this.usedBytes,
        },
      });
    }
    this.usedBytes += bytes;
  }
}

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasControlCharacters = (value: string) =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });

/** Ensures every caller-controlled source belongs to this project's Storage API. */
export function assertAllowedStorageSourceUrl(value: unknown, supabaseUrl: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_SOURCE_URL_LENGTH) {
    throw new HttpError(400, "La URL del archivo de almacenamiento no es válida", { code: "invalid_source_url" });
  }

  let source: URL;
  let project: URL;
  try {
    source = new URL(value);
    project = new URL(supabaseUrl);
  } catch {
    throw new HttpError(400, "La URL del archivo de almacenamiento no es válida", { code: "invalid_source_url" });
  }

  const projectPath = project.pathname.replace(/\/$/, "");
  const storagePrefix = `${projectPath}/storage/v1/object/`;
  const supportedObjectPrefixes = ["sign/", "public/"];
  const sourceSuffix = source.pathname.startsWith(storagePrefix)
    ? source.pathname.slice(storagePrefix.length)
    : "";

  if (
    source.origin !== project.origin ||
    !supportedObjectPrefixes.some((prefix) => sourceSuffix.startsWith(prefix))
  ) {
    throw new HttpError(400, "El origen debe ser una URL de objeto de Supabase Storage", {
      code: "invalid_source_origin",
    });
  }

  if (sourceSuffix.startsWith("sign/") && !source.searchParams.get("token")) {
    throw new HttpError(400, "Las URL firmadas de almacenamiento requieren un token", {
      code: "invalid_signed_source_url",
    });
  }

  return source.toString();
}

export function parseMemoriaRequestInput(
  body: UnknownRecord,
  supabaseUrl: string,
  allowedDocumentKeys: readonly string[],
): MemoriaRequestInput {
  const projectName = typeof body.projectName === "string" ? body.projectName.trim() : "";
  if (!projectName || projectName.length > MAX_PROJECT_NAME_LENGTH || hasControlCharacters(projectName)) {
    throw new HttpError(400, "El nombre del proyecto debe ser un texto breve y no vacío", {
      code: "invalid_project_name",
    });
  }

  if (!isRecord(body.documentUrls)) {
    throw new HttpError(400, "documentUrls debe ser un objeto", { code: "invalid_document_urls" });
  }

  const allowedKeys = new Set(allowedDocumentKeys);
  const entries = Object.entries(body.documentUrls);
  if (entries.length === 0 || entries.length > MAX_DOCUMENTS) {
    throw new HttpError(400, "Debes proporcionar entre uno y cinco documentos", {
      code: "invalid_document_count",
    });
  }

  const documentUrls: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!allowedKeys.has(key)) {
      throw new HttpError(400, `Clave de documento no admitida: ${key}`, {
        code: "unsupported_document_key",
      });
    }
    documentUrls[key] = assertAllowedStorageSourceUrl(value, supabaseUrl);
  }

  const logoUrl = body.logoUrl === undefined || body.logoUrl === null
    ? null
    : assertAllowedStorageSourceUrl(body.logoUrl, supabaseUrl);

  return { documentUrls, logoUrl, projectName };
}

const readBoundedResponse = async (response: Response, maxBytes: number, budget: SourceByteBudget) => {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpError(413, "El archivo de origen es demasiado grande", {
      code: "source_too_large",
      details: {
        actualBytes: declaredLength,
        maxBytes,
        measurement: "content-length",
      },
    });
  }
  if (!response.body) {
    throw new HttpError(422, "El archivo de origen no contiene datos", { code: "empty_source" });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "El archivo de origen es demasiado grande", {
        code: "source_too_large",
        details: {
          actualBytes: total,
          maxBytes,
          measurement: "stream",
        },
      });
    }
    chunks.push(value);
  }

  budget.reserve(total);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

/** Fetches a pre-validated Storage URL with time, redirect, and byte limits. */
export async function fetchMemoriaSource(
  sourceUrl: string,
  budget: SourceByteBudget,
  options: { maxBytes?: number } = {},
): Promise<Uint8Array> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      redirect: "error",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) {
      throw new HttpError(422, "No se pudo cargar el archivo de origen", { code: "source_fetch_failed" });
    }
    return await readBoundedResponse(response, options.maxBytes ?? MAX_MEMORIA_PDF_BYTES, budget);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HttpError(408, "La solicitud del archivo de origen ha superado el tiempo de espera", { code: "source_fetch_timeout" });
    }
    throw new HttpError(422, "No se pudo cargar el archivo de origen", { code: "source_fetch_failed" });
  } finally {
    clearTimeout(timeout);
  }
}

export const isPdfBytes = (bytes: Uint8Array) =>
  bytes.length >= 5 &&
  bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 &&
  bytes[3] === 0x46 && bytes[4] === 0x2d;

export const getMemoriaPdfValidationMessage = (
  documentLabel: string,
  reason: "invalid" | "page_limit" | "unreadable",
) => {
  switch (reason) {
    case "invalid":
      return `El documento «${documentLabel}» no es un PDF válido`;
    case "page_limit":
      return `El documento «${documentLabel}» supera el límite de páginas`;
    case "unreadable":
      return `No se puede leer el documento «${documentLabel}» como PDF`;
  }
};

const getErrorDetails = (error: HttpError): UnknownRecord =>
  isRecord(error.details) ? error.details : {};

const getLimitInMiB = (value: unknown, fallback: number) => {
  const bytes = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.round(bytes / (1024 * 1024));
};

const sanitizeMemoriaDiagnostic = (value: unknown) => {
  if (typeof value !== "string") return undefined;

  return value
    .replace(/([?&](?:token|access_token|apikey)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 2_000);
};

/**
 * Converts a source-processing failure into a document-labelled client error and
 * emits a token-free structured record for Supabase Function logs.
 */
export function reportMemoriaDocumentFailure(
  functionName: string,
  documentKey: string,
  documentLabel: string,
  error: unknown,
): HttpError {
  const originalMessage = error instanceof Error
    ? sanitizeMemoriaDiagnostic(error.message)
    : undefined;
  const originalStack = error instanceof Error
    ? sanitizeMemoriaDiagnostic(error.stack)
    : undefined;
  const original = error instanceof HttpError
    ? error
    : new HttpError(422, getMemoriaPdfValidationMessage(documentLabel, "unreadable"), {
      code: "invalid_pdf_source",
    });
  const details = getErrorDetails(original);

  let normalized = original;

  if (original.code === "source_too_large") {
    normalized = new HttpError(
      413,
      `El documento «${documentLabel}» supera el límite de ${
        getLimitInMiB(details.maxBytes, MAX_MEMORIA_PDF_BYTES)
      } MB`,
      { code: original.code },
    );
  } else if (original.code === "source_total_too_large") {
    normalized = new HttpError(
      413,
      `Los documentos de origen superan el límite total de ${
        getLimitInMiB(details.maxBytes, MAX_MEMORIA_TOTAL_SOURCE_BYTES)
      } MB al procesar «${documentLabel}»`,
      { code: original.code },
    );
  }

  console.error("memoria_document_rejected", {
    actualBytes: details.actualBytes,
    attemptedBytes: details.attemptedBytes,
    code: normalized.code ?? "unknown",
    documentKey,
    documentLabel,
    functionName,
    maxBytes: details.maxBytes,
    message: normalized.message,
    measurement: details.measurement,
    originalMessage,
    originalStack,
    status: normalized.status,
    usedBytes: details.usedBytes,
  });

  return normalized;
}

export const getSupportedImageFormat = (bytes: Uint8Array): "png" | "jpg" | null => {
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (isPng) return "png";
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "jpg" : null;
};

export async function fetchOptionalMemoriaLogo(logoUrl: string | null, budget: SourceByteBudget) {
  if (!logoUrl) return null;
  const bytes = await fetchMemoriaSource(logoUrl, budget, { maxBytes: MAX_LOGO_BYTES });
  const format = getSupportedImageFormat(bytes);
  if (!format) {
    throw new HttpError(422, "El logotipo debe ser una imagen PNG o JPEG", { code: "invalid_logo_format" });
  }
  return { bytes, format };
}
