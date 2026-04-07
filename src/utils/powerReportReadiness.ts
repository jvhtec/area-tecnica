import {
  TECHNICAL_POWER_DEPARTMENTS,
  type DepartmentPowerReportStatus,
  type PowerReportDocument,
  type TechnicalPowerDepartment,
} from '@/utils/technicalPowerTypes';

const LIGHTS_REPORT_PREFIX = 'calculators/lights-consumos/';
const SHARED_REPORT_PREFIX = 'calculators/consumos/';

const normalizeValue = (value: string | null | undefined) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/');

export const getTechnicalPowerDepartmentFromDocument = (
  document: PowerReportDocument
): TechnicalPowerDepartment | null => {
  const normalizedPath = normalizeValue(document.file_path);
  const normalizedName = normalizeValue(document.file_name).replace(/[\s-]+/g, '_');

  if (normalizedPath.startsWith(LIGHTS_REPORT_PREFIX)) {
    return 'lights';
  }

  if (!normalizedPath.startsWith(SHARED_REPORT_PREFIX)) {
    return null;
  }

  if (normalizedName.includes('video_power_report') || normalizedName.includes('_video_')) {
    return 'video';
  }

  if (normalizedName.includes('sound_power_report') || normalizedName.includes('_sound_')) {
    return 'sound';
  }

  // Sound and video currently share the same storage prefix.
  // If the file is in that folder and is not explicitly video, treat it as sound.
  return 'sound';
};

export const getTechnicalPowerReportStatus = <
  TDocument extends PowerReportDocument = PowerReportDocument,
>(
  documents: TDocument[]
): DepartmentPowerReportStatus<TDocument> => {
  const latestDocsByDepartment: Partial<Record<TechnicalPowerDepartment, TDocument>> = {};

  for (const document of documents) {
    const department = getTechnicalPowerDepartmentFromDocument(document);
    if (!department) continue;

    const current = latestDocsByDepartment[department];
    const currentTimestamp = current?.uploaded_at ? Date.parse(current.uploaded_at) : 0;
    const nextTimestamp = document.uploaded_at ? Date.parse(document.uploaded_at) : 0;

    if (!current || nextTimestamp >= currentTimestamp) {
      latestDocsByDepartment[department] = document;
    }
  }

  const missingDepartments = TECHNICAL_POWER_DEPARTMENTS.filter(
    (department) => !latestDocsByDepartment[department]
  );

  return {
    ready: missingDepartments.length === 0,
    missingDepartments,
    latestDocsByDepartment,
  };
};
