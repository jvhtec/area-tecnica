const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const TRAILING_DOTS_SPACES = /[. ]+$/g;

export const sanitizeFilenamePart = (value: unknown, fallback = "Documento"): string => {
  const text = String(value ?? "")
    .replace(INVALID_FILENAME_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(TRAILING_DOTS_SPACES, "")
    .trim();

  if (!text) return fallback;
  return text;
};

export const formatDateForFilename = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const buildReadableFilename = (
  parts: Array<unknown>,
  extension: string = "pdf",
): string => {
  const normalizedParts = parts
    .map((part) => sanitizeFilenamePart(part, ""))
    .filter((part) => part.length > 0);

  const baseName = normalizedParts.length > 0 ? normalizedParts.join(" - ") : "Documento";
  const safeBaseName = sanitizeFilenamePart(baseName, "Documento");
  const safeExtension = sanitizeFilenamePart(extension.replace(/^\./, ""), "pdf").replace(/\s+/g, "");

  return `${safeBaseName}.${safeExtension}`;
};
