export interface FlexReportFileIdentityInput {
  department: string;
  displayName?: string | null;
  documentNumber?: string | null;
  elementId: string;
  fileNamePrefix: string;
  versionKey: string;
}

const DEPARTMENT_FILE_LABELS: Record<string, string> = {
  lights: "Iluminacion",
  production: "Produccion",
  sound: "Sonido",
  video: "Video",
};

export const sanitizeFlexReportFileNameSegment = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 80)
    .replace(/^_|_$/g, "") || "segment";

const isGenericDisplayName = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized === "presupuesto" || normalized === "unnamed";
};

export const buildFlexReportFileIdentity = ({
  department,
  displayName,
  documentNumber,
  elementId,
  fileNamePrefix,
  versionKey,
}: FlexReportFileIdentityInput) => {
  const descriptorParts = [DEPARTMENT_FILE_LABELS[department] || department];
  if (displayName?.trim() && !isGenericDisplayName(displayName)) {
    descriptorParts.push(displayName.trim());
  }
  if (
    documentNumber?.trim() &&
    !descriptorParts.some((part) => part.toLowerCase().includes(documentNumber.trim().toLowerCase()))
  ) {
    descriptorParts.push(documentNumber.trim());
  }

  // The short ID keeps otherwise-identical Flex names distinct for operators.
  // The storage prefix below uses the full UUID as the authoritative identity.
  descriptorParts.push(elementId.replace(/-/g, "").slice(0, 8) || elementId);

  const safeDescriptor = descriptorParts
    .map(sanitizeFlexReportFileNameSegment)
    .filter(Boolean)
    .join(" - ");
  const fileName = `${fileNamePrefix} - ${safeDescriptor}.pdf`;
  const elementStoragePrefix = `${sanitizeFlexReportFileNameSegment(elementId)}--`;
  const objectName = `${elementStoragePrefix}${sanitizeFlexReportFileNameSegment(versionKey)}--${fileName}`;

  return {
    elementStoragePrefix,
    fileName,
    legacyFileName: `${fileNamePrefix} - ${sanitizeFlexReportFileNameSegment(department)}.pdf`,
    objectName,
  };
};

export const isFlexReportPredecessorObject = (
  objectName: string,
  elementStoragePrefix: string,
  legacyFileName: string,
) => objectName.startsWith(elementStoragePrefix) || objectName === legacyFileName;
