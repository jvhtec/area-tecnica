import { useCallback, useMemo, useState } from "react";

import type { HojaSectionId } from "@/features/hoja-de-ruta/model/sectionDefinitions";
import { hojaDocumentSchema } from "@/features/hoja-de-ruta/model/hojaDocumentSchema";
import type { Accommodation, EventData, TravelArrangement } from "@/types/hoja-de-ruta";

export type HojaValidationIssue = {
  path: string;
  message: string;
  section: HojaSectionId;
};

export class HojaDocumentValidationError extends Error {
  constructor(
    public readonly firstSection: HojaSectionId,
    public readonly issues: HojaValidationIssue[],
  ) {
    super("La Hoja de Ruta contiene campos que requieren revisión.");
    this.name = "HojaDocumentValidationError";
  }
}

const sectionForPath = (path: PropertyKey[]): HojaSectionId => {
  const [root, child] = path;
  if (root === "travelArrangements") return "travel";
  if (root === "accommodations") return "accommodation";
  if (root !== "eventData") return "event";
  if (child === "venue") return "venue";
  if (child === "contacts") return "contacts";
  if (child === "staff") return "staff";
  if (child === "logistics") return "logistics";
  if (child === "restaurants" || child === "selectedRestaurants") return "restaurants";
  if (child === "weather") return "weather";
  if (child === "schedule" || child === "programScheduleDays") return "schedule";
  return "event";
};

export const useHojaValidation = (
  eventData: EventData,
  travelArrangements: TravelArrangement[],
  accommodations: Accommodation[],
) => {
  const [showAllErrors, setShowAllErrors] = useState(false);

  // The schema validates the live document directly; `safeParse` accepts any
  // input, so the editor state needs no conversion.
  const issues = useMemo<HojaValidationIssue[]>(() => {
    const result = hojaDocumentSchema.safeParse({ eventData, travelArrangements, accommodations });
    if (result.success) return [];
    return result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      section: sectionForPath(issue.path),
    }));
  }, [accommodations, eventData, travelArrangements]);

  const issuesBySection = useMemo(() => {
    const grouped = {} as Partial<Record<HojaSectionId, HojaValidationIssue[]>>;
    for (const issue of issues) {
      grouped[issue.section] = [...(grouped[issue.section] || []), issue];
    }
    return grouped;
  }, [issues]);

  const validateDocument = useCallback(async () => {
    setShowAllErrors(true);
    if (issues.length) {
      throw new HojaDocumentValidationError(issues[0].section, issues);
    }
    return true;
  }, [issues]);

  const errorFor = useCallback((path: string) => {
    if (!showAllErrors) return undefined;
    return issues.find((issue) => issue.path === path)?.message;
  }, [issues, showAllErrors]);

  return {
    issues,
    issuesBySection,
    showAllErrors,
    errorFor,
    validateDocument,
  };
};
