import { validateFileUpload } from "@/lib/enhanced-security-config";

export const DOCUMENT_UPLOAD_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.txt,.xmlp,.xmlc,.xmls,.dwg,.dfx,.dxf";

export const getDocumentUploadValidationError = (files: File[]) => {
  for (const file of files) {
    const validation = validateFileUpload(file);
    if (!validation.isValid) {
      return `${file.name}: ${validation.errors.join(", ")}`;
    }
  }

  return null;
};
