import { format } from "date-fns";

import { dataLayerClient } from "@/services/dataLayerClient";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { queryKeys } from "@/lib/react-query";
import { createAllFoldersForJob } from "@/utils/flex-folders";
import { createSafeFolderName, sanitizeFolderName } from "@/utils/folderNameSanitizer";
import { extractFunctionErrorMessage } from "@/utils/supabaseFunctionError";
import { canUseCustomFolderStructure } from "@/utils/permissions";
import type { CreateFoldersOptions } from "@/utils/flex-folders";

import type {
  FlexPickerMode,
  JobCardFolderActions,
  JobCardFolderDependencies,
} from "@/features/jobs/job-card-new/jobCardNewTypes";

type FlexFolderRow = {
  id: string;
  parent_id?: string | null;
  department?: string | null;
  folder_type?: string | null;
};

type FlexStatusCascade = {
  attempted?: number;
  succeeded?: number;
  failed?: number;
};

type FlexStatusResponse = {
  success?: boolean;
  error?: string;
  response?: {
    exceptionMessage?: string;
    primaryMessage?: string;
    message?: string;
  };
  cascade?: FlexStatusCascade;
};

type LocalFolderStructureItem =
  | string
  | {
      name: string;
      subfolders?: string[];
    };

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

export const parseLocalFolderStructure = (
  value: unknown,
): LocalFolderStructureItem[] | null => {
  if (!Array.isArray(value)) return null;

  const parsed: LocalFolderStructureItem[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      parsed.push(item);
      continue;
    }

    if (item && typeof item === "object" && !Array.isArray(item) && "name" in item) {
      const candidate = item as { name?: unknown; subfolders?: unknown };
      if (typeof candidate.name !== "string") continue;
      parsed.push({
        name: candidate.name,
        subfolders: Array.isArray(candidate.subfolders)
          ? candidate.subfolders.filter(
              (subfolder): subfolder is string => typeof subfolder === "string",
            )
          : undefined,
      });
    }
  }

  return parsed.length > 0 ? parsed : null;
};

const mapStatusToFlex = (
  status: string | null | undefined,
): "tentativa" | "confirmado" | "cancelado" | null => {
  switch (status) {
    case "Tentativa":
      return "tentativa";
    case "Confirmado":
      return "confirmado";
    case "Cancelado":
      return "cancelado";
    default:
      return null;
  }
};

export function useJobCardFolderActions({
  actualFoldersExist,
  addDeletingJob,
  confirm,
  flexPickerMode,
  isCreatingFolders,
  isCreatingLocalFolders,
  isJobBeingDeleted,
  isManagementUser,
  job,
  onDeleteClick,
  queryClient,
  removeDeletingJob,
  setFlexPickerMode,
  setFlexPickerOpen,
  setFlexPickerOptions,
  setIsCreatingFolders,
  setIsCreatingLocalFolders,
  toast,
}: JobCardFolderDependencies): JobCardFolderActions {
  const syncStatusToFlex = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const flexStatus = mapStatusToFlex(job.status);
      if (!flexStatus) {
        toast({
          title: "Not applicable",
          description:
            "Only Tentativa/Confirmado/Cancelado are synced to Flex.",
        });
        return;
      }

      const { data: folders, error: foldersError } = await dataLayerClient
        .from("flex_folders")
        .select("id, parent_id, department, folder_type")
        .eq("job_id", job.id);
      if (foldersError || !folders || folders.length === 0) {
        toast({
          title: "No Flex folders",
          description: "Create Flex folders before syncing status.",
          variant: "destructive",
        });
        return;
      }

      const folderRows = folders as FlexFolderRow[];
      const master =
        folderRows.find(
          (folder) =>
            !folder.parent_id &&
            String(folder.folder_type ?? "").toLowerCase() === "main_event",
        ) ??
        folderRows.find((folder) => !folder.parent_id) ??
        null;

      if (!master?.id) {
        toast({
          title: "Flex sync failed",
          description: "No Flex master folder found for this job.",
          variant: "destructive",
        });
        return;
      }

      const { data: response, error } =
        await dataLayerClient.functions.invoke("apply-flex-status", {
          body: { folder_id: master.id, status: flexStatus, cascade: true },
        });
      const result = response as FlexStatusResponse | null;
      if (error || !result?.success) {
        const message =
          result?.error ??
          result?.response?.exceptionMessage ??
          result?.response?.primaryMessage ??
          result?.response?.message ??
          (error ? await extractFunctionErrorMessage(error, "") : undefined);
        toast({
          title: "Flex sync failed",
          description: message || "See logs for details.",
          variant: "destructive",
        });
        return;
      }

      const cascade = result.cascade;
      const attempted =
        typeof cascade?.attempted === "number" ? cascade.attempted : null;
      const succeeded =
        typeof cascade?.succeeded === "number" ? cascade.succeeded : null;
      const failed = typeof cascade?.failed === "number" ? cascade.failed : null;

      if (attempted !== null && attempted > 0) {
        if (failed === 0) {
          toast({
            title: "Flex synced",
            description: `Status synchronized with Flex (root + ${attempted} subfolder${attempted === 1 ? "" : "s"}).`,
          });
        } else if (failed !== null && failed > 0) {
          toast({
            title: "Flex sync warning",
            description: `Root synced, but only ${succeeded ?? 0}/${attempted} subfolders updated. Check Flex logs.`,
          });
        } else {
          toast({
            title: "Flex synced",
            description: "Status synchronized with Flex.",
          });
        }
      } else if (attempted === 0) {
        toast({
          title: "Flex synced",
          description:
            "Status synchronized with Flex (root only; no subfolders found).",
        });
      } else {
        toast({
          title: "Flex synced",
          description: "Status synchronized with Flex.",
        });
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isJobBeingDeleted) {
      console.log("JobCardNew: Job deletion already in progress");
      return;
    }

    if (!isManagementUser) {
      toast({
        title: "Permission denied",
        description: "Only admin and management users can delete jobs",
        variant: "destructive",
      });
      return;
    }

    const confirmedDelete = await confirm({
      title: "Eliminar trabajo",
      description:
        "¿Seguro que quieres eliminar este trabajo? Esta acción no se puede deshacer y eliminará todos los datos relacionados.",
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!confirmedDelete) return;

    try {
      console.log("JobCardNew: Starting optimistic job deletion for:", job.id);
      addDeletingJob(job.id);
      const result = await deleteJobOptimistically(job.id);
      if (!result.success) {
        throw new Error(result.error || "Unknown deletion error");
      }

      toast({
        title: "Job deleted",
        description:
          result.details ||
          "The job has been removed and cleanup is running in background.",
      });
      onDeleteClick(job.id);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.scope("jobs"),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.scope("optimized-jobs"),
      });
    } catch (error: unknown) {
      console.error("JobCardNew: Error in optimistic job deletion:", error);
      toast({
        title: "Error deleting job",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      removeDeletingJob(job.id);
    }
  };

  const handleFlexPickerConfirm = async (
    options?: CreateFoldersOptions,
    modeOverride?: FlexPickerMode,
  ) => {
    const mode = modeOverride ?? flexPickerMode;
    console.log("JobCardNew: Flex picker confirmed with options:", options);
    setFlexPickerOptions(options);
    setFlexPickerOpen(false);

    try {
      setIsCreatingFolders(true);
      if (mode === "create") {
        const existingFoldersQuery = dataLayerClient
          .from("flex_folders")
          .select("id")
          .limit(1);
        const { data: existingFolders } =
          job.job_type === "tourdate" && job.tour_date_id
            ? await existingFoldersQuery.or(
                `job_id.eq.${job.id},tour_date_id.eq.${job.tour_date_id}`,
              )
            : await existingFoldersQuery.eq("job_id", job.id);

        if (existingFolders && existingFolders.length > 0) {
          toast({
            title: "Folders already exist",
            description:
              "Flex folders have already been created for this job.",
            variant: "destructive",
          });
          return;
        }
      }

      const startDate = new Date(job.start_time);
      const documentNumber = startDate
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");
      const formattedStartDate =
        new Date(job.start_time).toISOString().split(".")[0] + ".000Z";
      const formattedEndDate =
        new Date(job.end_time).toISOString().split(".")[0] + ".000Z";

      toast({
        title: mode === "create" ? "Creating folders..." : "Adding folders...",
        description:
          mode === "create"
            ? "Setting up Flex folder structure for this job."
            : "Creating the selected Flex folders.",
      });
      await createAllFoldersForJob(
        job,
        formattedStartDate,
        formattedEndDate,
        documentNumber,
        options,
      );

      const { error: updateError } = await dataLayerClient
        .from("jobs")
        .update({ flex_folders_created: true })
        .eq("id", job.id);
      if (updateError) {
        console.error("Error updating job record:", updateError);
      }

      void dataLayerClient.functions
        .invoke("push", {
          body: {
            action: "broadcast",
            type: "flex.folders.created",
            job_id: job.id,
          },
        })
        .catch((pushError: unknown) => {
          console.error("Error sending push notification:", pushError);
        });

      toast({
        title: mode === "create" ? "Success!" : "Updated!",
        description:
          mode === "create"
            ? "Flex folders have been created successfully."
            : "Selected Flex folders have been added successfully.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.scope("optimized-jobs"),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.scope("folder-existence", job.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.scope("folder-existence"),
        }),
      ]);
    } catch (error: unknown) {
      console.error("JobCardNew: Error creating flex folders:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Failed to create Flex folders",
        variant: "destructive",
      });
    } finally {
      setIsCreatingFolders(false);
    }
  };

  const createFlexFoldersHandler = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isCreatingFolders) {
      console.log("JobCardNew: Folder creation already in progress");
      return;
    }
    if (job.job_type === "dryhire") {
      void handleFlexPickerConfirm(undefined, "create");
      return;
    }
    if (actualFoldersExist) {
      setFlexPickerMode("add");
      setFlexPickerOpen(true);
      return;
    }
    setFlexPickerMode("create");
    setFlexPickerOpen(true);
  };

  const addFlexFoldersHandler = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isCreatingFolders || job.job_type === "dryhire") return;
    setFlexPickerMode("add");
    setFlexPickerOpen(true);
  };

  const createLocalFoldersHandler = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isCreatingLocalFolders) return;

    if (!("showDirectoryPicker" in window)) {
      toast({
        title: "Not supported",
        description:
          "Your browser doesn't support local folder creation. Please use Chrome, Edge, or another Chromium-based browser.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreatingLocalFolders(true);
      const baseDirectory = await window.showDirectoryPicker();
      const formattedDate = format(new Date(job.start_time), "yyMMdd");
      const { name: rootFolderName, wasSanitized } = createSafeFolderName(
        job.title,
        formattedDate,
      );
      if (wasSanitized) {
        console.log("JobCardNew: Folder name was sanitized for safety:", {
          original: `${formattedDate} - ${job.title}`,
          sanitized: rootFolderName,
        });
      }

      const rootDirectory = await baseDirectory.getDirectoryHandle(
        rootFolderName,
        { create: true },
      );
      const {
        data: { user },
      } = await dataLayerClient.auth.getUser();
      let folderStructure: LocalFolderStructureItem[] | null = null;
      let usesCustomStructure = false;

      if (user) {
        const { data: profile } = await dataLayerClient
          .from("profiles")
          .select("custom_folder_structure, role")
          .eq("id", user.id)
          .single();
        if (
          profile &&
          canUseCustomFolderStructure(profile.role) &&
          profile.custom_folder_structure
        ) {
          folderStructure = parseLocalFolderStructure(
            profile.custom_folder_structure,
          );
          usesCustomStructure = folderStructure !== null;
        }
      }

      folderStructure ??= [
        "CAD",
        "QT",
        "Material",
        "Documentación",
        "Rentals",
        "Compras",
        "Rider",
        "Predicciones",
      ];

      for (const folder of folderStructure) {
        const folderName =
          typeof folder === "string" ? folder : folder.name;
        const childDirectory = await rootDirectory.getDirectoryHandle(
          sanitizeFolderName(folderName),
          { create: true },
        );
        if (typeof folder !== "string" && folder.subfolders?.length) {
          for (const subfolder of folder.subfolders) {
            await childDirectory.getDirectoryHandle(
              sanitizeFolderName(subfolder),
              { create: true },
            );
          }
        } else {
          await childDirectory.getDirectoryHandle("OLD", { create: true });
        }
      }

      toast({
        title: "Success!",
        description: `${usesCustomStructure ? "Custom" : "Default"} folder structure created at "${rootFolderName}"`,
      });
    } catch (error: unknown) {
      console.error("JobCardNew: Error creating local folders:", error);
      if (isAbortError(error)) return;
      toast({
        title: "Error",
        description:
          getErrorMessage(error) || "Failed to create local folder structure",
        variant: "destructive",
      });
    } finally {
      setIsCreatingLocalFolders(false);
    }
  };

  return {
    addFlexFoldersHandler,
    createFlexFoldersHandler,
    createLocalFoldersHandler,
    handleDeleteClick,
    handleFlexPickerConfirm,
    syncStatusToFlex,
  };
}
