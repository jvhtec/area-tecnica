import type { PackageDepartment } from "@/utils/tourPackages";

const AUTO_DEFAULT_DOCUMENT_ROOT = "auto-generated/default-pdfs";

export type TourDefaultDocumentType = "power" | "weight";

export const createTourDefaultDocumentVersionKey = (): string =>
  globalThis.crypto?.randomUUID?.().replace(/-/g, "") ??
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

export const getTourDefaultDocumentSlotPrefix = ({
  tourId,
  tourDateId,
  department,
  type,
}: {
  tourId: string;
  tourDateId: string;
  department: PackageDepartment;
  type: TourDefaultDocumentType;
}) =>
  `tours/${tourId}/${AUTO_DEFAULT_DOCUMENT_ROOT}/${tourDateId}/${department}-${type}`;

export const getTourDefaultDocumentObjectPath = ({
  tourId,
  tourDateId,
  department,
  type,
  versionKey,
}: {
  tourId: string;
  tourDateId: string;
  department: PackageDepartment;
  type: TourDefaultDocumentType;
  versionKey?: string;
}) => {
  const slotPrefix = getTourDefaultDocumentSlotPrefix({
    tourId,
    tourDateId,
    department,
    type,
  });
  return versionKey ? `${slotPrefix}-${versionKey}.pdf` : `${slotPrefix}.pdf`;
};
