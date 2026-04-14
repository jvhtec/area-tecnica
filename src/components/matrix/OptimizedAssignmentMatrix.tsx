import React, { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useOptimizedMatrixData } from "@/hooks/useOptimizedMatrixData";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { useStaffingRealtime } from "@/features/staffing/hooks/useStaffingRealtime";
import { useSendStaffingEmail } from "@/features/staffing/hooks/useStaffing";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { checkTimeConflictEnhanced } from "@/utils/technicianAvailability";
import { useStaffingMatrixStatuses } from "@/features/staffing/hooks/useStaffingMatrixStatuses";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { formatUserName } from "@/utils/userName";

import { OptimizedAssignmentMatrixView } from "./optimized-assignment-matrix/OptimizedAssignmentMatrixView";
import { chunkArray, invalidateMatrixJobsAndStaffingQueries, matrixQueryKeys } from "./optimized-assignment-matrix/matrixCore";
import { useMatrixViewportController } from "./optimized-assignment-matrix/useMatrixViewportController";
import { useMatrixSortingController } from "./optimized-assignment-matrix/useMatrixSortingController";
import { useMatrixInteractionController } from "./optimized-assignment-matrix/useMatrixInteractionController";
import type {
  MatrixActionsState,
  MatrixDataState,
  MatrixDialogsState,
  MatrixStaffingMaps,
  LegacyOptimizedAssignmentMatrixViewProps,
  OptimizedAssignmentMatrixExtendedProps,
  OptimizedAssignmentMatrixViewProps,
} from "./optimized-assignment-matrix/types";

const EMPTY_PROFILE_NAMES_MAP = new Map<string, string>();
const EMPTY_STAFFING_MAPS: MatrixStaffingMaps = {
  byJob: new Map(),
  byDate: new Map(),
};

export const OptimizedAssignmentMatrix = ({
  technicians,
  dates,
  jobs,
  onNearEdgeScroll,
  canExpandBefore = false,
  canExpandAfter = false,
  allowDirectAssign = false,
  allowMarkUnavailable = false,
  fridgeSet,
  cellWidth,
  cellHeight,
  technicianWidth,
  headerHeight,
  mobile = false,
}: OptimizedAssignmentMatrixExtendedProps) => {
  const { userRole } = useOptimizedAuth();
  const isManagementUser = ["admin", "management"].includes(userRole || "");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate: sendStaffingEmail } = useSendStaffingEmail();
  const { startRenderTimer, endRenderTimer, incrementCellRender } = usePerformanceMonitor();

  useStaffingRealtime();

  const CELL_WIDTH = cellWidth ?? 160;
  const CELL_HEIGHT = cellHeight ?? 60;
  const TECHNICIAN_WIDTH = technicianWidth ?? 256;
  const HEADER_HEIGHT = headerHeight ?? 80;

  const {
    allAssignments,
    getAssignmentForCell,
    getAvailabilityForCell,
    getJobsForDate,
    prefetchTechnicianData,
    updateAssignmentOptimistically,
    invalidateAssignmentQueries,
    invalidateAvailabilityQueries,
    isInitialLoading,
    isFetching,
  } = useOptimizedMatrixData({ technicians, dates, jobs });

  const declinedJobsByTech = useMemo(() => {
    const map = new Map<string, Set<string>>();
    allAssignments.forEach((assignment) => {
      if (assignment.status !== "declined") return;
      const declinedJobs = map.get(assignment.technician_id) || new Set<string>();
      declinedJobs.add(assignment.job_id);
      map.set(assignment.technician_id, declinedJobs);
    });
    return map;
  }, [allAssignments]);

  const interaction = useMatrixInteractionController({
    technicians,
    fridgeSet,
    allowDirectAssign,
    isManagementUser,
    getAssignmentForCell,
    getAvailabilityForCell,
    invalidateAssignmentQueries,
    invalidateAvailabilityQueries,
    prefetchTechnicianData,
    updateAssignmentOptimistically,
    toast,
    sendStaffingEmail,
    checkTimeConflictEnhanced,
    declinedJobsByTech,
  });

  const sorting = useMatrixSortingController({
    technicians,
    allAssignments,
    mobile,
    isManagementUser,
  });

  const viewport = useMatrixViewportController({
    dates,
    technicianCount: sorting.orderedTechnicians.length,
    mobile,
    canExpandBefore,
    canExpandAfter,
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT,
    technicianWidth: TECHNICIAN_WIDTH,
    headerHeight: HEADER_HEIGHT,
    isInitialLoading,
    onNearEdgeScroll,
  });

  useEffect(() => {
    const handleAssignmentUpdate = () => {
      void invalidateAssignmentQueries();
    };

    window.addEventListener("assignment-updated", handleAssignmentUpdate);
    return () => window.removeEventListener("assignment-updated", handleAssignmentUpdate);
  }, [invalidateAssignmentQueries]);

  useEffect(() => {
    const handleStaffingUpdate = () => {
      void invalidateMatrixJobsAndStaffingQueries(queryClient);
    };

    window.addEventListener("staffing-updated", handleStaffingUpdate);
    return () => window.removeEventListener("staffing-updated", handleStaffingUpdate);
  }, [queryClient]);

  useEffect(() => {
    startRenderTimer();
    return () => endRenderTimer();
  }, [endRenderTimer, startRenderTimer]);

  const visibleTechIds = useMemo(() => {
    const start = Math.max(0, viewport.visibleRows.start - 10);
    const end = Math.min(sorting.orderedTechnicians.length - 1, viewport.visibleRows.end + 10);
    return sorting.orderedTechnicians.slice(start, end + 1).map((technician) => technician.id);
  }, [sorting.orderedTechnicians, viewport.visibleRows.end, viewport.visibleRows.start]);

  const allJobsLite = useMemo(
    () => jobs.map((job) => ({ id: job.id, start_time: job.start_time, end_time: job.end_time })),
    [jobs],
  );
  const { data: staffingMaps = EMPTY_STAFFING_MAPS } = useStaffingMatrixStatuses(visibleTechIds, allJobsLite, dates);

  const actorIdsForTooltip = useMemo(() => {
    const ids = new Set<string>();

    allAssignments.forEach((assignment) => {
      if (assignment.assigned_by) {
        ids.add(assignment.assigned_by);
      }
    });

    staffingMaps.byDate.forEach((status) => {
      if (status.availability_requested_by) {
        ids.add(status.availability_requested_by);
      }
      if (status.offer_requested_by) {
        ids.add(status.offer_requested_by);
      }
    });

    return Array.from(ids);
  }, [allAssignments, staffingMaps]);

  const { data: profileNamesMap = EMPTY_PROFILE_NAMES_MAP } = useQuery({
    queryKey: matrixQueryKeys.tooltipProfileNames(actorIdsForTooltip),
    queryFn: async () => {
      if (!actorIdsForTooltip.length) return EMPTY_PROFILE_NAMES_MAP;

      const map = new Map<string, string>();
      const batches = chunkArray(actorIdsForTooltip, 50);

      for (const batch of batches) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, nickname")
          .in("id", batch);

        if (error) continue;

        (data || []).forEach((profile: {
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          nickname?: string | null;
        }) => {
          const fullName = formatUserName(profile.first_name, profile.nickname, profile.last_name) || "Usuario";
          map.set(profile.id, fullName);
        });
      }

      return map;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: actorIdsForTooltip.length > 0,
  });

  const handleUserCreated = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: matrixQueryKeys.techniciansPrefix });
  }, [queryClient]);

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Cargando matriz...</p>
        </div>
      </div>
    );
  }

  const dataState: MatrixDataState = {
    isFetching,
    isInitialLoading,
    dates,
    technicians,
    orderedTechnicians: sorting.orderedTechnicians,
    jobs,
    fridgeSet,
    allowDirectAssign,
    allowMarkUnavailable,
    mobile,
    selectedCells: interaction.selectedCells,
    staffingMaps,
    profileNamesMap,
    declinedJobsByTech,
    getJobsForDate,
    getAssignmentForCell,
    getAvailabilityForCell,
  };

  const actionsState: MatrixActionsState = {
    handleCellSelect: interaction.handleCellSelect,
    handleCellClick: interaction.handleCellClick,
    handleCellPrefetch: interaction.handleCellPrefetch,
    handleOptimisticUpdate: interaction.handleOptimisticUpdate,
    incrementCellRender,
    handleUserCreated,
  };

  const dialogsState: MatrixDialogsState = {
    cellAction: interaction.cellAction,
    currentTechnician: interaction.currentTechnician,
    closeDialogs: interaction.closeDialogs,
    handleJobSelected: interaction.handleJobSelected,
    handleStaffingActionSelected: interaction.handleStaffingActionSelected,
    forcedStaffingAction: interaction.forcedStaffingAction,
    forcedStaffingChannel: interaction.forcedStaffingChannel,
    availabilityDialog: interaction.availabilityDialog,
    setAvailabilityDialog: interaction.setAvailabilityDialog,
    availabilityCoverage: interaction.availabilityCoverage,
    setAvailabilityCoverage: interaction.setAvailabilityCoverage,
    availabilitySingleDate: interaction.availabilitySingleDate,
    setAvailabilitySingleDate: interaction.setAvailabilitySingleDate,
    availabilityMultiDates: interaction.availabilityMultiDates,
    setAvailabilityMultiDates: interaction.setAvailabilityMultiDates,
    availabilitySending: interaction.availabilitySending,
    setAvailabilitySending: interaction.setAvailabilitySending,
    conflictDialog: interaction.conflictDialog,
    setConflictDialog: interaction.setConflictDialog,
    handleEmailError: interaction.handleEmailError,
    offerChannel: interaction.offerChannel,
    toast: interaction.toast,
    sendStaffingEmail: interaction.sendStaffingEmail,
    checkTimeConflictEnhanced: interaction.checkTimeConflictEnhanced,
  };

  // Deprecated compatibility bridge for callers/tests still depending on
  // LegacyOptimizedAssignmentMatrixViewProps. Remove after the grouped view
  // migration is complete; update call sites that still rely on the flattened
  // OptimizedAssignmentMatrixViewProps shape before deleting this spread path.
  const legacyViewProps: LegacyOptimizedAssignmentMatrixViewProps = {
    isFetching,
    isInitialLoading,
    TECHNICIAN_WIDTH: viewport.TECHNICIAN_WIDTH,
    HEADER_HEIGHT: viewport.HEADER_HEIGHT,
    CELL_WIDTH: viewport.CELL_WIDTH,
    CELL_HEIGHT: viewport.CELL_HEIGHT,
    matrixWidth: viewport.matrixWidth,
    matrixHeight: viewport.matrixHeight,
    dateHeadersRef: viewport.dateHeadersRef,
    technicianScrollRef: viewport.technicianScrollRef,
    mainScrollRef: viewport.mainScrollRef,
    visibleCols: viewport.visibleCols,
    visibleRows: viewport.visibleRows,
    dates,
    technicians,
    orderedTechnicians: sorting.orderedTechnicians,
    fridgeSet,
    allowDirectAssign,
    allowMarkUnavailable,
    mobile,
    canNavLeft: viewport.canNavLeft,
    canNavRight: viewport.canNavRight,
    handleMobileNav: viewport.handleMobileNav,
    handleDateHeadersScroll: viewport.handleDateHeadersScroll,
    handleTechnicianScroll: viewport.handleTechnicianScroll,
    handleMainScroll: viewport.handleMainScroll,
    cycleTechSort: sorting.cycleTechSort,
    getSortLabel: sorting.getSortLabel,
    isManagementUser: sorting.isManagementUser,
    setCreateUserOpen: sorting.setCreateUserOpen,
    createUserOpen: sorting.createUserOpen,
    setSortJobId: sorting.setSortJobId,
    getJobsForDate,
    getAssignmentForCell,
    getAvailabilityForCell,
    selectedCells: interaction.selectedCells,
    staffingMaps,
    profileNamesMap,
    handleCellSelect: interaction.handleCellSelect,
    handleCellClick: interaction.handleCellClick,
    handleCellPrefetch: interaction.handleCellPrefetch,
    handleOptimisticUpdate: interaction.handleOptimisticUpdate,
    incrementCellRender,
    handleUserCreated,
    declinedJobsByTech,
    cellAction: interaction.cellAction,
    currentTechnician: interaction.currentTechnician,
    closeDialogs: interaction.closeDialogs,
    handleJobSelected: interaction.handleJobSelected,
    handleStaffingActionSelected: interaction.handleStaffingActionSelected,
    forcedStaffingAction: interaction.forcedStaffingAction,
    forcedStaffingChannel: interaction.forcedStaffingChannel,
    jobs,
    offerChannel: interaction.offerChannel,
    toast: interaction.toast,
    sendStaffingEmail: interaction.sendStaffingEmail,
    checkTimeConflictEnhanced: interaction.checkTimeConflictEnhanced,
    availabilityDialog: interaction.availabilityDialog,
    setAvailabilityDialog: interaction.setAvailabilityDialog,
    availabilityCoverage: interaction.availabilityCoverage,
    setAvailabilityCoverage: interaction.setAvailabilityCoverage,
    availabilitySingleDate: interaction.availabilitySingleDate,
    setAvailabilitySingleDate: interaction.setAvailabilitySingleDate,
    availabilityMultiDates: interaction.availabilityMultiDates,
    setAvailabilityMultiDates: interaction.setAvailabilityMultiDates,
    availabilitySending: interaction.availabilitySending,
    setAvailabilitySending: interaction.setAvailabilitySending,
    handleEmailError: interaction.handleEmailError,
    conflictDialog: interaction.conflictDialog,
    setConflictDialog: interaction.setConflictDialog,
    techMedalRankings: sorting.techMedalRankings,
    techLastYearMedalRankings: sorting.techLastYearMedalRankings,
  };

  const viewProps: OptimizedAssignmentMatrixViewProps & LegacyOptimizedAssignmentMatrixViewProps = {
    viewport,
    data: dataState,
    actions: actionsState,
    dialogs: dialogsState,
    sorting,
    ...legacyViewProps,
  };

  return <OptimizedAssignmentMatrixView {...viewProps} />;
};
