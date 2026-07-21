import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";
import { findJobDocumentsForStage } from "@/utils/jobDocuments/stageAwareLookup";
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

export interface MemoriaAutoFillResult {
  candidates: Record<string, DetectedMemoriaDocument[]>;
  detected: Record<string, DetectedMemoriaDocument | null>;
  isLoading: boolean;
  refetch: (preferLatestSectionId?: string) => void;
  selectDocument: (sectionId: string, filePath: string) => void;
}

/**
 * Looks up every already-generated job_documents PDF (Pesos/Consumos/SV Report)
 * per Memoria Técnica section, scoped to the selected job + festival stage. The
 * newest candidate is selected by default, while callers can choose another when
 * extras or multi-stage workflows produced more than one eligible document.
 *
 * `categoriesBySection` maps a Memoria document-section id (e.g. "weight") to the
 * job_documents storage category it should be looked up under (e.g. "calculators/pesos").
 */
export const useMemoriaAutoFill = (
  jobId: string,
  stage: TechnicalStage | null,
  categoriesBySection: Record<string, MemoriaAutoFillCategorySpec>
): MemoriaAutoFillResult => {
  const [candidates, setCandidates] = useState<Record<string, DetectedMemoriaDocument[]>>({});
  const [selectedPaths, setSelectedPaths] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);
  const preferLatestSectionRef = useRef<string | null>(null);
  const selectionContextRef = useRef("");
  const categoriesKey = Object.entries(categoriesBySection)
    .map(([section, spec]) => {
      if (typeof spec === "string") return `${section}:${spec}`;
      return `${section}:${spec.category}:${spec.powerDepartment ?? ""}`;
    })
    .sort()
    .join(",");
  const selectionContextKey = `${jobId}:${stage?.number ?? "none"}:${stage?.name ?? ""}:${categoriesKey}`;

  const refetch = useCallback((preferLatestSectionId?: string) => {
    preferLatestSectionRef.current = preferLatestSectionId ?? null;
    setRefetchToken((token) => token + 1);
  }, []);

  const selectDocument = useCallback((sectionId: string, filePath: string) => {
    setSelectedPaths((current) => ({ ...current, [sectionId]: filePath }));
  }, []);

  useEffect(() => {
    if (!jobId) {
      setCandidates({});
      setSelectedPaths({});
      selectionContextRef.current = "";
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const entries = await Promise.all(
        Object.entries(categoriesBySection).map(async ([sectionId, spec]) => {
          try {
            const category = getAutoFillCategory(spec);
            const docs = await findJobDocumentsForStage(
              jobId,
              category,
              stage,
              typeof spec === "string" || !spec.powerDepartment
                ? undefined
                : (document) => getTechnicalPowerDepartmentFromDocument(document) === spec.powerDepartment
            );
            return [
              sectionId,
              docs.map((doc) => ({
                filePath: doc.file_path,
                fileName: doc.file_name,
                uploadedAt: doc.uploaded_at,
              })),
            ] as const;
          } catch (error) {
            console.error(`Error looking up detected document for ${sectionId}:`, error);
            return [sectionId, []] as const;
          }
        })
      );

      if (!cancelled) {
        const nextCandidates = Object.fromEntries(entries) as Record<
          string,
          DetectedMemoriaDocument[]
        >;
        const contextChanged = selectionContextRef.current !== selectionContextKey;
        const preferLatestSection = preferLatestSectionRef.current;

        setCandidates(nextCandidates);
        setSelectedPaths((current) =>
          Object.fromEntries(
            Object.entries(nextCandidates).flatMap(([sectionId, documents]) => {
              const currentPath = current[sectionId];
              const shouldPreferLatest = contextChanged || preferLatestSection === sectionId;
              const selected = shouldPreferLatest
                ? documents[0]
                : documents.find((document) => document.filePath === currentPath) ?? documents[0];
              return selected ? [[sectionId, selected.filePath]] : [];
            })
          )
        );
        selectionContextRef.current = selectionContextKey;
        preferLatestSectionRef.current = null;
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, stage?.number, stage?.name, categoriesKey, refetchToken, selectionContextKey]);

  const detected = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(candidates).map(([sectionId, documents]) => [
          sectionId,
          documents.find((document) => document.filePath === selectedPaths[sectionId]) ?? documents[0] ?? null,
        ])
      ),
    [candidates, selectedPaths]
  );

  return { candidates, detected, isLoading, refetch, selectDocument };
};
