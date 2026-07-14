import { getDepartmentLabel } from "@/types/department";
import { buildReadableFilename } from "@/utils/fileName";
import type { TechnicalPowerDepartment } from "@/utils/technicalPowerTypes";

export type TechnicalPdfDocumentType = "power" | "weight";

const getDocumentTypeLabel = (type: TechnicalPdfDocumentType) =>
  type === "power" ? "potencia" : "peso";

const getDocumentDescriptor = ({
  department,
  packageLabel,
  type,
}: {
  department: string;
  packageLabel?: string;
  type: TechnicalPdfDocumentType;
}) => `${packageLabel || getDepartmentLabel(department)} ${getDocumentTypeLabel(type)}`;

export const getJobTechnicalPdfFileName = (
  department: TechnicalPowerDepartment,
  jobName: string,
  type: TechnicalPdfDocumentType,
) => buildReadableFilename([jobName, getDocumentDescriptor({ department, type })]);

export const getTourDefaultsPdfFileName = (
  tourName: string,
  department: string,
  type: TechnicalPdfDocumentType,
  packageLabel?: string,
) =>
  buildReadableFilename([
    tourName,
    `${getDocumentDescriptor({ department, packageLabel, type })} predeterminados`,
  ]);

export const getTourDateTechnicalPdfFileName = (
  tourName: string,
  date: string,
  locationName: string,
  department: string,
  type: TechnicalPdfDocumentType,
  packageLabel?: string,
) =>
  buildReadableFilename([
    tourName,
    date,
    locationName,
    getDocumentDescriptor({ department, packageLabel, type }),
  ]);
