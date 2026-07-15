import { validateFileUpload } from "@/lib/enhanced-security-config";
import { getErrorMessage } from "@/utils/errorMessage";

export const DOCUMENT_UPLOAD_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.txt,.xmlp,.xmlc,.xmls,.nwm,.dwg,.dfx,.dxf,.mvr";
export const DOCUMENT_UPLOAD_FORMAT_LABEL = DOCUMENT_UPLOAD_ACCEPT
  .split(",")
  .map((extension) => extension.slice(1).toUpperCase())
  .join(", ");

export const getDocumentUploadErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error);

  if (/no se pudo completar la subida del archivo grande/i.test(message)) {
    return message;
  }

  if (/user not authenticated|usuario no autenticado|not authenticated|jwt.*expired|invalid.*jwt|session.*expired/i.test(message)) {
    return "Tu sesión no es válida o ha caducado. Inicia sesión de nuevo e inténtalo otra vez.";
  }

  if (/not allowed|permission denied|row-level security|unauthorized|forbidden|\b42501\b/i.test(message)) {
    return "No tienes permiso para subir este documento.";
  }

  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(message)) {
    return "No se pudo conectar con el servidor de archivos. Revisa tu conexión e inténtalo de nuevo.";
  }

  if (/payload too large|file.*too large|exceeds.*size|\b413\b/i.test(message)) {
    return "El archivo supera el tamaño permitido.";
  }

  if (/bucket not found|storage.*not found/i.test(message)) {
    return "El almacenamiento de documentos no está disponible. Contacta con soporte.";
  }

  return "No se pudo completar la subida. Inténtalo de nuevo y, si el problema continúa, contacta con soporte.";
};

export const getDocumentUploadValidationError = (files: File[]) => {
  for (const file of files) {
    const validation = validateFileUpload(file);
    if (!validation.isValid) {
      return `${file.name}: ${validation.errors.join(", ")}`;
    }
  }

  return null;
};
