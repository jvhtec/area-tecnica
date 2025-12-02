
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, Users, RefreshCw, Refrigerator } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { OptimizedAssignmentMatrix } from '@/components/matrix/OptimizedAssignmentMatrix';

import { DateRangeExpander } from '@/components/matrix/DateRangeExpander';
import { useVirtualizedDateRange } from '@/hooks/useVirtualizedDateRange';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SkillsFilter } from '@/components/matrix/SkillsFilter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { format } from 'date-fns';

type MatrixJob = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  status: string;
  job_type: string;
  _assigned_count?: number;
};

async function fetchJobsForWindow(start: Date, end: Date, department: string) {
  let query = supabase
    .from('jobs')
    .select(`
      id, title, start_time, end_time, color, status, job_type,
      job_departments!inner(department),
      job_assignments!job_id(technician_id)
    `)
    .lte('start_time', end.toISOString())
    .gte('end_time', start.toISOString())
    .in('job_type', ['single', 'festival', 'tourdate', 'evento'])
    .limit(500);

  if (department) {
    query = query.eq('job_departments.department', department);
  }

  const { data, error } = await query.order('start_time', { ascending: true });

  if (error) throw error;

  return (data || [])
    .map((j: any) => {
      const assigns = Array.isArray(j.job_assignments) ? j.job_assignments : [];
      return {
        id: j.id,
        title: j.title,
        start_time: j.start_time,
        end_time: j.end_time,
        color: j.color,
        status: j.status,
        job_type: j.job_type,
        _assigned_count: assigns.length as number,
      } as MatrixJob;
    })
    .filter((j) => j.status !== 'Cancelado' || (j._assigned_count ?? 0) > 0);
}

async function fetchAssignmentsForWindow(jobIds: string[], technicianIds: string[], jobs: MatrixJob[]) {
  if (!jobIds.length || !technicianIds.length) return [];

  const jobsById = new Map<string, MatrixJob>();
  jobs.forEach((job) => {
    if (job?.id) jobsById.set(job.id, job);
  });

  const batchSize = 25;
  const promises: any[] = [];

  for (let i = 0; i < jobIds.length; i += batchSize) {
    const jobBatch = jobIds.slice(i, i + batchSize);
    promises.push(
      supabase
        .from('job_assignments')
        .select(`
          job_id,
          technician_id,
          sound_role,
          lights_role,
          video_role,
          single_day,
          assignment_date,
          status,
          assigned_at,
          jobs!job_id (
            id,
            title,
            start_time,
            end_time,
            color
          )
        `)
        .in('job_id', jobBatch)
        .in('technician_id', technicianIds)
        .limit(500)
    );
  }

  const results = await Promise.all(promises);
  const allData = results.flatMap((result: any) => {
    if (result.error) {
      console.error('Assignment prefetch error:', result.error);
      return [];
    }
    return result.data || [];
  });

  return allData
    .map((item: any) => ({
      job_id: item.job_id,
      technician_id: item.technician_id,
      sound_role: item.sound_role,
      lights_role: item.lights_role,
      video_role: item.video_role,
      single_day: item.single_day,
      assignment_date: item.assignment_date,
      status: item.status,
      assigned_at: item.assigned_at,
      job: jobsById.get(item.job_id) || (Array.isArray(item.jobs) ? item.jobs[0] : item.jobs),
    }))
    .filter((item) => !!item.job);
}

async function fetchAvailabilityForWindow(technicianIds: string[], start: Date, end: Date) {
  if (!technicianIds.length) return [] as Array<{ user_id: string; date: string; status: string; notes?: string }>;

  const techBatches: string[][] = [];
  const batchSize = 100;
  for (let i = 0; i < technicianIds.length; i += batchSize) {
    techBatches.push(technicianIds.slice(i, i + batchSize));
  }

  const perDay = new Map<string, { user_id: string; date: string; status: string; notes?: string }>();
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  for (const batch of techBatches) {
    const { data: schedRows, error: schedErr } = await supabase
      .from('availability_schedules')
      .select('user_id, date, status, notes, source')
      .in('user_id', batch)
      .gte('date', format(start, 'yyyy-MM-dd'))
      .lte('date', format(end, 'yyyy-MM-dd'))
      .or('status.eq.unavailable,source.eq.vacation');
    if (schedErr) throw schedErr;
    (schedRows || []).forEach((row: any) => {
      const key = `${row.user_id}-${row.date}`;
      if (!perDay.has(key)) {
        perDay.set(key, { user_id: row.user_id, date: row.date, status: 'unavailable', notes: row.notes || undefined });
      } else if (row.notes) {
        const current = perDay.get(key)!;
        if (!current.notes) {
          perDay.set(key, { ...current, notes: row.notes });
        }
      }
    });
  }

  try {
    const { data: legacyRows, error: legacyErr } = await supabase
      .from('technician_availability')
      .select('technician_id, date, status')
      .in('technician_id', technicianIds)
      .gte('date', format(start, 'yyyy-MM-dd'))
      .lte('date', format(end, 'yyyy-MM-dd'))
      .in('status', ['vacation', 'travel', 'sick', 'day_off']);
    if (legacyErr) {
      if (legacyErr.code !== '42P01') throw legacyErr;
    }
    (legacyRows || []).forEach((row: any) => {
      const key = `${row.technician_id}-${row.date}`;
      if (!perDay.has(key)) {
        perDay.set(key, { user_id: row.technician_id, date: row.date, status: 'unavailable' });
      }
    });
  } catch (error: any) {
    if (error?.code && error.code !== '42P01') throw error;
  }

  try {
    const vacBatchSize = 100;
    const vacBatches: string[][] = [];
    for (let i = 0; i < technicianIds.length; i += vacBatchSize) {
      vacBatches.push(technicianIds.slice(i, i + vacBatchSize));
    }
    for (const batch of vacBatches) {
      const { data: vacs, error: vacErr } = await supabase
        .from('vacation_requests')
        .select('technician_id, start_date, end_date, status')
        .eq('status', 'approved')
        .in('technician_id', batch)
        .lte('start_date', format(end, 'yyyy-MM-dd'))
        .gte('end_date', format(start, 'yyyy-MM-dd'));
      if (vacErr) {
        if (vacErr.code !== '42P01') throw vacErr;
      }
      (vacs || []).forEach((vac: any) => {
        const s = new Date(vac.start_date);
        const e = new Date(vac.end_date);
        const clampStart = new Date(Math.max(startDay.getTime(), new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime()));
        const clampEnd = new Date(Math.min(endDay.getTime(), new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime()));
        for (let d = new Date(clampStart); d.getTime() <= clampEnd.getTime(); d.setDate(d.getDate() + 1)) {
          const key = `${vac.technician_id}-${format(d, 'yyyy-MM-dd')}`;
          if (!perDay.has(key)) {
            perDay.set(key, { user_id: vac.technician_id, date: format(d, 'yyyy-MM-dd'), status: 'unavailable' });
          }
        }
      });
    }
  } catch (error: any) {
    if (error?.code && error.code !== '42P01') throw error;
  }

  return Array.from(perDay.values());
}

const DEPARTMENT_LABELS: Record<string, string> = {
  sound: 'Sonido',
  lights: 'Luces',
  video: 'Video',
  production: 'Producción',
  rigging: 'Rigging',
  staging: 'Escenario',
  backline: 'Backline',
  power: 'Energía',
};

type StaffingSummaryRole = {
  role_code: string;
  quantity: number;
  notes?: string | null;
};

type StaffingSummaryRow = {
  job_id: string;
  department: string;
  roles: StaffingSummaryRole[];
};

type StaffingAssignmentRow = {
  job_id: string;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  production_role: string | null;
  status: string | null;
};

type OutstandingRoleInfo = {
  roleCode: string;
  required: number;
  assigned: number;
  outstanding: number;
};

type OutstandingDepartmentInfo = {
  department: string;
  displayName: string;
  outstandingTotal: number;
  roles: OutstandingRoleInfo[];
};

type OutstandingJobInfo = {
  jobId: string;
  jobTitle: string;
  outstandingTotal: number;
  departments: OutstandingDepartmentInfo[];
};

const AVAILABLE_DEPARTMENTS = ['sound', 'lights', 'video', 'production'] as const;
type Department = (typeof AVAILABLE_DEPARTMENTS)[number];
const FALLBACK_DEPARTMENT: Department = 'sound';
const OUTSTANDING_STORAGE_KEY = 'job-assignment-matrix:last-outstanding-hash';

function formatLabel(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseSummaryRow(row: any): StaffingSummaryRow | null {
  if (!row || !row.job_id || !row.department) return null;
  const rawRoles = Array.isArray(row.roles) ? row.roles : [];
  const roles = rawRoles
    .map((r: any) => ({
      role_code: typeof r?.role_code === 'string' ? r.role_code : String(r?.role_code ?? ''),
      quantity: Number(r?.quantity ?? 0),
      notes: (r?.notes ?? null) as string | null,
    }))
    .filter((r: StaffingSummaryRole) => r.role_code);
  return {
    job_id: row.job_id as string,
    department: row.department as string,
    roles,
  };
}

export default function JobAssignmentMatrix() {
  const qc = useQueryClient();
  const prefetchStatusRef = React.useRef<Map<string, 'pending' | 'done'>>(new Map<string, 'pending' | 'done'>());
  const { userDepartment } = useOptimizedAuth();
  const [defaultDepartment, setDefaultDepartment] = useState<Department>(FALLBACK_DEPARTMENT);
  const [selectedDepartment, setSelectedDepartment] = useState<Department>(FALLBACK_DEPARTMENT);
  const hasManualDepartmentSelection = React.useRef(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Debounce search to reduce filtering churn
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [searchTerm]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allowDirectAssign, setAllowDirectAssign] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [hideFridge, setHideFridge] = useState<boolean>(true);
  const [showStaffingReminder, setShowStaffingReminder] = useState(false);
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
    maxWeeksBefore: 26,      // Allow up to 6 months before
    maxWeeksAfter: 26,       // Allow up to 6 months after
    expandByWeeks: 4         // Expand by 4 weeks at a time
  });

  // Optimized technicians query
  const {
    data: technicians = [],
    isInitialLoading: isInitialLoadingTechnicians,
    isFetching: isFetchingTechnicians,
  } = useQuery<any[]>({
    queryKey: ['optimized-matrix-technicians', selectedDepartment],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_profiles_with_skills');

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

        if (tech.role === 'technician' || tech.role === 'house_tech') {
          return true;
        }
        if (tech.role === 'management') {
          return !!tech.assignable_as_tech;
        }
        return false;
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
    queryKey: ['technician-fridge-status', technicianIds],
    queryFn: async () => {
      if (!technicianIds.length) return [] as Array<{ technician_id: string; in_fridge: boolean }>;
      const { data, error } = await supabase
        .from('technician_fridge')
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
    const ch = (supabase as any)
      .channel('rt-technician-fridge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technician_fridge' }, () => {
        qc.invalidateQueries({ queryKey: ['technician-fridge-status'] });
      })
      .subscribe();
    return () => { try { (supabase as any).removeChannel(ch); } catch { } };
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
    queryKey: ['optimized-matrix-jobs', rangeInfo.startFormatted, rangeInfo.endFormatted, selectedDepartment],
    queryFn: async () => {
      const startDate = rangeInfo.start;
      const endDate = rangeInfo.end;

      // Use interval overlap logic to show all jobs that overlap with the visible date range
      // This ensures long-running jobs (e.g., multi-month tours) are visible even if they
      // extend beyond the current range. A job overlaps if:
      // - Job starts before range ends AND
      // - Job ends after range starts
      let query = supabase
        .from('jobs')
        .select(`
          id, title, start_time, end_time, color, status, job_type,
          job_departments!inner(department),
          job_assignments!job_id(technician_id)
        `)
        .lte('start_time', endDate.toISOString())    // Job starts before range ends
        .gte('end_time', startDate.toISOString())    // Job ends after range starts
        .in('job_type', ['single', 'festival', 'tourdate', 'evento'])
        .limit(500); // Limit for performance

      // Add department filter if selected
      query = query.eq('job_departments.department', selectedDepartment);

      const { data, error } = await query.order('start_time', { ascending: true });

      if (error) throw error;

      // Filter out cancelled jobs unless they have assigned technicians
      const filtered = (data || []).map((j: any) => {
        const assigns = Array.isArray(j.job_assignments) ? j.job_assignments : [];
        return {
          id: j.id,
          title: j.title,
          start_time: j.start_time,
          end_time: j.end_time,
          color: j.color,
          status: j.status,
          job_type: j.job_type,
          // keep for downstream UI warnings
          _assigned_count: assigns.length as number,
        };
      }).filter((j: any) => j.status !== 'Cancelado' || j._assigned_count > 0);

      return filtered;
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
          queryKey: ['optimized-matrix-assignments', jobIds, technicianIds, format(start, 'yyyy-MM-dd')],
          queryFn: () => fetchAssignmentsForWindow(jobIds, technicianIds, jobsForWindow),
          staleTime: 30 * 1000,
          gcTime: 2 * 60 * 1000,
        });
      }

      if (!cancelled && technicianIds.length) {
        await qc.prefetchQuery({
          queryKey: ['optimized-matrix-availability', technicianIds, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
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
    queryKey: ['matrix-staffing-summary', jobIdsKey],
    queryFn: async () => {
      if (!jobIds.length) {
        return { summaries: [] as StaffingSummaryRow[], assignments: [] as StaffingAssignmentRow[] };
      }

      const [summaryRes, assignmentsRes] = await Promise.all([
        supabase
          .from('job_required_roles_summary')
          .select('job_id, department, roles')
          .in('job_id', jobIds),
        supabase
          .from('job_assignments')
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

    // Dispatch the assignment update event to force refresh
    window.dispatchEvent(new CustomEvent('assignment-updated'));

    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Responsive breakpoint detection
  React.useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Active filters count for mobile badge
  const activeFilterCount = React.useMemo(() => {
    let c = 0;
    if (selectedDepartment !== defaultDepartment) c++;
    if (debouncedSearch) c++;
    if (selectedSkills.length) c += selectedSkills.length;
    if (hideFridge) c++;
    if (allowDirectAssign) c++;
    return c;
  }, [selectedDepartment, defaultDepartment, debouncedSearch, selectedSkills, hideFridge, allowDirectAssign]);

  const outstandingJobsCount = staffingReminderQuery.isSuccess ? outstandingJobs.length : null;
  const outstandingJobsDescription =
    outstandingJobsCount === null
      ? 'Cargando información de dotaciones pendientes'
      : outstandingJobsCount === 0
        ? 'Sin trabajos pendientes'
        : `${outstandingJobsCount} trabajo${outstandingJobsCount === 1 ? '' : 's'} pendiente${outstandingJobsCount === 1 ? '' : 's'}`;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-card p-2 md:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 md:h-6 md:w-6" />
            <h1 className="text-lg md:text-2xl font-bold">Matriz de asignación de trabajos</h1>
          </div>
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowStaffingReminder(true);
                handleReminderOpenChange(true);
              }}
              className="shrink-0 flex items-center gap-2"
              aria-label={`Ver recordatorio de staffing. ${outstandingJobsDescription}.`}
            >
              Ver recordatorio de staffing
              {outstandingJobsCount !== null && (
                <Badge variant="outline" className="text-xs" aria-hidden="true">
                  {outstandingJobsCount}
                </Badge>
              )}
              <span className="sr-only">{outstandingJobsDescription}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refrescar</span>
            </Button>
          </div>
        </div>

        {/* Date Range Controls - hidden on mobile (use in-header arrows instead) */}
        <div className="hidden md:block">
          <DateRangeExpander
            canExpandBefore={canExpandBefore}
            canExpandAfter={canExpandAfter}
            onExpandBefore={expandBefore}
            onExpandAfter={expandAfter}
            onReset={resetRange}
            onJumpToMonth={jumpToMonth}
            rangeInfo={rangeInfo}
          />
        </div>

        {/* Filters */}
        <div className="hidden md:flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filtros:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Tabs
              value={selectedDepartment}
              onValueChange={(value) => handleDepartmentChange(value as Department)}
              className="w-full sm:w-auto"
            >
              <TabsList className="flex w-full sm:w-auto overflow-x-auto rounded-md bg-muted p-1 gap-1">
                {AVAILABLE_DEPARTMENTS.map((dept) => (
                  <TabsTrigger
                    key={dept}
                    value={dept}
                    className="flex-1 whitespace-nowrap capitalize sm:flex-none"
                  >
                    {DEPARTMENT_LABELS[dept] || formatLabel(dept)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Input
              placeholder="Buscar técnicos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 min-w-0 flex-1 sm:flex-none"
            />

            <SkillsFilter selected={selectedSkills} onChange={setSelectedSkills} department={selectedDepartment} />
            {/* Quick specialties */}
            {specialtyOptions.length > 0 && (
              <div className="flex items-center gap-1">
                {specialtyOptions.map((opt) => (
                  <Badge
                    key={opt}
                    variant={selectedSkills.includes(opt) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => toggleSpecialty(opt)}
                  >
                    {opt}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <div className="flex items-center gap-2 pr-2 border-r">
              <Refrigerator className="h-4 w-4" />
              <span className="text-sm font-medium">{hideFridge ? 'Abrir la nevera' : 'Cerrar la nevera'}</span>
              <Switch
                checked={hideFridge}
                onCheckedChange={(v) => setHideFridge(Boolean(v))}
                aria-label={hideFridge ? 'Abrir la nevera' : 'Cerrar la nevera'}
              />
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{fridgeCount}</Badge>
            </div>
            <div className="flex items-center gap-2 pr-2 border-r">
              <span className="text-sm font-medium">Asignación directa</span>
              <Switch
                checked={allowDirectAssign}
                onCheckedChange={(v) => setAllowDirectAssign(Boolean(v))}
                aria-label="Alternar asignación directa"
              />
            </div>
            <Users className="h-4 w-4" />
            <Badge variant="secondary" className="text-xs">
              {filteredTechnicians.length} técnicos
            </Badge>
            <Badge variant="outline" className="text-xs">
              {yearJobs.length} trabajos
            </Badge>
            {isBackgroundFetchingMatrix && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Actualizando...
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Mobile quick controls + filter toggle */}
      <div className="md:hidden mt-2">
        <div className="flex items-center justify-between gap-2">
          <button
            className="text-sm font-medium px-3 py-2 border rounded-md bg-background"
            onClick={() => setFiltersOpen(v => !v)}
            aria-expanded={filtersOpen}
            aria-controls="mobile-filters"
          >
            Filtros {activeFilterCount > 0 && <span className="ml-2 inline-flex items-center justify-center text-[10px] h-5 min-w-[20px] px-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">{activeFilterCount}</span>}
          </button>
          {/* Quick direct assign toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs">Directa</span>
            <Switch
              checked={allowDirectAssign}
              onCheckedChange={(v) => setAllowDirectAssign(Boolean(v))}
              aria-label="Alternar asignación directa"
            />
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <Badge variant="secondary" className="text-xs">
              {filteredTechnicians.length} técnicos
            </Badge>
            <Badge variant="outline" className="text-xs">
              {yearJobs.length} trabajos
            </Badge>
            {isBackgroundFetchingMatrix && (
              <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Actualizando...
              </Badge>
            )}
          </div>
        </div>
        {filtersOpen && (
          <div id="mobile-filters" className="mt-2 max-h-[300px] overflow-y-auto p-2 border rounded-md bg-muted/30 space-y-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filtros</span>
              {activeFilterCount > 0 && (
                <button
                  className="ml-auto text-xs underline"
                  onClick={() => {
                    resetDepartmentToDefault();
                    setSearchTerm('');
                    setSelectedSkills([]);
                    setHideFridge(false);
                    setAllowDirectAssign(false);
                  }}
                >
                  Limpiar
                </button>
              )}
            </div>
            <Tabs
              value={selectedDepartment}
              onValueChange={(value) => handleDepartmentChange(value as Department)}
              className="w-full"
            >
              <TabsList className="flex w-full overflow-x-auto rounded-md bg-muted p-1 gap-1">
                {AVAILABLE_DEPARTMENTS.map((dept) => (
                  <TabsTrigger
                    key={dept}
                    value={dept}
                    className="flex-1 whitespace-nowrap capitalize"
                  >
                    {DEPARTMENT_LABELS[dept] || formatLabel(dept)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Input
              placeholder="Buscar técnicos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <SkillsFilter selected={selectedSkills} onChange={setSelectedSkills} department={selectedDepartment} />
            {specialtyOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {specialtyOptions.map((opt) => (
                  <Badge
                    key={opt}
                    variant={selectedSkills.includes(opt) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => toggleSpecialty(opt)}
                  >
                    {opt}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Refrigerator className="h-4 w-4" />
                <span className="text-sm font-medium">{hideFridge ? 'Abrir la nevera' : 'Cerrar la nevera'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={hideFridge} onCheckedChange={(v) => setHideFridge(Boolean(v))} aria-label={hideFridge ? 'Abrir la nevera' : 'Cerrar la nevera'} />
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{fridgeCount}</Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Asignación directa</span>
              <Switch checked={allowDirectAssign} onCheckedChange={(v) => setAllowDirectAssign(Boolean(v))} aria-label="Alternar asignación directa" />
            </div>
          </div>
        )}
      </div>


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

      <Dialog open={showStaffingReminder} onOpenChange={handleReminderOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Hay {outstandingJobs.length} trabajos con personal por completar
            </DialogTitle>
            <DialogDescription>
              Revisa los roles pendientes para completar la dotación de cada equipo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {outstandingJobs.map((job) => (
              <div key={job.jobId} className="rounded-md border p-3">
                <div className="text-sm font-semibold">{job.jobTitle}</div>
                <div className="mt-2 space-y-2">
                  {job.departments.map((dept) => (
                    <div key={`${job.jobId}-${dept.department}`}>
                      <div className="text-sm font-medium">{dept.displayName}</div>
                      <ul className="ml-4 mt-1 list-disc space-y-1 text-sm text-muted-foreground">
                        {dept.roles.map((role) => (
                          <li key={`${job.jobId}-${dept.department}-${role.roleCode}`}>
                            {role.outstanding} × {formatLabel(role.roleCode)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleDismissReminder} variant="default">
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
