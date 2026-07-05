import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { FlexSelectorDialogHost } from "@/components/jobs/cards/job-card-actions/FlexSelectorDialogHost";
import { JobCardActionButtons } from "@/components/jobs/cards/job-card-actions/JobCardActionButtons";
import { ProductionWhatsappDialog } from "@/components/jobs/cards/job-card-actions/ProductionWhatsappDialog";
import { WarehouseWhatsappDialog } from "@/components/jobs/cards/job-card-actions/WarehouseWhatsappDialog";
import type { JobCardActionsProps } from "@/components/jobs/cards/job-card-actions/types";
import { useFlexOpening } from "@/components/jobs/cards/job-card-actions/useFlexOpening";
import { useProductionWhatsapp } from "@/components/jobs/cards/job-card-actions/useProductionWhatsapp";
import { useTechnicalPowerPack } from "@/components/jobs/cards/job-card-actions/useTechnicalPowerPack";
import { useWarehouseWhatsapp } from "@/components/jobs/cards/job-card-actions/useWarehouseWhatsapp";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { isFestivalLikeJobType } from "@/utils/jobType";
import { isManagementRole, isTechnicianRole } from "@/utils/permissions";
import { useIsMobile } from "@/hooks/use-mobile";

export type { JobCardActionsProps };

export const JobCardActions: React.FC<JobCardActionsProps> = ({
  job,
  userRole,
  foldersAreCreated,
  isProjectManagementPage,
  isHouseTech,
  showUpload,
  canEditJobs,
  canCreateFlexFolders,
  canUploadDocuments,
  canManageArtists,
  department,
  isCreatingFolders = false,
  isCreatingLocalFolders = false,
  folderStateLoading = false,
  techName,
  onRefreshData,
  onEditButtonClick,
  onDeleteClick,
  onCreateFlexFolders,
  onAddFlexFolders,
  onCreateLocalFolders,
  onFestivalArtistsClick,
  onAssignmentDialogOpen,
  handleFileUpload,
  onJobDetailsClick,
  onOpenTasks,
  canSyncFlex,
  onSyncFlex,
  onOpenFlexLogs,
  transportButtonLabel,
  transportButtonTone,
  onTransportClick,
  onCreateWhatsappGroup,
  onRetryWhatsappGroup,
  whatsappDisabled,
  whatsappGroup,
  whatsappRequest,
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isManagementUser = isManagementRole(userRole);
  const isTechnicianUser = isTechnicianRole(userRole);
  const isFestivalLike = isFestivalLikeJobType(job?.job_type);
  const allowedJobType = ["single", "festival", "ciclo", "tourdate"].includes(job?.job_type);
  const canViewCalculators = isProjectManagementPage && isManagementUser;
  const tourId: string | undefined = job?.tour_id || job?.tour?.id || undefined;

  const productionWhatsapp = useProductionWhatsapp({
    job,
    userRole,
    isProjectManagementPage,
    department,
  });
  const warehouseWhatsapp = useWarehouseWhatsapp(job);
  const technicalPower = useTechnicalPowerPack({
    job,
    isProjectManagementPage,
    isManagementUser,
    allowedJobType,
  });
  const flexOpening = useFlexOpening({
    department,
    folderStateLoading,
    foldersAreCreated,
    isCreatingFolders,
    isProjectManagementPage,
    job,
  });

  const { data: defaultsInfo } = useQuery<{ weight: boolean; power: boolean }>({
    queryKey: queryKeys.scope("tour-default-exists", tourId, department),
    enabled: Boolean(tourId && department && canViewCalculators && allowedJobType),
    queryFn: async () => {
      const { data: sets, error: err1 } = await dataLayerClient.from("tour_default_sets")
        .select("id")
        .eq("tour_id", tourId!)
        .eq("department", department!);
      if (err1) throw err1;
      if (!sets || sets.length === 0) return { weight: false, power: false };
      const setIds = sets.map((set) => set.id);
      const { data: tables, error: err2 } = await dataLayerClient.from("tour_default_tables")
        .select("id, table_type")
        .in("set_id", setIds);
      if (err2) throw err2;
      const weight = (tables || []).some((table) => table.table_type === "weight");
      const power = (tables || []).some((table) => table.table_type === "power");
      return { weight, power };
    },
  });

  const handleTimesheetClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/timesheets?jobId=${job.id}`);
  }, [job.id, navigate]);

  const navigateToCalculator = React.useCallback((e: React.MouseEvent, type: "pesos" | "consumos") => {
    e.stopPropagation();
    const params = new URLSearchParams({ jobId: job.id });
    let path = "";
    switch (department) {
      case "sound":
        path = type === "pesos" ? "/sound/pesos" : "/sound/consumos";
        break;
      case "lights":
        path = type === "pesos" ? "/lights-pesos-tool" : "/lights-consumos-tool";
        break;
      case "video":
        path = type === "pesos" ? "/video-pesos-tool" : "/video-consumos-tool";
        break;
      default:
        path = type === "pesos" ? "/sound/pesos" : "/sound/consumos";
    }
    navigate(`${path}?${params.toString()}`);
  }, [department, job.id, navigate]);

  const navigateToMemoria = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams({ jobId: job.id });
    let path = "";

    switch (department) {
      case "lights":
        path = "/lights-memoria-tecnica";
        break;
      case "video":
        path = "/video-memoria-tecnica";
        break;
      case "sound":
      default:
        path = "/sound";
        params.set("tool", "memoria");
        break;
    }

    navigate(`${path}?${params.toString()}`);
  }, [department, job.id, navigate]);

  const handleManageJob = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams({ singleJob: "true" });
    navigate(`/festival-management/${job.id}?${params.toString()}`);
  }, [job.id, navigate]);

  return (
    <>
      <JobCardActionButtons
        job={job}
        userRole={userRole}
        foldersAreCreated={foldersAreCreated}
        isProjectManagementPage={isProjectManagementPage}
        isHouseTech={isHouseTech}
        showUpload={showUpload}
        canEditJobs={canEditJobs}
        canCreateFlexFolders={canCreateFlexFolders}
        canUploadDocuments={canUploadDocuments}
        canManageArtists={canManageArtists}
        department={department}
        isCreatingFolders={isCreatingFolders}
        isCreatingLocalFolders={isCreatingLocalFolders}
        folderStateLoading={folderStateLoading}
        techName={techName}
        onRefreshData={onRefreshData}
        onEditButtonClick={onEditButtonClick}
        onDeleteClick={onDeleteClick}
        onCreateFlexFolders={onCreateFlexFolders}
        onAddFlexFolders={onAddFlexFolders}
        onCreateLocalFolders={onCreateLocalFolders}
        onFestivalArtistsClick={onFestivalArtistsClick}
        onAssignmentDialogOpen={onAssignmentDialogOpen}
        handleFileUpload={handleFileUpload}
        onJobDetailsClick={onJobDetailsClick}
        onOpenTasks={onOpenTasks}
        canSyncFlex={canSyncFlex}
        onSyncFlex={onSyncFlex}
        onOpenFlexLogs={onOpenFlexLogs}
        transportButtonLabel={transportButtonLabel}
        transportButtonTone={transportButtonTone}
        onTransportClick={onTransportClick}
        onCreateWhatsappGroup={onCreateWhatsappGroup}
        onRetryWhatsappGroup={onRetryWhatsappGroup}
        whatsappDisabled={whatsappDisabled}
        whatsappGroup={whatsappGroup}
        whatsappRequest={whatsappRequest}
        allowedJobType={allowedJobType}
        canSendProductionWhatsapp={productionWhatsapp.canSendProductionWhatsapp}
        canViewCalculators={canViewCalculators}
        defaultsInfo={defaultsInfo}
        flexOpening={flexOpening}
        handleManageJob={handleManageJob}
        handleTimesheetClick={handleTimesheetClick}
        isFestivalLike={isFestivalLike}
        isManagementUser={isManagementUser}
        isMobile={isMobile}
        isTechnicianUser={isTechnicianUser}
        navigateToCalculator={navigateToCalculator}
        navigateToMemoria={navigateToMemoria}
        openProductionWhatsappDialog={productionWhatsapp.openProductionWhatsappDialog}
        openWarehouseWhatsappDialog={warehouseWhatsapp.openWarehouseWhatsappDialog}
        technicalPower={technicalPower}
      />

      <ProductionWhatsappDialog state={productionWhatsapp} />
      <WarehouseWhatsappDialog state={warehouseWhatsapp} />
      <FlexSelectorDialogHost
        department={department}
        flexOpening={flexOpening}
        job={job}
      />
    </>
  );
};
