import React, { useState, useMemo } from 'react';
import { OptimizedAssignmentMatrix } from '@/components/matrix/OptimizedAssignmentMatrix';
import { useVirtualizedDateRange } from '@/hooks/useVirtualizedDateRange';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataLayerClient } from '@/services/dataLayerClient';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { hasTechnicianSelfServiceAccess, isManagementRole } from '@/utils/permissions';
import { MatrixPageControls } from '@/pages/job-assignment-matrix/MatrixPageControls';
import { StaffingReminderDialogs } from '@/pages/job-assignment-matrix/StaffingReminderDialogs';
import { useDebouncedMatrixSearch, useIsMatrixMobile } from '@/pages/job-assignment-matrix/useMatrixViewport';
import { useStaffingButtonPreferences } from '@/pages/job-assignment-matrix/useStaffingButtonPreferences';
import {
  AVAILABLE_DEPARTMENTS,
  DEPARTMENT_LABELS,
  FALLBACK_DEPARTMENT,
  OUTSTANDING_STORAGE_KEY,
  fetchAssignmentsForWindow,
  fetchAvailabilityForWindow,
  fetchJobsForWindow,
  formatLabel,
  parseSummaryRow,
  type Department,
  type MatrixJob,
  type OutstandingJobInfo,
  type OutstandingRoleInfo,
  type StaffingAssignmentRow,
  type StaffingSummaryRow,
} from '@/pages/job-assignment-matrix/utils';


import { queryKeys } from "@/lib/react-query";

export default function JobAssignmentMatrix() {
  const qc = useQueryClient();
  const prefetchStatusRef = React.useRef<Map<string, 'pending' | 'done'>>(new Map<string, 'pending' | 'done'>());
  const { user, userDepartment, userRole } = useOptimizedAuth();
  const [defaultDepartment, setDefaultDepartment] = useState<Department>(FALLBACK_DEPARTMENT);
  const [selectedDepartment, setSelectedDepartment] = useState<Department>(FALLBACK_DEPARTMENT);
  const hasManualDepartmentSelection = React.useRef(false);
  const isMobile = useIsMatrixMobile();
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedMatrixSearch(searchTerm);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allowDirectAssign, setAllowDirectAssign] = useState(false);
  const [allowMarkUnavailable, setAllowMarkUnavailable] = useState(false);
  const {
    hideStaffingEmailButtons,
    setHideStaffingEmailButtons,
    hideStaffingWhatsappButtons,
    setHideStaffingWhatsappButtons,
  } = useStaffingButtonPreferences(user?.id);
  const canMarkUnavailable = isManagementRole(userRole);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [hideFridge, setHideFridge] = useState<boolean>(true);
  const [showStaffingReminder, setShowStaffingReminder] = useState(false);
  const [staffingOrchestratorTarget, setStaffingOrchestratorTarget] = useState<null | {
    jobId: string;
    department: string;
    jobTitle: string;
  }>(null);
  const [lastAcknowledgedHash, setLastAcknowledgedHash] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedHash = window.sessionStorage.getItem(OUTSTANDING_STORAGE_KEY);
      if (storedHash) {
        setLastAcknowledgedHash(storedHash);
      }
    } catch (error) {
      console.warn('Failed to read outstanding hash from storage', error);
    }
  }, []);

  const specialtyOptions = React.useMemo(() => {
    if (selectedDepartment === 'lights') {
      return ['Operador (MA2)', 'Operador (MA3)', 'Operador (HOG)', 'Operador (AVO)', 'Dimmer', 'Rigging', 'Montador'] as const;
    }
    if (selectedDepartment === 'sound') {
      return ['foh', 'monitores', 'sistemas', 'rf', 'Trabajo en altura', 'Técnico de escenario', 'Montador'] as const;
    }
    return [] as const;
  }, [selectedDepartment]);
  const toggleSpecialty = (name: string) => {
    setSelectedSkills(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]);
  };

  const normalizedUserDepartment = React.useMemo<Department>(() => {
    const normalized = typeof userDepartment === 'string' ? userDepartment.toLowerCase() : '';
    if (AVAILABLE_DEPARTMENTS.includes(normalized as Department)) {
      return normalized as Department;
    }
    return FALLBACK_DEPARTMENT;
  }, [userDepartment]);

  React.useEffect(() => {
    setDefaultDepartment((prev) => {
      if (prev !== normalizedUserDepartment) {
        hasManualDepartmentSelection.current = false;
      }
      return normalizedUserDepartment;
    });
  }, [normalizedUserDepartment]);

  React.useEffect(() => {
    if (!hasManualDepartmentSelection.current) {
      setSelectedDepartment((prev) => (prev === defaultDepartment ? prev : defaultDepartment));
    }
  }, [defaultDepartment]);

  const handleDepartmentChange = React.useCallback((value: Department) => {
    hasManualDepartmentSelection.current = true;
    setSelectedDepartment(value);
  }, []);

  const resetDepartmentToDefault = React.useCallback(() => {
    hasManualDepartmentSelection.current = false;
    setSelectedDepartment(defaultDepartment);
  }, [defaultDepartment]);

  // Use virtualized date range with expandable capabilities
  const {
    dateRange,
    todayIndex,
    canExpandBefore,
    canExpandAfter,
    expandBefore,
    expandAfter,
    setCenterDate,
    resetRange,
    jumpToMonth,
    rangeInfo,
    getProjectedRangeInfo
  } = useVirtualizedDateRange({
    initialWeeksBefore: 1,   // Start with 1 week before today
    initialWeeksAfter: 2,    // Start with 2 weeks after today
    maxWeeksBefore: 52,      // Allow up to 1 year before
    maxWeeksAfter: 52,       // Allow up to 1 year after
    expandByWeeks: 4         // Expand by 4 weeks at a time
  });

  // Optimized technicians query
  const {
    data: technicians = [],
    isInitialLoading: isInitialLoadingTechnicians,
    isFetching: isFetchingTechnicians,
  } = useQuery<any[]>({
    queryKey: queryKeys.scope('optimized-matrix-technicians', selectedDepartment),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.rpc('get_profiles_with_skills');

      if (error) throw error;

      const filtered = (data || []).filter((tech: any) => {
        const techDepartment = typeof tech.department === 'string' ? tech.department.toLowerCase() : '';

        // Production tab includes both production and logistics departments
        if (selectedDepartment === 'production') {
          if (techDepartment !== 'production' && techDepartment !== 'logistics') {
            return false;
          }
        } else {
          if (techDepartment !== selectedDepartment) {
            return false;
          }
        }

        return hasTechnicianSelfServiceAccess(tech.role, tech.assignable_as_tech);
      });

      return filtered.sort((a: any, b: any) => {
        const deptCompare = (a.department || '').localeCompare(b.department || '');
        if (deptCompare !== 0) return deptCompare;
        return (a.last_name || '').localeCompare(b.last_name || '');
      });
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fridge state for technicians currently in view
  const technicianIds = React.useMemo(() => technicians.map((t: any) => t.id), [technicians]);
  const { data: fridgeRows = [] } = useQuery({
    queryKey: queryKeys.scope('technician-fridge-status', technicianIds),
    queryFn: async () => {
      if (!technicianIds.length) return [] as Array<{ technician_id: string; in_fridge: boolean }>;
      const { data, error } = await dataLayerClient.from('technician_fridge')
        .select('technician_id, in_fridge')
        .in('technician_id', technicianIds);
      if (error) throw error;
      return data || [];
    },
    enabled: technicianIds.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  const fridgeSet = React.useMemo(() => {
    const s = new Set<string>();
    (fridgeRows as Array<{ technician_id: string; in_fridge: boolean }>).forEach(r => { if (r.in_fridge) s.add(r.technician_id); });
    return s;
  }, [fridgeRows]);

  // Count of technicians marked in fridge among current technician list
  const fridgeCount = React.useMemo(() => {
    if (!technicians?.length || !fridgeSet?.size) return 0;
    let c = 0;
    for (const t of technicians as any[]) if (fridgeSet.has(t.id)) c++;
    return c;
  }, [technicians, fridgeSet]);

  // Realtime invalidation for fridge state
  React.useEffect(() => {
    const ch = (dataLayerClient as any)
      .channel('rt-technician-fridge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technician_fridge' }, () => {
        qc.invalidateQueries({ queryKey: queryKeys.scope('technician-fridge-status') });
      })
      .subscribe();
    return () => { try { (dataLayerClient as any).removeChannel(ch); } catch { /* channel may already be removed */ } };
  }, [qc]);

  // Keep the technician roster fresh when users are added or edited in settings.
  React.useEffect(() => {
    const ch = (dataLayerClient as any)
      .channel('rt-matrix-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        qc.invalidateQueries({ queryKey: queryKeys.scope('optimized-matrix-technicians') });
        qc.invalidateQueries({ queryKey: queryKeys.scope('technician-fridge-status') });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_skills' }, () => {
        qc.invalidateQueries({ queryKey: queryKeys.scope('optimized-matrix-technicians') });
      })
      .subscribe();
    return () => { try { (dataLayerClient as any).removeChannel(ch); } catch { /* channel may already be removed */ } };
  }, [qc]);

  // Filter technicians based on search term
  const filteredTechnicians = useMemo(() => {
    const arr = technicians.filter((tech: any) => {
      const matchesSearch = !debouncedSearch || (
        `${tech.first_name} ${tech.last_name}`.toLowerCase().includes(debouncedSearch) ||
        tech.email?.toLowerCase().includes(debouncedSearch) ||
        tech.department?.toLowerCase().includes(debouncedSearch)
      );
      if (!matchesSearch) return false;
      if (hideFridge && fridgeSet.has(tech.id)) return false;
      if (!selectedSkills.length) return true;
      const skills: Array<{ name: string }> = (tech.skills || []).map((s: any) => ({ name: (s.name || '').toLowerCase() }));
      // Require all selected skills to be present
      return selectedSkills.every(sel => skills.some(s => s.name === sel.toLowerCase()));
    });

    if (!selectedSkills.length) return arr;
    // Sort by skill match strength
    const scoreFor = (tech: any) => {
      const skills = (tech.skills || []) as Array<{ name?: string; proficiency?: number; is_primary?: boolean; category?: string | null }>;
      let score = 0;
      for (const sel of selectedSkills) {
        const m = skills.find(s => (s.name || '').toLowerCase() === sel.toLowerCase());
        if (!m) continue;
        const prof = Number(m.proficiency ?? 0);
        if (m.is_primary) score += 3;
        if (prof >= 4) score += 2; else if (prof >= 2) score += 1;
        // small bonus for sound-specialty when filtering foh/mon/rf
        if ((m.category || '') === 'sound-specialty') score += 1;
      }
      return score;
    };
    return arr.sort((a: any, b: any) => {
      const da = scoreFor(a);
      const db = scoreFor(b);
      if (db !== da) return db - da;
      // tie-breakers: department then last name
      const ad = (a.department || '').localeCompare(b.department || '');
      if (ad !== 0) return ad;
      return (a.last_name || '').localeCompare(b.last_name || '');
    });
  }, [technicians, debouncedSearch, selectedSkills, hideFridge, fridgeSet]);

  const filteredTechnicianIds = useMemo(() => filteredTechnicians.map((tech: { id: string }) => tech.id), [filteredTechnicians]);
  const filteredTechnicianIdsKey = useMemo(() => filteredTechnicianIds.join(','), [filteredTechnicianIds]);

  // Optimized jobs query with smart date filtering
  const {
    data: yearJobs = [],
    isInitialLoading: isInitialLoadingJobs,
    isFetching: isFetchingJobs,
  } = useQuery<any[]>({
    queryKey: queryKeys.scope('optimized-matrix-jobs', rangeInfo.startFormatted, rangeInfo.endFormatted, selectedDepartment),
    queryFn: async () => {
      return fetchJobsForWindow(rangeInfo.start, rangeInfo.end, selectedDepartment);
    },
    enabled: dateRange.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    placeholderData: (previousData) => previousData ?? [],
  });

  const isInitialMatrixLoad = isInitialLoadingTechnicians || isInitialLoadingJobs;
  const isBackgroundFetchingMatrix =
    (isFetchingTechnicians && !isInitialLoadingTechnicians) ||
    (isFetchingJobs && !isInitialLoadingJobs);

  React.useEffect(() => {
    if (isInitialMatrixLoad) return;
    if (!canExpandAfter) return;

    const projection = getProjectedRangeInfo('after');
    if (!projection) return;

    const { rangeInfo: projectedRange } = projection;
    const { start, end, startFormatted, endFormatted } = projectedRange;
    if (!start || !end) return;

    const technicianIds = filteredTechnicianIds;
    const technicianKey = filteredTechnicianIdsKey;
    const windowKey = [startFormatted, endFormatted, selectedDepartment, technicianKey].join('|');

    const currentStatus = prefetchStatusRef.current.get(windowKey);
    if (currentStatus === 'pending' || currentStatus === 'done') return;

    let cancelled = false;
    prefetchStatusRef.current.set(windowKey, 'pending');

    const runPrefetch = async () => {
      const jobCacheKey = ['optimized-matrix-jobs', startFormatted, endFormatted, selectedDepartment] as const;
      const jobsData = await qc.prefetchQuery({
        queryKey: jobCacheKey,
        queryFn: () => fetchJobsForWindow(start, end, selectedDepartment),
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      });

      if (cancelled) return;

      const jobsForWindow = Array.isArray(jobsData)
        ? (jobsData as MatrixJob[])
        : ((qc.getQueryData(jobCacheKey) as MatrixJob[]) ?? []);
      const jobIds = jobsForWindow.map((job) => job.id).filter(Boolean);

      if (!cancelled && jobIds.length && technicianIds.length) {
        await qc.prefetchQuery({
          queryKey: queryKeys.scope('optimized-matrix-assignments', jobIds, technicianIds, startFormatted),
          queryFn: () => fetchAssignmentsForWindow(jobIds, technicianIds, jobsForWindow),
          staleTime: 30 * 1000,
          gcTime: 2 * 60 * 1000,
        });
      }

      if (!cancelled && technicianIds.length) {
        await qc.prefetchQuery({
          queryKey: queryKeys.scope('optimized-matrix-availability', technicianIds, startFormatted, endFormatted),
          queryFn: () => fetchAvailabilityForWindow(technicianIds, start, end),
          staleTime: 60 * 1000,
          gcTime: 10 * 60 * 1000,
        });
      }

      if (!cancelled && canExpandAfter) {
        expandAfter();
      }
    };

    runPrefetch()
      .then(() => {
        if (!cancelled) {
          prefetchStatusRef.current.set(windowKey, 'done');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          prefetchStatusRef.current.delete(windowKey);
          console.error('Failed to prefetch next matrix window', error);
        }
      });

    return () => {
      cancelled = true;
      if (prefetchStatusRef.current.get(windowKey) === 'pending') {
        prefetchStatusRef.current.delete(windowKey);
      }
    };
  }, [
    qc,
    canExpandAfter,
    expandAfter,
    filteredTechnicianIds,
    filteredTechnicianIdsKey,
    getProjectedRangeInfo,
    isInitialMatrixLoad,
    selectedDepartment,
  ]);

  const jobIds = React.useMemo(() => yearJobs.map((j: any) => j.id).filter(Boolean), [yearJobs]);
  const jobIdsKey = React.useMemo(() => (jobIds.length ? jobIds.slice().sort().join(',') : 'none'), [jobIds]);

  const staffingReminderQuery = useQuery({
    queryKey: queryKeys.scope('matrix-staffing-summary', jobIdsKey),
    queryFn: async () => {
      if (!jobIds.length) {
        return { summaries: [] as StaffingSummaryRow[], assignments: [] as StaffingAssignmentRow[] };
      }

      const [summaryRes, assignmentsRes] = await Promise.all([
        dataLayerClient.from('job_required_roles_summary')
          .select('job_id, department, roles')
          .in('job_id', jobIds),
        dataLayerClient.from('job_assignments')
          .select('job_id, sound_role, lights_role, video_role, production_role, status')
          .in('job_id', jobIds),
      ]);

      if (summaryRes.error) throw summaryRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      const summaries = (summaryRes.data || [])
        .map(parseSummaryRow)
        .filter((row): row is StaffingSummaryRow => Boolean(row));

      const assignments = ((assignmentsRes.data || []) as StaffingAssignmentRow[])
        .filter((row): row is StaffingAssignmentRow => Boolean(row && row.job_id))
        .map((row) => ({
          ...row,
          sound_role: row.sound_role ? String(row.sound_role) : null,
          lights_role: row.lights_role ? String(row.lights_role) : null,
          video_role: row.video_role ? String(row.video_role) : null,
          status: row.status ? String(row.status) : null,
        }));

      return { summaries, assignments };
    },
    enabled: jobIds.length > 0,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const outstandingJobs = useMemo<OutstandingJobInfo[]>(() => {
    const payload = staffingReminderQuery.data;
    if (!payload) return [];
    const { summaries, assignments } = payload;
    if (!summaries.length) return [];

    const jobTitleMap = new Map<string, string>(
      yearJobs.map((job: any) => [job.id, job.title || 'Trabajo sin título'])
    );
    const jobOrder = yearJobs.map((job: any) => job.id);

    const assignmentCounts = new Map<string, number>();

    const addAssignment = (jobId: string, department: string, role: string | null) => {
      if (!jobId || !department || !role) return;
      const key = `${jobId}:${department}:${role}`;
      assignmentCounts.set(key, (assignmentCounts.get(key) || 0) + 1);
    };

    assignments.forEach((row) => {
      if (!row?.job_id) return;
      const status = (row.status || '').toLowerCase();
      if (status === 'declined') return;
      addAssignment(row.job_id, 'sound', row.sound_role ? row.sound_role.trim() : null);
      addAssignment(row.job_id, 'lights', row.lights_role ? row.lights_role.trim() : null);
      addAssignment(row.job_id, 'video', row.video_role ? row.video_role.trim() : null);
      addAssignment(row.job_id, 'production', row.production_role ? row.production_role.trim() : null);
    });

    const jobMap = new Map<string, OutstandingJobInfo>();

    summaries.forEach((summary) => {
      const jobId = summary.job_id;
      const department = summary.department;
      if (!jobId || !department) return;

      const outstandingRoles: OutstandingRoleInfo[] = summary.roles
        .map((role) => {
          const roleCode = role.role_code;
          const required = Number(role.quantity || 0);
          const assigned = assignmentCounts.get(`${jobId}:${department}:${roleCode}`) || 0;
          return {
            roleCode,
            required,
            assigned,
            outstanding: Math.max(required - assigned, 0),
          };
        })
        .filter((role) => role.outstanding > 0)
        .sort((a, b) => a.roleCode.localeCompare(b.roleCode));

      if (!outstandingRoles.length) return;

      let jobEntry = jobMap.get(jobId);
      if (!jobEntry) {
        jobEntry = {
          jobId,
          jobTitle: jobTitleMap.get(jobId) || 'Trabajo sin título',
          outstandingTotal: 0,
          departments: [],
        };
        jobMap.set(jobId, jobEntry);
      }

      const outstandingTotal = outstandingRoles.reduce((sum, role) => sum + role.outstanding, 0);
      const displayName = DEPARTMENT_LABELS[department] || formatLabel(department);
      jobEntry.departments.push({
        department,
        displayName,
        outstandingTotal,
        roles: outstandingRoles,
      });
      jobEntry.outstandingTotal += outstandingTotal;
    });

    const ordered: OutstandingJobInfo[] = [];
    jobOrder.forEach((jobId) => {
      const entry = jobMap.get(jobId);
      if (entry) {
        entry.departments.sort((a, b) => a.displayName.localeCompare(b.displayName));
        ordered.push(entry);
      }
    });

    return ordered;
  }, [staffingReminderQuery.data, yearJobs]);

  const outstandingHash = useMemo(() => (outstandingJobs.length ? JSON.stringify(outstandingJobs) : null), [outstandingJobs]);

  // Auto-popup disabled - reminder is now only accessible via button
  React.useEffect(() => {
    if (!staffingReminderQuery.isSuccess) return;
    if (!outstandingJobs.length) {
      if (showStaffingReminder) setShowStaffingReminder(false);
      if (lastAcknowledgedHash !== null) setLastAcknowledgedHash(null);
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.removeItem(OUTSTANDING_STORAGE_KEY);
        } catch (error) {
          console.warn('Failed to clear outstanding hash from storage', error);
        }
      }
      return;
    }
    // Automatic pop-up removed - user must click button to view staffing reminders
  }, [
    staffingReminderQuery.isSuccess,
    outstandingJobs,
    lastAcknowledgedHash,
    showStaffingReminder,
  ]);

  const handleDismissReminder = React.useCallback(() => {
    if (outstandingHash) {
      setLastAcknowledgedHash(outstandingHash);
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(OUTSTANDING_STORAGE_KEY, outstandingHash);
        } catch (error) {
          console.warn('Failed to persist outstanding hash to storage', error);
        }
      }
    }
    setShowStaffingReminder(false);
  }, [outstandingHash]);

  const handleReminderOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        if (outstandingJobs.length) {
          handleDismissReminder();
        } else {
          setShowStaffingReminder(false);
        }
      } else {
        setShowStaffingReminder(true);
      }
    },
    [handleDismissReminder, outstandingJobs.length]
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);

    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.scope('optimized-matrix-technicians') }),
      qc.invalidateQueries({ queryKey: queryKeys.scope('technician-fridge-status') }),
    ]);

    // Dispatch the assignment update event to force refresh
    window.dispatchEvent(new CustomEvent('assignment-updated'));

    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Active filters count for mobile badge
  const activeFilterCount = React.useMemo(() => {
    let c = 0;
    if (selectedDepartment !== defaultDepartment) c++;
    if (debouncedSearch) c++;
    if (selectedSkills.length) c += selectedSkills.length;
    if (hideFridge) c++;
    if (allowDirectAssign) c++;
    if (hideStaffingEmailButtons) c++;
    if (hideStaffingWhatsappButtons) c++;
    return c;
  }, [
    selectedDepartment,
    defaultDepartment,
    debouncedSearch,
    selectedSkills,
    hideFridge,
    allowDirectAssign,
    hideStaffingEmailButtons,
    hideStaffingWhatsappButtons,
  ]);

  const outstandingJobsCount = staffingReminderQuery.isSuccess ? outstandingJobs.length : null;
  const outstandingJobsDescription =
    outstandingJobsCount === null
      ? 'Cargando información de dotaciones pendientes'
      : outstandingJobsCount === 0
        ? 'Sin trabajos pendientes'
        : `${outstandingJobsCount} trabajo${outstandingJobsCount === 1 ? '' : 's'} pendiente${outstandingJobsCount === 1 ? '' : 's'}`;

  return (
    <div className="h-dvh flex flex-col bg-background">
      <MatrixPageControls
        selectedDepartment={selectedDepartment}
        defaultDepartment={defaultDepartment}
        handleDepartmentChange={handleDepartmentChange}
        resetDepartmentToDefault={resetDepartmentToDefault}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedSkills={selectedSkills}
        setSelectedSkills={setSelectedSkills}
        specialtyOptions={specialtyOptions}
        toggleSpecialty={toggleSpecialty}
        hideFridge={hideFridge}
        setHideFridge={setHideFridge}
        fridgeCount={fridgeCount}
        allowDirectAssign={allowDirectAssign}
        setAllowDirectAssign={setAllowDirectAssign}
        allowMarkUnavailable={allowMarkUnavailable}
        setAllowMarkUnavailable={setAllowMarkUnavailable}
        canMarkUnavailable={canMarkUnavailable}
        hideStaffingEmailButtons={hideStaffingEmailButtons}
        setHideStaffingEmailButtons={setHideStaffingEmailButtons}
        hideStaffingWhatsappButtons={hideStaffingWhatsappButtons}
        setHideStaffingWhatsappButtons={setHideStaffingWhatsappButtons}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        activeFilterCount={activeFilterCount}
        isRefreshing={isRefreshing}
        handleRefresh={handleRefresh}
        isBackgroundFetchingMatrix={isBackgroundFetchingMatrix}
        filteredTechnicianCount={filteredTechnicians.length}
        jobsCount={yearJobs.length}
        canExpandBefore={canExpandBefore}
        canExpandAfter={canExpandAfter}
        expandBefore={expandBefore}
        expandAfter={expandAfter}
        resetRange={resetRange}
        jumpToMonth={jumpToMonth}
        rangeInfo={rangeInfo}
        setShowStaffingReminder={setShowStaffingReminder}
        handleReminderOpenChange={handleReminderOpenChange}
        outstandingJobsCount={outstandingJobsCount}
        outstandingJobsDescription={outstandingJobsDescription}
      />

      {/* Matrix Content */}
      <div className="flex-1 overflow-hidden">
        {isInitialMatrixLoad ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-muted-foreground">Cargando la matriz de asignaciones...</p>
            </div>
          </div>
        ) : (
          <OptimizedAssignmentMatrix
            technicians={filteredTechnicians}
            dates={dateRange}
            jobs={yearJobs}
            fridgeSet={fridgeSet}
            allowDirectAssign={allowDirectAssign}
            allowMarkUnavailable={allowMarkUnavailable}
            hideStaffingEmailButtons={hideStaffingEmailButtons}
            hideStaffingWhatsappButtons={hideStaffingWhatsappButtons}
            staffingDepartment={selectedDepartment}
            mobile={isMobile}
            cellWidth={isMobile ? 140 : undefined}
            cellHeight={isMobile ? 80 : undefined}
            technicianWidth={isMobile ? 110 : undefined}
            headerHeight={isMobile ? 50 : undefined}
            onNearEdgeScroll={(direction) => {
              if (direction === 'before' && canExpandBefore) {
                expandBefore();
              } else if (direction === 'after' && canExpandAfter) {
                expandAfter();
              }
            }}
            canExpandBefore={canExpandBefore}
            canExpandAfter={canExpandAfter}
          />
        )}
      </div>

      <StaffingReminderDialogs
        showStaffingReminder={showStaffingReminder}
        handleReminderOpenChange={handleReminderOpenChange}
        outstandingJobs={outstandingJobs}
        handleDismissReminder={handleDismissReminder}
        staffingOrchestratorTarget={staffingOrchestratorTarget}
        setStaffingOrchestratorTarget={setStaffingOrchestratorTarget}
        setShowStaffingReminder={setShowStaffingReminder}
      />
    </div >
  );
}
