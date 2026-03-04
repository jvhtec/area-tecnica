import { format } from 'date-fns';
import { buildReadableFilename, formatDateForFilename, sanitizeFilenamePart } from '@/utils/fileName';

const toKebabFilenamePart = (value: unknown): string => {
  const safeValue = sanitizeFilenamePart(value, '').toLowerCase();
  return safeValue ? safeValue.split(' ').join('-') : '';
};

const buildKebabPdfFilename = (parts: Array<unknown>): string => {
  const normalizedParts = parts
    .map((part) => toKebabFilenamePart(part))
    .filter((part) => part.length > 0);

  return buildReadableFilename([normalizedParts.join('-')], 'pdf');
};

const firstNonEmptyFilenameValue = (...values: Array<unknown>): unknown =>
  values.find((value) => sanitizeFilenamePart(value, '').length > 0) ?? '';

interface PayoutFilenameInput {
  jobTitle?: string | null;
  jobId?: string | null;
  technicianName?: string | null;
  technicianId?: string | null;
  generatedAt?: string | Date | null;
}

export const buildTourPayoutPdfFilename = ({
  jobTitle,
  jobId,
  technicianName,
  technicianId,
  generatedAt = new Date(),
}: PayoutFilenameInput): string =>
  buildKebabPdfFilename([
    'pago',
    firstNonEmptyFilenameValue(jobTitle, jobId),
    firstNonEmptyFilenameValue(technicianName, technicianId),
    formatDateForFilename(generatedAt),
  ]);

export const buildJobPayoutPdfFilename = ({
  jobTitle,
  jobId,
  technicianName,
  technicianId,
  generatedAt = new Date(),
}: PayoutFilenameInput): string =>
  buildKebabPdfFilename([
    'pago',
    firstNonEmptyFilenameValue(jobTitle, jobId),
    firstNonEmptyFilenameValue(technicianName, technicianId),
    formatDateForFilename(generatedAt),
  ]);

export const buildPayoutDuePdfFilename = (
  paymentFrom: string | Date | null | undefined,
  paymentTo: string | Date | null | undefined,
): string =>
  buildKebabPdfFilename([
    'pagos previstos',
    formatDateForFilename(paymentFrom),
    formatDateForFilename(paymentTo),
  ]);

export const buildIncidentReportPdfFilename = (
  jobTitle: string | null | undefined,
  generatedAt: Date = new Date(),
): string =>
  buildKebabPdfFilename([
    'reporte incidencia',
    jobTitle || '',
    formatDateForFilename(generatedAt),
    sanitizeFilenamePart(format(generatedAt, 'HH-mm-ss'), '').toLowerCase(),
  ]);

export const buildVacationRequestPdfFilename = (
  technicianName: string | null | undefined,
  requestDate: string | Date | null | undefined,
): string =>
  buildKebabPdfFilename([
    'vacation request',
    technicianName || '',
    formatDateForFilename(requestDate),
  ]);
