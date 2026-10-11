/** Flex manifest status is authoritative. Unknown states must never publish. */
export const PUBLISHABLE_MANIFEST_STATUS_IDS = new Set([
  "70b2de6c-aee8-11df-b8d5-00e08175e43e", // Preparado
  "4dc8c4ec-aee9-11df-b8d5-00e08175e43e", // Enviado
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Allow only authoritative Preparado/Enviado status UUIDs, never display labels. */
export function isPublishableStatus(statusId: unknown): boolean {
  return typeof statusId === "string" && PUBLISHABLE_MANIFEST_STATUS_IDS.has(statusId.toLowerCase());
}

/** Do not search arbitrary nested fields: only the manifest's own status qualifies. */
export function manifestStatusId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const status = record.statusId ?? record.statusOptionId ?? record.status;
  if (typeof status === "string") return UUID.test(status) ? status.toLowerCase() : null;
  if (status && typeof status === "object" && !Array.isArray(status)) {
    const nested = status as Record<string, unknown>;
    const option = nested.data && typeof nested.data === "object" && !Array.isArray(nested.data)
      ? nested.data as Record<string, unknown>
      : nested;
    return typeof option.id === "string" && UUID.test(option.id) ? option.id.toLowerCase() : null;
  }
  return null;
}

/** Build the operation-confirmed report request for a validated manifest UUID. */
export function manifestReportUrl(manifestId: string): string {
  if (!UUID.test(manifestId)) throw new Error("Invalid Flex manifest ID");
  const url = new URL("https://sectorpro.flexrentalsolutions.com/f5/api/report/generate/generate-pdf");
  const parameters = {
    parameterSubmission: "true",
    REPORT_TIME_ZONE: "Europe/Madrid",
    REPORT_LOCALE: "es_ES",
    REPORT_CURRENCY_SYMBOL: "€",
    PROJECT_ELEMENT_DEFINITION_ID: "9945d54c-af32-11df-b8d5-00e08175e43e",
    PROJECT_ELEMENT_ID: manifestId,
    ELEMENT_VIEW_ID: "54110f73-c28a-11f1-bdc7-02e7c1b689d7",
    REPORT_FORMAT: "pdf",
    REPORT_PAPER_SIZE: "A4",
  };
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url.toString();
}

/** Flex may return base64 text with application/pdf content type. */
export function decodeFlexPdf(raw: Uint8Array): Uint8Array {
  /** Recognize the binary PDF header before accepting direct or decoded report bytes. */
  const magic = (bytes: Uint8Array) => bytes.length > 4 && bytes[0] === 37 &&
    bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70 && bytes[4] === 45;
  if (magic(raw)) return raw;
  const encoded = new TextDecoder().decode(raw).trim();
  if (!/^[A-Za-z0-9+/\r\n=]+$/.test(encoded)) throw new Error("Invalid Flex PDF encoding");
  const decoded = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  if (!magic(decoded)) throw new Error("Flex did not return a PDF");
  return decoded;
}

/** Flex header fields are wrapped in { data: ... }; never use object stringification. */
export function headerText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["data", "preferredDisplayString", "displayString", "name"]) {
    const text = headerText(record[key]);
    if (text) return text;
  }
  return null;
}

/** Describe a manifest using Madrid's calendar date and safe, bounded header text. */
export function soundManifestFileName(args: {
  jobTitle: string;
  startTime: string;
  manifestId: string;
  documentNumber?: string | null;
}): string {
  /** Strip filename separators and control characters without mangling ordinary text. */
  const clean = (text: string, max: number) =>
    text.normalize("NFC").replace(/[\\/<>:"|?*]/g, " ")
      .replace(/[^\P{Cc}]/gu, " ")
      .replace(/\s+/g, " ").trim().replace(/[. ]+$/g, "").slice(0, max);
  const start = new Date(args.startTime);
  const date = Number.isNaN(start.getTime()) ? "sin-fecha" : new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(start);
  const job = clean(args.jobTitle, 85) || "Trabajo";
  const number = clean(args.documentNumber ?? "", 45);
  // Include a stable manifest suffix even when Flex has no document number.
  const suffix = args.manifestId.slice(0, 8);
  return `Manifiesto de salida - Sonido - ${date} - ${job}${number ? ` - ${number}` : ""} - ${suffix}.pdf`;
}
