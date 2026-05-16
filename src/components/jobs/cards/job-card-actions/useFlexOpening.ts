import React from "react";

import { mapViewHintToIntent } from "@/components/jobs/cards/job-card-actions/mapViewHintToIntent";
import type { TourdateSelectorInfo } from "@/components/jobs/cards/job-card-actions/types";
import { useToast } from "@/hooks/use-toast";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import {
  FLEX_FOLDER_IDS,
  getElementTree,
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
  job: any;
};

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

    const candidateIds = [
      job?.dryhire_presupuesto_element_id,
      job?.dryhirePresupuestoElementId,
      job?.presupuesto_element_id,
      job?.presupuestoElementId,
      job?.flex_presupuesto_element_id,
      job?.flexPresupuestoElementId,
      job?.flex_budget_element_id,
      job?.flexBudgetElementId,
    ];

    for (const candidate of candidateIds) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        dryHirePresupuestoElementRef.current = candidate;
        return;
      }
    }

    const matchingFolder = job.flex_folders?.find((folder: any) => {
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

    const storedElementId =
      typeof matchingFolder?.element_id === "string" && matchingFolder.element_id.trim().length > 0
        ? matchingFolder.element_id
        : typeof matchingFolder?.elementId === "string" && matchingFolder.elementId.trim().length > 0
          ? matchingFolder.elementId
          : null;

    dryHirePresupuestoElementRef.current = storedElementId;
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
        const dryHireFolder = job.flex_folders?.find((folder: any) => folder.folder_type === "dryhire");
        return !!dryHireFolder?.element_id;
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
        title: "Loading",
        description: isCreatingFolders
          ? "Creating Flex folders, please wait..."
          : "Please wait while we load the Flex folder...",
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
            title: "Tour folders not found",
            description: "Please ensure the parent tour has Flex folders created first.",
            variant: "destructive",
          });
          return;
        }

        const tourDate = job.start_time;
        if (!tourDate) {
          console.error("[JobCardActions] No start_time found for tourdate job:", job.id);
          toast({
            title: "Date not found",
            description: "Unable to determine tour date for filtering.",
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
          description: "Failed to load tour folder information.",
          variant: "destructive",
        });
        return;
      }
    }

    if (isProjectManagementPage && job.job_type === "dryhire") {
      const dryHireFolder = job.flex_folders?.find((folder: any) => folder.folder_type === "dryhire");
      const savedPresupuesto = job.flex_folders?.find((folder: any) => folder.folder_type === "dryhire_presupuesto");

      let presupuestoElementId =
        typeof dryHirePresupuestoElementRef.current === "string"
          ? dryHirePresupuestoElementRef.current
          : null;

      if (!presupuestoElementId && savedPresupuesto?.element_id) {
        presupuestoElementId = savedPresupuesto.element_id;
        dryHirePresupuestoElementRef.current = presupuestoElementId;
      }

      if (!presupuestoElementId && dryHireFolder?.element_id) {
        try {
          console.log("[JobCardActions] Resolving dryhire presupuesto via element tree", {
            jobId: job.id,
            dryHireFolderId: dryHireFolder.element_id,
          });

          const tree = await getElementTree(dryHireFolder.element_id);
          const queue: any[] = Array.isArray(tree) ? [...tree] : [];

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
                : typeof node.name === "string"
                  ? node.name
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
            dryHireFolderId: dryHireFolder.element_id,
          });
          toast({
            title: "Error",
            description: "Failed to load the dry-hire presupuesto from Flex.",
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
          title: "Presupuesto not found",
          description: "No presupuesto element was found for this dry-hire job.",
          variant: "destructive",
        });
        return;
      }

      await openFlexElement({
        elementId: presupuestoElementId,
        context: {
          jobType: job.job_type,
          folderType: "dryhire",
          definitionId: FLEX_FOLDER_IDS.presupuestoDryHire,
        },
        onError: (error) => {
          console.error("[JobCardActions] Failed to open dryhire presupuesto element:", error);
          toast({
            title: "Error",
            description: error.message || "Failed to open Flex",
            variant: "destructive",
          });
        },
        onWarning: (message) => {
          console.warn("[JobCardActions] Warning opening dryhire presupuesto element:", message);
          toast({
            title: "Warning",
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
          jobType: job.job_type,
        },
        onError: (error) => {
          console.error("[JobCardActions] Failed to open Flex element:", error);
          toast({
            title: "Error",
            description: error.message || "Failed to open Flex",
            variant: "destructive",
          });
        },
        onWarning: (message) => {
          console.warn("[JobCardActions] Warning opening Flex element:", message);
          toast({
            title: "Warning",
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
        title: "Flex folder not available",
        description: "No valid Flex element found for this job. Please ensure folders are created.",
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
        title: "Invalid element",
        description: node?.displayName
          ? `Cannot open "${node.displayName}" - invalid element ID.`
          : "Invalid element ID received. Cannot navigate to Flex.",
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
        jobType: job.job_type,
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
          title: "Navigation error",
          description: error instanceof Error ? error.message : "Failed to open Flex",
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
        toast({ title: "Warning", description: message });
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
