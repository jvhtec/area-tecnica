import { useCallback, useEffect, useState } from "react";
import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";
import { findLatestJobDocumentForStage } from "@/utils/jobDocuments/stageAwareLookup";
import { getTechnicalPowerDepartmentFromDocument } from "@/utils/powerReportReadiness";
import type { TechnicalPowerDepartment } from "@/utils/technicalPowerTypes";

export interface DetectedMemoriaDocument {
  filePath: string;
  fileName: string;
  uploadedAt: string | null;
}

export type MemoriaAutoFillCategorySpec =
  | string
  | {
      category: string;
      powerDepartment?: TechnicalPowerDepartment;
    };

const getAutoFillCategory = (spec: MemoriaAutoFillCategorySpec) =>
  typeof spec === "string" ? spec : spec.category;

/**
 * Looks up the latest already-generated job_documents PDF (Pesos/Consumos/SV Report)
 * per Memoria Técnica section, scoped to the selected job + festival stage, so the
 * Memoria form can pre-fill those sections instead of asking the user to re-upload
 * documents the app already produced.
 *
 * `categoriesBySection` maps a Memoria document-section id (e.g. "weight") to the
 * job_documents storage category it should be looked up under (e.g. "calculators/pesos").
 */
export const useMemoriaAutoFill = (
  jobId: string,
  stage: TechnicalStage | null,
  categoriesBySection: Record<string, MemoriaAutoFillCategorySpec>
): { detected: Record<string, DetectedMemoriaDocument | null>; isLoading: boolean; refetch: () => void } => {
  const [detected, setDetected] = useState<Record<string, DetectedMemoriaDocument | null>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);
  const categoriesKey = Object.entries(categoriesBySection)
    .map(([section, spec]) => {
      if (typeof spec === "string") return `${section}:${spec}`;
      return `${section}:${spec.category}:${spec.powerDepartment ?? ""}`;
    })
    .sort()
    .join(",");

  const refetch = useCallback(() => setRefetchToken((token) => token + 1), []);

  useEffect(() => {
    if (!jobId) {
      setDetected({});
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const entries = await Promise.all(
        Object.entries(categoriesBySection).map(async ([sectionId, spec]) => {
          try {
            const category = getAutoFillCategory(spec);
            const doc = await findLatestJobDocumentForStage(
              jobId,
              category,
              stage,
              typeof spec === "string" || !spec.powerDepartment
                ? undefined
                : (document) => getTechnicalPowerDepartmentFromDocument(document) === spec.powerDepartment
            );
            return [
              sectionId,
              doc
                ? { filePath: doc.file_path, fileName: doc.file_name, uploadedAt: doc.uploaded_at }
                : null,
            ] as const;
          } catch (error) {
            console.error(`Error looking up detected document for ${sectionId}:`, error);
            return [sectionId, null] as const;
          }
        })
      );

      if (!cancelled) {
        setDetected(Object.fromEntries(entries));
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, stage?.number, categoriesKey, refetchToken]);

  return { detected, isLoading, refetch };
};
