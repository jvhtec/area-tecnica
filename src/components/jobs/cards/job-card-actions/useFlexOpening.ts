import React from "react";

import { mapViewHintToIntent } from "@/components/jobs/cards/job-card-actions/mapViewHintToIntent";
import type {
  JobCardFlexFolder,
  JobCardJob,
  TourdateSelectorInfo,
} from "@/components/jobs/cards/job-card-actions/types";
import { useToast } from "@/hooks/use-toast";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import {
  FLEX_FOLDER_IDS,
  getElementTree,
  type FlexElementNode,
  type IntentDetectionContext,
  openFlexElement,
  type FlatElementNode,
} from "@/utils/flex-folders";
import { getMainFlexElementIdSync, resolveTourFolderForTourdate } from "@/utils/flexMainFolderId";
import type { Department } from "@/types/department";

type UseFlexOpeningArgs = {
  department?: Department;
  folderStateLoading: boolean;
  foldersAreCreated: boolean;
  isCreatingFolders: boolean;
  isProjectManagementPage: boolean;
  job: JobCardJob;
};

const getNonEmptyString = (value: unknown): string | null => (
  typeof value === "string" && value.trim().length > 0 ? value : null
);

const getFolderElementId = (folder: JobCardFlexFolder | null | undefined): string | null => (
  getNonEmptyString(folder?.element_id) ?? getNonEmptyString(folder?.elementId)
);

const getJobPresupuestoElementId = (job: JobCardJob): string | null => {
  const candidateIds = [
    job.dryhire_presupuesto_element_id,
    job.dryhirePresupuestoElementId,
    job.presupuesto_element_id,
    job.presupuestoElementId,
    job.flex_presupuesto_element_id,
    job.flexPresupuestoElementId,
    job.flex_budget_element_id,
    job.flexBudgetElementId,
  ];

  for (const candidate of candidateIds) {
    const elementId = getNonEmptyString(candidate);
    if (elementId) return elementId;
  }

  return null;
};

const getFlexContextJobType = (jobType: JobCardJob["job_type"]): IntentDetectionContext["jobType"] => (
  jobType === "tour" ? undefined : jobType
);

export const useFlexOpening = ({
  department,
  folderStateLoading,
  foldersAreCreated,
  isCreatingFolders,
  isProjectManagementPage,
  job,
}: UseFlexOpeningArgs) => {
  const { toast } = useToast();
  const [flexSelectorOpen, setFlexSelectorOpen] = React.useState(false);
  const [tourdateSelectorInfo, setTourdateSelectorInfo] = React.useState<TourdateSelectorInfo>(null);
  const dryHirePresupuestoElementRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (job?.job_type !== "dryhire") {
      dryHirePresupuestoElementRef.current = null;
      return;
    }

    const jobPresupuestoElementId = getJobPresupuestoElementId(job);
    if (jobPresupuestoElementId) {
      dryHirePresupuestoElementRef.current = jobPresupuestoElementId;
      return;
    }

    const matchingFolder = job.flex_folders?.find((folder) => {
      const folderType = typeof folder?.folder_type === "string" ? folder.folder_type.toLowerCase() : "";
      const folderKey = typeof folder?.key === "string" ? folder.key.toLowerCase() : "";
      const folderName = typeof folder?.name === "string" ? folder.name.toLowerCase() : "";

      return (
        folderType === "dryhire_presupuesto" ||
        folderType === "presupuesto" ||
        folderType === "presupuesto_dryhire" ||
        folderKey === "dryhire_presupuesto" ||
        folderKey === "presupuesto" ||
        folderKey === "presupuestodryhire" ||
        folderName.includes("presupuesto")
      );
    });

    dryHirePresupuestoElementRef.current = getFolderElementId(matchingFolder);
  }, [job]);

  const getFlexButtonTitle = React.useCallback(() => {
    if (isCreatingFolders) {
      return "Creando carpetas...";
    }
    return foldersAreCreated ? "Las carpetas ya existen" : "Crear carpetas Flex";
  }, [foldersAreCreated, isCreatingFolders]);

  const mainFlexInfo = React.useMemo(() => {
    return getMainFlexElementIdSync(job);
  }, [job]);

  const { flexUuid, isLoading: isFlexLoading, error: flexError } = useFlexUuid(foldersAreCreated ? job.id : "");

  const canOpenFlex = React.useMemo(() => {
    if (folderStateLoading || isCreatingFolders || isFlexLoading) return false;

    if (isProjectManagementPage) {
      if (mainFlexInfo?.elementId) return true;
      if (job.job_type === "tourdate") return true;

      if (job.job_type === "dryhire") {
        const dryHireFolder = job.flex_folders?.find((folder) => folder.folder_type === "dryhire");
        const savedPresupuesto = job.flex_folders?.find((folder) => folder.folder_type === "dryhire_presupuesto");
        return Boolean(
          dryHirePresupuestoElementRef.current ||
          getJobPresupuestoElementId(job) ||
          getFolderElementId(savedPresupuesto) ||
          getFolderElementId(dryHireFolder)
        );
      }
    }

    return !!flexUuid;
  }, [folderStateLoading, flexUuid, isCreatingFolders, isFlexLoading, isProjectManagementPage, job, mainFlexInfo]);

  const handleOpenFlex = React.useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (folderStateLoading || isCreatingFolders || isFlexLoading) {
      console.warn("[JobCardActions] Open Flex clicked while loading:", {
        folderStateLoading,
        isCreatingFolders,
        isFlexLoading,
      });
      toast({
        title: "Cargando",
        description: isCreatingFolders
          ? "Creando carpetas de Flex, por favor espere..."
          : "Por favor espere mientras cargamos la carpeta de Flex...",
      });
      return;
    }

    if (isProjectManagementPage && mainFlexInfo?.elementId) {
      console.log(`[JobCardActions] Opening Flex element selector for main element: ${mainFlexInfo.elementId}`);
      setFlexSelectorOpen(true);
      return;
    }

    if (isProjectManagementPage && job.job_type === "tourdate") {
      try {
        console.log(`[JobCardActions] Resolving tour folder for tourdate job ${job.id}`);
        const tourFolderId = await resolveTourFolderForTourdate(job, department);

        if (!tourFolderId) {
          console.error("[JobCardActions] No tour folder found for tourdate job:", job.id);
          toast({
            title: "Carpetas de gira no encontradas",
            description: "Asegúrate de que la gira principal tenga carpetas Flex creadas.",
            variant: "destructive",
          });
          return;
        }

        const tourDate = job.start_time;
        if (!tourDate) {
          console.error("[JobCardActions] No start_time found for tourdate job:", job.id);
          toast({
            title: "Fecha no encontrada",
            description: "No se pudo determinar la fecha de gira para filtrar.",
            variant: "destructive",
          });
          return;
        }

        console.log(`[JobCardActions] Opening filtered selector for tourdate: ${tourDate}, folder: ${tourFolderId}`);
        setTourdateSelectorInfo({
          mainElementId: tourFolderId,
          filterDate: tourDate,
        });
        setFlexSelectorOpen(true);
        return;
      } catch (error) {
        console.error("[JobCardActions] Error resolving tour folder:", error);
        toast({
          title: "Error",
          description: "No se pudo cargar la información de la carpeta de gira.",
          variant: "destructive",
        });
        return;
      }
    }

    if (isProjectManagementPage && job.job_type === "dryhire") {
      const dryHireFolder = job.flex_folders?.find((folder) => folder.folder_type === "dryhire");
      const savedPresupuesto = job.flex_folders?.find((folder) => folder.folder_type === "dryhire_presupuesto");
      const dryHireFolderElementId = getFolderElementId(dryHireFolder);
      const savedPresupuestoElementId = getFolderElementId(savedPresupuesto);

      let presupuestoElementId =
        typeof dryHirePresupuestoElementRef.current === "string"
          ? dryHirePresupuestoElementRef.current
          : null;

      if (!presupuestoElementId && savedPresupuestoElementId) {
        presupuestoElementId = savedPresupuestoElementId;
        dryHirePresupuestoElementRef.current = presupuestoElementId;
      }

      if (!presupuestoElementId && dryHireFolderElementId) {
        try {
          console.log("[JobCardActions] Resolving dryhire presupuesto via element tree", {
            jobId: job.id,
            dryHireFolderId: dryHireFolderElementId,
          });

          const tree = await getElementTree(dryHireFolderElementId);
          const queue: FlexElementNode[] = Array.isArray(tree) ? [...tree] : [];

          while (queue.length > 0) {
            const node = queue.shift();
            if (!node || typeof node !== "object") continue;

            const nodeElementId =
              typeof node.elementId === "string" && node.elementId.trim().length > 0
                ? node.elementId
                : null;
            const nodeDefinitionId = typeof node.definitionId === "string" ? node.definitionId : undefined;
            const nodeDisplayName =
              typeof node.displayName === "string"
                ? node.displayName
                : "";

            if (
              nodeElementId &&
              (
                nodeDefinitionId === FLEX_FOLDER_IDS.presupuestoDryHire ||
                (nodeDisplayName || "").toLowerCase().includes("presupuesto")
              )
            ) {
              presupuestoElementId = nodeElementId;
              break;
            }

            if (Array.isArray(node.children)) {
              queue.push(...node.children);
            }
          }

          if (presupuestoElementId) {
            dryHirePresupuestoElementRef.current = presupuestoElementId;
          }
        } catch (error) {
          console.error("[JobCardActions] Failed to resolve dryhire presupuesto element via tree:", {
            error,
            jobId: job.id,
            dryHireFolderId: dryHireFolderElementId,
          });
          toast({
            title: "Error",
            description: "No se pudo cargar el presupuesto de dry-hire desde Flex.",
            variant: "destructive",
          });
          return;
        }
      }

      if (!presupuestoElementId) {
        console.error("[JobCardActions] No dryhire presupuesto element available:", {
          jobId: job.id,
          hasFlexFolders: !!job.flex_folders,
          flexFoldersCount: job.flex_folders?.length || 0,
        });
        toast({
          title: "Presupuesto no encontrado",
          description: "No se encontró ningún elemento de presupuesto para este dry-hire.",
          variant: "destructive",
        });
        return;
      }

      await openFlexElement({
        elementId: presupuestoElementId,
        context: {
          jobType: getFlexContextJobType(job.job_type),
          folderType: "dryhire",
          definitionId: FLEX_FOLDER_IDS.presupuestoDryHire,
        },
        onError: (error) => {
          console.error("[JobCardActions] Failed to open dryhire presupuesto element:", error);
          toast({
            title: "Error",
            description: error.message || "No se pudo abrir Flex",
            variant: "destructive",
          });
        },
        onWarning: (message) => {
          console.warn("[JobCardActions] Warning opening dryhire presupuesto element:", message);
          toast({
            title: "Advertencia",
            description: message,
          });
        },
      });
      return;
    }

    if (flexUuid) {
      console.log(`[JobCardActions] Opening Flex folder for job ${job.id}, element: ${flexUuid}, type: ${job.job_type}`);

      await openFlexElement({
        elementId: flexUuid,
        context: {
          jobType: getFlexContextJobType(job.job_type),
        },
        onError: (error) => {
          console.error("[JobCardActions] Failed to open Flex element:", error);
          toast({
            title: "Error",
            description: error.message || "No se pudo abrir Flex",
            variant: "destructive",
          });
        },
        onWarning: (message) => {
          console.warn("[JobCardActions] Warning opening Flex element:", message);
          toast({
            title: "Advertencia",
            description: message,
          });
        },
      });
      return;
    }

    console.error("[JobCardActions] No valid Flex element available:", {
      jobId: job.id,
      jobType: job.job_type,
      foldersAreCreated,
      hasMainFlexInfo: !!mainFlexInfo,
      flexUuid,
      flexError,
      hasFlexFolders: !!job.flex_folders,
    });

    if (flexError) {
      toast({ title: "Error", description: flexError, variant: "destructive" });
    } else {
      toast({
        title: "Carpeta Flex no disponible",
        description: "No se encontró un elemento Flex válido para este trabajo. Asegúrate de que las carpetas estén creadas.",
        variant: "destructive",
      });
    }
  }, [
    department,
    flexError,
    flexUuid,
    folderStateLoading,
    foldersAreCreated,
    isCreatingFolders,
    isFlexLoading,
    isProjectManagementPage,
    job,
    mainFlexInfo,
    toast,
  ]);

  const handleFlexElementSelect = React.useCallback((elementId: string, node?: FlatElementNode) => {
    console.log("[JobCardActions] Opening Flex element from selector", {
      elementId,
      elementIdType: typeof elementId,
      elementIdValue: elementId,
      elementIdNull: elementId === null,
      elementIdUndefined: elementId === undefined,
      elementIdEmpty: elementId === "",
      elementIdValid: !!elementId && (typeof elementId === "string") && elementId.trim().length > 0,
      elementIdLength: elementId?.length || 0,
      node,
      domainId: node?.domainId,
      definitionId: node?.definitionId,
      schemaId: node?.schemaId,
      viewHint: node?.viewHint,
      displayName: node?.displayName,
      documentNumber: node?.documentNumber,
      jobType: job.job_type,
      jobId: job.id,
    });

    if (!elementId || typeof elementId !== "string" || elementId.trim().length === 0) {
      const errorDetails = {
        elementId,
        elementIdType: typeof elementId,
        node,
        jobId: job.id,
        jobType: job.job_type,
        timestamp: new Date().toISOString(),
      };

      console.error("[JobCardActions] Invalid elementId received from selector:", errorDetails);
      console.error("[JobCardActions] Telemetry: Missing element ID detected", errorDetails);

      toast({
        title: "Elemento no válido",
        description: node?.displayName
          ? `No se puede abrir "${node.displayName}": el ID del elemento no es válido.`
          : "Se recibió un ID de elemento no válido. No se puede navegar a Flex.",
        variant: "destructive",
      });
      return;
    }

    openFlexElement({
      elementId,
      context: {
        definitionId: node?.definitionId,
        domainId: node?.domainId,
        schemaId: node?.schemaId,
        viewHint: mapViewHintToIntent(node?.viewHint),
        jobType: getFlexContextJobType(job.job_type),
      },
      onError: (error) => {
        const errorDetails = {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          elementId,
          node,
          jobId: job.id,
          jobType: job.job_type,
          timestamp: new Date().toISOString(),
        };
        console.error("[JobCardActions] Failed to open Flex element from selector:", errorDetails);
        toast({
          title: "Error de navegación",
          description: error instanceof Error ? error.message : "No se pudo abrir Flex",
          variant: "destructive",
        });
      },
      onWarning: (message) => {
        console.warn("[JobCardActions] Warning opening Flex element from selector:", {
          message,
          elementId,
          node,
          jobId: job.id,
        });
        toast({ title: "Advertencia", description: message });
      },
    });
  }, [job.job_type, job.id, toast]);

  return {
    canOpenFlex,
    flexSelectorOpen,
    flexUuid,
    getFlexButtonTitle,
    handleFlexElementSelect,
    handleOpenFlex,
    isFlexLoading,
    mainFlexInfo,
    setFlexSelectorOpen,
    setTourdateSelectorInfo,
    tourdateSelectorInfo,
  };
};
