import type { UnknownRecord } from "@/features/tour-ops/tourSchedulingNormalizers";
import { normalizeComparison } from "@/features/tour-ops/tourSchedulingNormalizers";
import type {
  TourOpsAccommodation,
  TourOpsSyncStatus,
  TourOpsTravelSegment,
} from "@/features/tour-ops/types";

export const mergeTravelSegments = (segments: TourOpsTravelSegment[]) => {
  const byKey = new Map<string, TourOpsTravelSegment>();
  const sourceRank: Record<TourOpsTravelSegment["source"], number> = {
    normalized: 3,
    hoja: 2,
    legacy: 1,
  };
  const normalizedIds = new Set(
    segments.filter((segment) => segment.source === "normalized").map((segment) => segment.id),
  );
  const linkedHojaIds = new Set(
    segments
      .filter((segment) => segment.source === "normalized" && segment.linkedHojaRowId)
      .map((segment) => segment.linkedHojaRowId as string),
  );

  segments.forEach((segment) => {
    if (
      segment.source === "hoja"
      && (
        linkedHojaIds.has(segment.id)
        || Boolean(segment.linkedTourRowId && normalizedIds.has(segment.linkedTourRowId))
      )
    ) {
      return;
    }

    const key = [
      segment.fromTourDateId,
      segment.toTourDateId,
      normalizeComparison(segment.fromLabel),
      normalizeComparison(segment.toLabel),
      normalizeComparison(segment.transportationType),
      normalizeComparison(segment.departureTime),
      normalizeComparison(segment.arrivalTime),
    ].join("|");
    const existing = byKey.get(key);
    if (!existing || sourceRank[segment.source] > sourceRank[existing.source]) {
      byKey.set(key, segment);
    }
  });

  return Array.from(byKey.values());
};

export const mergeAccommodations = (accommodations: TourOpsAccommodation[]) => {
  const byKey = new Map<string, TourOpsAccommodation>();
  const sourceRank: Record<TourOpsAccommodation["source"], number> = {
    normalized: 2,
    hoja: 1,
  };
  const normalizedIds = new Set(
    accommodations.filter((hotel) => hotel.source === "normalized").map((hotel) => hotel.id),
  );
  const linkedHojaIds = new Set(
    accommodations
      .filter((hotel) => hotel.source === "normalized" && hotel.linkedHojaRowId)
      .map((hotel) => hotel.linkedHojaRowId as string),
  );

  accommodations.forEach((accommodation) => {
    if (
      accommodation.source === "hoja"
      && (
        linkedHojaIds.has(accommodation.id)
        || Boolean(
          accommodation.linkedTourRowId
          && normalizedIds.has(accommodation.linkedTourRowId)
        )
      )
    ) {
      return;
    }

    const key = [
      accommodation.tourDateId,
      normalizeComparison(accommodation.hotelName),
      normalizeComparison(accommodation.checkInDate),
      normalizeComparison(accommodation.checkOutDate),
    ].join("|");
    const existing = byKey.get(key);
    if (!existing || sourceRank[accommodation.source] > sourceRank[existing.source]) {
      byKey.set(key, accommodation);
    }
  });

  return Array.from(byKey.values());
};

export const travelSyncKey = (segment: TourOpsTravelSegment) => [
  segment.fromTourDateId,
  segment.toTourDateId,
  normalizeComparison(segment.transportationType),
  normalizeComparison(segment.departureTime),
  normalizeComparison(segment.arrivalTime),
].join("|");

export const accommodationSyncKey = (accommodation: TourOpsAccommodation) => [
  accommodation.tourDateId,
  normalizeComparison(accommodation.hotelName),
  normalizeComparison(accommodation.checkInDate),
  normalizeComparison(accommodation.checkOutDate),
].join("|");

export const annotateTravelSyncStatus = (
  segments: TourOpsTravelSegment[],
  allCandidates: TourOpsTravelSegment[],
  hojaByDate: Map<string, UnknownRecord>,
): TourOpsTravelSegment[] => {
  const hojaKeys = new Set(
    allCandidates
      .filter((segment) => segment.source === "hoja")
      .map(travelSyncKey),
  );

  return segments.map((segment) => {
    if (segment.source === "legacy") return { ...segment, syncStatus: "legacy" as const };
    if (segment.source === "hoja") return { ...segment, syncStatus: "imported" as const };

    const linkedDateIds = [segment.fromTourDateId, segment.toTourDateId].filter(Boolean) as string[];
    const hasHojaTarget = linkedDateIds.some((id) => hojaByDate.has(id));
    const syncStatus: TourOpsSyncStatus = segment.linkedHojaRowId
      || hojaKeys.has(travelSyncKey(segment))
      ? "synced"
      : hasHojaTarget
        ? "needs_sync"
        : "no_hoja";

    return {
      ...segment,
      syncStatus,
    };
  });
};

export const annotateAccommodationSyncStatus = (
  accommodations: TourOpsAccommodation[],
  allCandidates: TourOpsAccommodation[],
  hojaByDate: Map<string, UnknownRecord>,
): TourOpsAccommodation[] => {
  const hojaKeys = new Set(
    allCandidates
      .filter((hotel) => hotel.source === "hoja")
      .map(accommodationSyncKey),
  );

  return accommodations.map((hotel) => {
    if (hotel.source === "hoja") return { ...hotel, syncStatus: "imported" as const };
    const hasHojaTarget = Boolean(hotel.tourDateId && hojaByDate.has(hotel.tourDateId));
    const syncStatus: TourOpsSyncStatus = hotel.linkedHojaRowId
      || hojaKeys.has(accommodationSyncKey(hotel))
      ? "synced"
      : hasHojaTarget
        ? "needs_sync"
        : "no_hoja";

    return {
      ...hotel,
      syncStatus,
    };
  });
};
