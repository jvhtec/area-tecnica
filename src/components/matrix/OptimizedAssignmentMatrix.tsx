import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOptimizedMatrixData } from '@/hooks/useOptimizedMatrixData';
import { invalidateMatrixHeaderCounts } from '@/lib/matrix-header-counts';
import { formatMadridDateKey, madridDateKeyToCalendarDate } from '@/utils/timezoneUtils';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useStaffingRealtime } from '@/features/staffing/hooks/useStaffingRealtime';
import { useCancelStaffingRequest, useSendStaffingEmail } from '@/features/staffing/hooks/useStaffing';
import { dataLayerClient } from '@/services/dataLayerClient';
import { useStaffingMatrixStatuses } from '@/features/staffing/hooks/useStaffingMatrixStatuses';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelectedCellStore } from '@/stores/useSelectedCellStore';
import { formatUserName } from '@/utils/userName';
import { isManagementRole } from '@/utils/permissions';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';
import { useMatrixV2Config } from '@/features/matrix-v2/useMatrixV2Config';

import { OptimizedAssignmentMatrixView } from '@/components/matrix/optimized-assignment-matrix/OptimizedAssignmentMatrixView';
import { useMatrixTechnicianOrdering } from '@/components/matrix/optimized-assignment-matrix/useMatrixTechnicianOrdering';
import { useMatrixHeaderCounts } from '@/hooks/useMatrixHeaderCounts';
import type { OptimizedAssignmentMatrixExtendedProps } from '@/components/matrix/optimized-assignment-matrix/types';


import { queryKeys } from "@/lib/react-query";
const EMPTY_PROFILE_NAMES_MAP = new Map<string, string>();
const EMPTY_ROLE_SLOTS = new Map<string, RoleSlot[]>();

// The staffing badges are fetched for a block-aligned window of technicians
// rather than exactly the visible rows: the query is keyed on the id list, so
// a window that moved with every row scrolled refetched (three round trips)
// on nearly every scroll step. Aligned blocks only change at a boundary.
const STAFFING_TECH_BLOCK = 40;
const STAFFING_TECH_OVERSCAN = 10;

type ProfileNameRow = {
  id: string;
  first_name: string | null;
  nickname: string | null;
  last_name: string | null;
};

export const OptimizedAssignmentMatrix = ({
  technicians,
  dates,
  jobs,
  onNearEdgeScroll,
  canExpandBefore = false,
  canExpandAfter = false,
  fridgeSet,
  cellWidth,
  cellHeight,
  technicianWidth,
  headerHeight,
  mobile = false,
  staffingDepartment = null,
  roleSlotsByJob = EMPTY_ROLE_SLOTS,
  focusJobId = null,
  focusStatus = 'invited',
  onFocusJobChange,
}: OptimizedAssignmentMatrixExtendedProps) => {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  // Global selected cell store for Stream Deck integration
  // Selected individually: the bare hook subscribes to the whole store, so
  // every selection change re-rendered the matrix a second time.
  const selectCell = useSelectedCellStore((state) => state.selectCell);
  const clearGlobalSelection = useSelectedCellStore((state) => state.clearSelection);
  const isGlobalCellSelected = useSelectedCellStore((state) => state.isCellSelected);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const { userRole, user } = useOptimizedAuth();
  const isManagementUser = isManagementRole(userRole);
  const qc = useQueryClient();

  // Performance monitoring
  const { startRenderTimer, endRenderTimer, incrementCellRender } = usePerformanceMonitor('AssignmentMatrix');

  // Staffing functionality
  useStaffingRealtime();
  // Owned here rather than in every cell: the grid renders hundreds of cells,
  // and each useMutation call registers its own observer.
  const { mutateAsync: sendStaffingEmailAsync } = useSendStaffingEmail();
  const { mutateAsync: cancelStaffingAsync } = useCancelStaffingRequest();

  // Cell dimensions (overridable for mobile). The desktop row is 72px so the
  // redesigned status card (job, role, and a "día único" line) fits without the
  // corner controls landing on top of the text.
  const CELL_WIDTH = cellWidth ?? 160;
  const CELL_HEIGHT = cellHeight ?? 72;
  const TECHNICIAN_WIDTH = technicianWidth ?? 256;
  const HEADER_HEIGHT = headerHeight ?? 80;

  // Use optimized data hook
  const {
    allAssignments,
    getAssignmentForCell,
    getAvailabilityForCell,
    getJobsForDate,
    prefetchTechnicianData,
    invalidateAssignmentQueries,
    isInitialLoading,
    isFetching
  } = useOptimizedMatrixData({ technicians, dates, jobs });

  const {
    orderedTechnicians: baseOrderedTechnicians,
    techMedalRankings,
    techLastYearMedalRankings,
    cycleTechSort,
    getSortLabel,
  } = useMatrixTechnicianOrdering({
    technicians,
    mobile,
  });

  // Build declined job sets per technician for targeted staffing blocking
  const declinedJobsByTech = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    allAssignments?.forEach((a) => {
      if (a?.status === 'declined' && a.technician_id && a.job_id) {
        if (!map.has(a.technician_id)) map.set(a.technician_id, new Set());
        map.get(a.technician_id)!.add(a.job_id);
      }
    });
    return map;
  }, [allAssignments]);

  // The runner, inspector, quick actions and job focus.
  const { v2Config, orderedTechnicians } = useMatrixV2Config({
    ready: !isInitialLoading,
    jobs,
    technicians,
    dates,
    baseOrderedTechnicians,
    allAssignments,
    getAssignmentForCell,
    getAvailabilityForCell,
    isManagementUser,
    roleSlotsByJob,
    declinedJobsByTech,
    fridgeSet,
    focusJobId,
    focusStatus,
    onFocusJobChange,
  });

  // Listen for assignment updates and refresh data
  useEffect(() => {
    const handleAssignmentUpdate = () => {
      invalidateAssignmentQueries();
    };

    window.addEventListener('assignment-updated', handleAssignmentUpdate);
    return () => window.removeEventListener('assignment-updated', handleAssignmentUpdate);
  }, [invalidateAssignmentQueries]);

  // Listen for staffing updates to refresh statuses
  useEffect(() => {
    const handler = () => {
      qc.invalidateQueries({ queryKey: queryKeys.scope('staffing-matrix') });
      // The date-header invitation/offer badges are counted off staffing_requests.
      void invalidateMatrixHeaderCounts(qc);
    };
    window.addEventListener('staffing-updated', handler);
    return () => window.removeEventListener('staffing-updated', handler);
  }, [qc]);

  // Start performance monitoring
  useEffect(() => {
    startRenderTimer();
    return () => endRenderTimer();
  }, [startRenderTimer, endRenderTimer]);

  // Calculate matrix dimensions
  const matrixWidth = dates.length * CELL_WIDTH;
  const matrixHeight = technicians.length * CELL_HEIGHT;

  // The scroll position and virtualised window live in the view, so a scroll
  // step re-renders the grid alone and not this component's data hooks. Only
  // the staffing badges need to know where the user is, and only per block of
  // technicians: the view reports the visible rows and this keeps the block.
  const [staffingBlock, setStaffingBlock] = useState({ start: 0, end: STAFFING_TECH_BLOCK });
  const handleVisibleRowsChange = useCallback((rows: { start: number; end: number }) => {
    const start = Math.floor(Math.max(0, rows.start - STAFFING_TECH_OVERSCAN) / STAFFING_TECH_BLOCK) * STAFFING_TECH_BLOCK;
    const end = (Math.floor((rows.end + STAFFING_TECH_OVERSCAN) / STAFFING_TECH_BLOCK) + 1) * STAFFING_TECH_BLOCK;
    setStaffingBlock((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  // Date header counts for the whole range (no per-column queries on scroll).
  const getHeaderCounts = useMatrixHeaderCounts({
    dates,
    jobs,
    allAssignments,
    getJobsForDate,
    includeOpenSlots: !mobile,
  });

  // Independent of selectedCells, so the callback every cell receives stays
  // stable: depending on the set handed each of the hundreds of memoized cells
  // a new onSelect on every click, re-rendering the whole visible grid.
  const handleCellSelect = useCallback((technicianId: string, date: Date, selected: boolean) => {
    const cellKey = `${technicianId}-${formatMadridDateKey(date)}`;

    if (selected) {
      // Update global store for single-cell selection (for Stream Deck shortcuts)
      selectCell(technicianId, date);
    } else if (isGlobalCellSelected(technicianId, date)) {
      // Clear global selection if deselecting
      clearGlobalSelection();
    }

    setSelectedCells((prev) => {
      if (prev.has(cellKey) === selected) return prev;
      const next = new Set(prev);
      if (selected) next.add(cellKey);
      else next.delete(cellKey);
      return next;
    });
  }, [selectCell, isGlobalCellSelected, clearGlobalSelection]);

  const clearCellSelection = useCallback(() => {
    setSelectedCells(new Set());
    clearGlobalSelection();
  }, [clearGlobalSelection]);

  // Drag and shift-click replace the selection in one go. Stream Deck keeps
  // working from one cell, the last of the new selection.
  const replaceSelection = useCallback((keys: Set<string>) => {
    setSelectedCells(keys);
    const last = [...keys].pop();
    const date = last ? madridDateKeyToCalendarDate(last.slice(-10)) : null;
    if (last && date) selectCell(last.slice(0, -11), date);
    else clearGlobalSelection();
  }, [selectCell, clearGlobalSelection]);

  const handleCellPrefetch = useCallback((technicianId: string) => {
    prefetchTechnicianData(technicianId);
  }, [prefetchTechnicianData]);

  // Batched staffing statuses for visible window
  const visibleTechIds = useMemo(
    () => orderedTechnicians.slice(staffingBlock.start, staffingBlock.end).map(t => t.id),
    [orderedTechnicians, staffingBlock],
  );
  // Fetch staffing statuses for ALL currently loaded dates and jobs for the visible technicians
  // This avoids re-fetching when scrolling horizontally, making badges render immediately.
  const allJobsLite = useMemo(() => jobs.map(j => ({ id: j.id, title: j.title, start_time: j.start_time, end_time: j.end_time })), [jobs]);
  const visibleStaffingAssignments = useMemo(() => {
    const ids = new Set(visibleTechIds);
    return allAssignments.filter(a => ids.has(a.technician_id));
  }, [allAssignments, visibleTechIds]);
  const { data: staffingMaps } = useStaffingMatrixStatuses(visibleTechIds, allJobsLite, dates, visibleStaffingAssignments);
  const actorIdsForTooltip = useMemo(() => {
    const ids = new Set<string>();
    allAssignments.forEach((assignment) => {
      if (assignment?.assigned_by) ids.add(assignment.assigned_by);
    });
    staffingMaps?.byDate?.forEach((status) => {
      if (!status?.availability_actor_label && status?.availability_requested_by) ids.add(status.availability_requested_by);
      if (!status?.offer_actor_label && status?.offer_requested_by) ids.add(status.offer_requested_by);
    });
    return Array.from(ids);
  }, [allAssignments, staffingMaps]);

  const { data: profileNamesMap = EMPTY_PROFILE_NAMES_MAP } = useQuery({
    queryKey: queryKeys.scope('matrix-tooltip-profile-names', [...actorIdsForTooltip].sort().join(',')),
    queryFn: async () => {
      if (!actorIdsForTooltip.length) return EMPTY_PROFILE_NAMES_MAP;
      const chunk = <T,>(arr: T[], size: number) => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const batches = chunk(actorIdsForTooltip, 50);
      const map = new Map<string, string>();
      for (const batch of batches) {
        const { data, error } = await dataLayerClient.from('profiles')
          .select('id, first_name, last_name, nickname')
          .in('id', batch);
        if (error) {
          console.warn('Failed loading tooltip profile names', error);
          continue;
        }
        ((data || []) as ProfileNameRow[]).forEach((profile) => {
          const fullName = formatUserName(profile.first_name, profile.nickname, profile.last_name) || 'Usuario';
          if (profile.id) map.set(profile.id, fullName);
        });
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // Keep the names already loaded while a wider id set fetches, rather than
    // dropping every tooltip back to "unknown sender" in the meantime.
    placeholderData: (previous) => previous,
    enabled: actorIdsForTooltip.length > 0,
  });

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

  const viewProps = {
    isFetching, isInitialLoading,
    TECHNICIAN_WIDTH, HEADER_HEIGHT, CELL_WIDTH, CELL_HEIGHT, matrixWidth, matrixHeight,
    canExpandBefore, canExpandAfter, onNearEdgeScroll, onVisibleRowsChange: handleVisibleRowsChange,
    dates, technicians, orderedTechnicians,
    fridgeSet, mobile, staffingDepartment,
    cycleTechSort, getSortLabel,
    isManagementUser, setCreateUserOpen, createUserOpen, qc,
    getJobsForDate, getHeaderCounts, getAssignmentForCell, getAvailabilityForCell, selectedCells, staffingMaps,
    profileNamesMap,
    handleCellSelect, handleCellPrefetch, incrementCellRender,
    declinedJobsByTech,
    jobs, sendStaffingEmailAsync, cancelStaffingAsync,
    techMedalRankings, techLastYearMedalRankings,
    clearCellSelection, onReplaceSelection: replaceSelection, staffingUserId: user?.id ?? null,
    v2: v2Config,
  };

  return <OptimizedAssignmentMatrixView {...viewProps} />;
};
