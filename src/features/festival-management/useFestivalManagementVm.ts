import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useFlexUuid } from "@/hooks/useFlexUuid";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Department } from "@/types/department";
import {
  canEditJobs,
  canUploadFestivalDocuments,
  isHouseTechRole,
  isManagementRole,
  isTechnicianRole,
} from "@/utils/permissions";
import { useFestivalAdminActions } from "@/features/festival-management/hooks/useFestivalAdminActions";
import { useFestivalDocuments } from "@/features/festival-management/hooks/useFestivalDocuments";
import { useFestivalFlexControls } from "@/features/festival-management/hooks/useFestivalFlexControls";
import { useFestivalJobData } from "@/features/festival-management/hooks/useFestivalJobData";
import { useFestivalMapPreview } from "@/features/festival-management/hooks/useFestivalMapPreview";
import { useFestivalPrintActions } from "@/features/festival-management/hooks/useFestivalPrintActions";
import { useFestivalWhatsappActions } from "@/features/festival-management/hooks/useFestivalWhatsappActions";
import { FESTIVAL_DEPARTMENT_OPTIONS, humanizeFestivalDepartment } from "@/features/festival-management/selectors";
import type { FestivalManagementVm } from "@/features/festival-management/types";

export type FestivalManagementVmResult =
  | { status: "missing_job_id" }
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "ready"; vm: FestivalManagementVm };

export const useFestivalManagementVm = (): FestivalManagementVmResult => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { userRole } = useOptimizedAuth();
  const isManagementUser = isManagementRole(userRole);
  const searchParams = new URLSearchParams(location.search);
  const isSingleJobMode = searchParams.get("singleJob") === "true";

  const jobData = useFestivalJobData({ jobId, toast });
  const documents = useFestivalDocuments({ jobId, toast });
  const mapPreview = useFestivalMapPreview(jobData.venueData);
  const { flexUuid, isLoading: isFlexLoading, error: flexError, folderExists, refetch: refetchFlexUuid } = useFlexUuid(jobId || "");

  const [assignmentDepartment, setAssignmentDepartment] = useState<Department>("sound");
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isRouteSheetOpen, setIsRouteSheetOpen] = useState(false);
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);
  const [isJobPresetsOpen, setIsJobPresetsOpen] = useState(false);

  const flexControls = useFestivalFlexControls({
    fetchDocuments: documents.fetchDocuments,
    fetchJobDetails: jobData.fetchJobDetails,
    flexError,
    flexUuid,
    folderExists,
    isFlexLoading,
    job: jobData.job,
    jobId,
    refetchFlexUuid,
    toast,
  });

  const printActions = useFestivalPrintActions({
    jobId,
    jobTitle: jobData.job?.title || "Festival",
    maxStages: jobData.maxStages,
    toast,
  });

  const adminActions = useFestivalAdminActions({
    fetchDocuments: documents.fetchDocuments,
    job: jobData.job,
    jobId,
    navigate,
    toast,
  });

  const whatsappActions = useFestivalWhatsappActions({
    isManagementUser,
    jobId,
    jobTitle: jobData.job?.title || "trabajo",
    maxStages: jobData.maxStages,
    toast,
  });

  const isSchedulingRoute = location.pathname.includes("/scheduling");
  const isArtistRoute = location.pathname.includes("/artists");
  const isGearRoute = location.pathname.includes("/gear");
  const canEdit = canEditJobs(userRole);
  const isHouseTech = isHouseTechRole(userRole);
  const isViewOnly = isTechnicianRole(userRole) && !isHouseTech;
  const isPlanningViewOnly = isViewOnly || isHouseTech;
  const canUploadDocuments = canUploadFestivalDocuments(userRole);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    const channel = supabase
      .channel(`job-${jobId}-updates`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
          filter: `id=eq.${jobId}`,
        },
        () => {
          jobData.fetchJobDetails({ silent: true });
          documents.fetchDocuments();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [documents.fetchDocuments, jobData.fetchJobDetails, jobId]);

  const handleAssignmentChange = useCallback(() => {
    jobData.fetchJobDetails({ silent: true });
    documents.fetchDocuments();
  }, [documents.fetchDocuments, jobData.fetchJobDetails]);

  const handleOpenAssignments = useCallback(() => {
    if (!jobId) return;
    setIsAssignmentDialogOpen(true);
  }, [jobId]);

  const handleNavigateTimesheets = useCallback(() => {
    if (!jobId) return;
    navigate(`/timesheets?jobId=${jobId}`);
  }, [jobId, navigate]);

  const handleOpenRouteSheet = useCallback(() => {
    setIsRouteSheetOpen(true);
  }, []);

  const handleOpenJobDetails = useCallback(() => {
    if (!jobData.job) return;
    setIsJobDetailsOpen(true);
  }, [jobData.job]);

  const handleRefreshAll = useCallback(() => {
    jobData.fetchJobDetails();
    documents.fetchDocuments();
    refetchFlexUuid();
  }, [documents.fetchDocuments, jobData.fetchJobDetails, refetchFlexUuid]);

  const navigateToCalculator = useCallback(
    (type: "pesos" | "consumos") => {
      const params = new URLSearchParams({ jobId: jobId || "" });
      const path = type === "pesos" ? "/sound/pesos" : "/sound/consumos";
      navigate(`${path}?${params.toString()}`);
    },
    [jobId, navigate],
  );

  if (!jobId) return { status: "missing_job_id" };
  if (jobData.isLoading) return { status: "loading" };
  if (!jobData.job) return { status: "not_found" };

  return {
    status: "ready",
    vm: {
      ...adminActions,
      ...documents,
      ...flexControls,
      ...mapPreview,
      ...printActions,
      ...whatsappActions,

      assignmentDepartment,
      setAssignmentDepartment,
      departmentOptions: FESTIVAL_DEPARTMENT_OPTIONS,
      humanizeDepartment: humanizeFestivalDepartment,

      canEdit,
      canUploadDocuments,
      isArtistRoute,
      isGearRoute,
      isHouseTech,
      isLoading: jobData.isLoading,
      isManagementUser,
      isPlanningViewOnly,
      isSchedulingRoute,
      isSingleJobMode,
      isViewOnly,
      job: jobData.job,
      jobDates: jobData.jobDates,
      jobId,
      maxStages: jobData.maxStages,
      navigate,
      userRole,
      venueData: jobData.venueData,
      artistCount: jobData.artistCount,
      festivalStageOptions: jobData.festivalStageOptions,

      flexError,
      flexUuid,
      folderExists,
      isFlexLoading,

      handleAssignmentChange,
      handleNavigateTimesheets,
      handleOpenAssignments,
      handleOpenJobDetails,
      handleOpenRouteSheet,
      handleRefreshAll,
      navigateToCalculator,

      isAssignmentDialogOpen,
      setIsAssignmentDialogOpen,
      isRouteSheetOpen,
      setIsRouteSheetOpen,
      isJobDetailsOpen,
      setIsJobDetailsOpen,
      isJobPresetsOpen,
      setIsJobPresetsOpen,
    },
  };
};
