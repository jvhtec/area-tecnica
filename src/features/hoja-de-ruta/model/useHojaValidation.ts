import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import type { HojaSectionId } from "@/features/hoja-de-ruta/model/sectionDefinitions";
import {
  hojaDocumentSchema,
  type HojaDocumentValidationValues,
} from "@/features/hoja-de-ruta/model/hojaDocumentSchema";
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
  const values = useMemo<HojaDocumentValidationValues>(() => ({
    eventData: eventData as unknown as HojaDocumentValidationValues["eventData"],
    travelArrangements: travelArrangements as unknown as HojaDocumentValidationValues["travelArrangements"],
    accommodations: accommodations as unknown as HojaDocumentValidationValues["accommodations"],
  }), [accommodations, eventData, travelArrangements]);
  const form = useForm<HojaDocumentValidationValues>({
    resolver: zodResolver(hojaDocumentSchema),
    values,
    mode: "onBlur",
  });
  const [showAllErrors, setShowAllErrors] = useState(false);

  const issues = useMemo<HojaValidationIssue[]>(() => {
    const result = hojaDocumentSchema.safeParse(values);
    if (result.success) return [];
    return result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      section: sectionForPath(issue.path),
    }));
  }, [values]);

  const issuesBySection = useMemo(() => {
    const grouped = {} as Partial<Record<HojaSectionId, HojaValidationIssue[]>>;
    for (const issue of issues) {
      grouped[issue.section] = [...(grouped[issue.section] || []), issue];
    }
    return grouped;
  }, [issues]);

  const validateDocument = useCallback(async () => {
    setShowAllErrors(true);
    const isValid = await form.trigger(undefined, { shouldFocus: false });
    if (!isValid && issues.length) {
      throw new HojaDocumentValidationError(issues[0].section, issues);
    }
    return true;
  }, [form, issues]);

  const errorFor = useCallback((path: string) => {
    if (!showAllErrors) return undefined;
    return issues.find((issue) => issue.path === path)?.message;
  }, [issues, showAllErrors]);

  return {
    form,
    issues,
    issuesBySection,
    showAllErrors,
    errorFor,
    validateDocument,
  };
};
