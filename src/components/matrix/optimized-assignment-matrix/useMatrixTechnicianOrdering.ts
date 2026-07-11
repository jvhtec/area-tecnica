import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";

import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { MatrixTimesheetAssignment } from "@/hooks/useOptimizedMatrixData";
import type { OptimizedAssignmentMatrixExtendedProps, TechSortMethod } from "@/components/matrix/optimized-assignment-matrix/types";
import type { TechWorkloadSummary } from "@/components/matrix/lenses/workload";

type MatrixTechnician = OptimizedAssignmentMatrixExtendedProps["technicians"][number];

type SortJobStatusRow = {
  profile_id: string;
  availability_status: string | null;
  offer_status: string | null;
};

type TechResidenciaRow = {
  id: string;
  residencia: string | null;
};

type TimesheetCountRow = {
  technician_id: string;
  timesheet_count: number | null;
  department: string | null;
};

type TimesheetCountMaps = {
  counts: Map<string, number>;
  departments: Map<string, string>;
};

const MADRID_TIMEZONE = "Europe/Madrid";
const EMPTY_COUNT_MAPS = { counts: new Map<string, number>(), departments: new Map<string, string>() };

const fetchTimesheetCountMaps = async (year: number): Promise<TimesheetCountMaps> => {
  const yearStart = formatInTimeZone(new Date(Date.UTC(year, 0, 1)), MADRID_TIMEZONE, "yyyy-MM-dd");
  const yearEnd = formatInTimeZone(new Date(Date.UTC(year, 11, 31)), MADRID_TIMEZONE, "yyyy-MM-dd");

  const { data: countRows, error: timesheetError } = await dataLayerClient.rpc("get_active_timesheet_counts_by_technician", {
    p_start_date: yearStart,
    p_end_date: yearEnd,
  });

  if (timesheetError) {
    console.warn("Failed to fetch timesheet counts", timesheetError);
    return EMPTY_COUNT_MAPS;
  }

  const countMap = new Map<string, number>();
  const departmentMap = new Map<string, string>();
  ((countRows || []) as TimesheetCountRow[]).forEach((row) => {
    countMap.set(row.technician_id, Number(row.timesheet_count || 0));
    if (row.department) {
      departmentMap.set(row.technician_id, row.department);
    }
  });

  return { counts: countMap, departments: departmentMap };
};

const buildMedalRankings = (
  countMaps: TimesheetCountMaps | undefined,
  techSortMethod: TechSortMethod,
  sortJobId: string | null,
) => {
  const rankings = new Map<string, "gold" | "silver" | "bronze">();

  if (!countMaps?.counts || !countMaps?.departments || techSortMethod !== "default" || sortJobId) {
    return rankings;
  }

  const techsByDepartment = new Map<string, Array<{ id: string; count: number }>>();

  Array.from(countMaps.counts.entries()).forEach(([id, count]) => {
    const department = countMaps.departments.get(id);
    if (!department) return;

    if (!techsByDepartment.has(department)) {
      techsByDepartment.set(department, []);
    }
    techsByDepartment.get(department)!.push({ id, count });
  });

  techsByDepartment.forEach((techs) => {
    techs.sort((a, b) => b.count - a.count);

    let medalIndex = 0;
    let i = 0;

    while (i < techs.length && medalIndex < 3) {
      const currentCount = techs[i].count;
      if (currentCount === 0) break;

      const medal = medalIndex === 0 ? "gold" : medalIndex === 1 ? "silver" : "bronze";

      let tiedCount = 0;
      while (i + tiedCount < techs.length && techs[i + tiedCount].count === currentCount) {
        rankings.set(techs[i + tiedCount].id, medal);
        tiedCount++;
      }

      medalIndex += tiedCount;
      i += tiedCount;
    }
  });

  return rankings;
};

type UseMatrixTechnicianOrderingArgs = {
  technicians: MatrixTechnician[];
  allAssignments: MatrixTimesheetAssignment[];
  mobile: boolean;
  workloadByTech?: Map<string, TechWorkloadSummary>;
};

export const useMatrixTechnicianOrdering = ({
  technicians,
  allAssignments,
  mobile,
  workloadByTech,
}: UseMatrixTechnicianOrderingArgs) => {
  const [sortJobId, setSortJobId] = useState<string | null>(null);
  const [techSortMethod, setTechSortMethod] = useState<TechSortMethod>("default");
  const allTechIds = useMemo(() => technicians.map((t) => t.id), [technicians]);

  const { data: sortJobStatuses } = useQuery({
    queryKey: queryKeys.scope("matrix-sort-job-statuses", sortJobId, allTechIds.join(",")),
    queryFn: async () => {
      if (!sortJobId || !allTechIds.length) return new Map<string, { availability_status: string | null; offer_status: string | null }>();
      const chunk = <T,>(arr: T[], size: number) => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const batches = chunk(allTechIds, 30);
      const map = new Map<string, { availability_status: string | null; offer_status: string | null }>();
      for (const b of batches) {
        const { data, error } = await dataLayerClient.rpc("get_assignment_matrix_staffing_filtered", {
          p_job_ids: [sortJobId],
          p_profile_ids: b,
        });
        if (error) {
          console.warn("Sort job statuses RPC error", error);
          continue;
        }
        ((data || []) as SortJobStatusRow[]).forEach((r) => {
          const av = r.availability_status === "pending" ? "requested" : (r.availability_status === "expired" ? null : r.availability_status);
          const of = r.offer_status === "pending" ? "sent" : (r.offer_status === "expired" ? null : r.offer_status);
          map.set(r.profile_id, { availability_status: av, offer_status: of });
        });
      }
      return map;
    },
    enabled: !!sortJobId,
    staleTime: 2_000,
    gcTime: 60_000,
  });

  const { data: techResidencias } = useQuery({
    queryKey: queryKeys.scope("tech-residencias", allTechIds.join(",")),
    queryFn: async () => {
      if (!allTechIds.length) return new Map<string, string | null>();
      const { data, error } = await dataLayerClient.from("profiles")
        .select("id, residencia")
        .in("id", allTechIds);
      if (error) {
        console.warn("Failed to fetch residencias", error);
        return new Map<string, string | null>();
      }
      const map = new Map<string, string | null>();
      ((data || []) as TechResidenciaRow[]).forEach((r) => {
        map.set(r.id, r.residencia);
      });
      return map;
    },
    enabled: allTechIds.length > 0 && techSortMethod === "location",
    staleTime: 60_000,
    gcTime: 300_000,
  });

  const currentYear = Number(formatInTimeZone(new Date(), MADRID_TIMEZONE, "yyyy"));
  const { data: techConfirmedCounts } = useQuery({
    queryKey: queryKeys.scope("tech-confirmed-counts-all-with-dept", currentYear),
    queryFn: () => fetchTimesheetCountMaps(currentYear),
    enabled: true,
    staleTime: 60_000,
    gcTime: 300_000,
  });

  const { data: techLastYearCounts } = useQuery({
    queryKey: queryKeys.scope("tech-last-year-counts-all-with-dept", currentYear - 1),
    queryFn: () => fetchTimesheetCountMaps(currentYear - 1),
    enabled: true,
    staleTime: 60_000,
    gcTime: 300_000,
  });

  const orderedTechnicians = useMemo(() => {
    const techs = [...technicians];

    if (sortJobId) {
      const baseOrder = new Map<string, number>();
      technicians.forEach((t, i) => baseOrder.set(t.id, i));
      const scoreMap = new Map<string, number>();
      allAssignments?.forEach((a) => {
        if (a.job_id !== sortJobId) return;
        const cur = scoreMap.get(a.technician_id) || 0;
        const status = (a.status || "").toLowerCase();
        const add = status === "confirmed" ? 3 : (status === "invited" ? 1 : 0);
        scoreMap.set(a.technician_id, Math.max(cur, add));
      });
      if (sortJobStatuses && sortJobStatuses.size) {
        technicians.forEach((t) => {
          const s = sortJobStatuses.get(t.id);
          if (!s) return;
          const cur = scoreMap.get(t.id) || 0;
          let add = 0;
          if (s.offer_status === "confirmed") add = Math.max(add, 2);
          else if (s.offer_status === "sent") add = Math.max(add, 1.5);
          if (s.availability_status === "confirmed") add = Math.max(add, 1.2);
          else if (s.availability_status === "requested") add = Math.max(add, 1);
          if (add > 0) scoreMap.set(t.id, Math.max(cur, add));
        });
      }
      techs.sort((a, b) => {
        const sa = scoreMap.get(a.id) || 0;
        const sb = scoreMap.get(b.id) || 0;
        if (sb !== sa) return sb - sa;
        return (baseOrder.get(a.id)! - baseOrder.get(b.id)!);
      });
      return techs;
    }

    switch (techSortMethod) {
      case "location":
        techs.sort((a, b) => {
          const resA = techResidencias?.get(a.id) || "";
          const resB = techResidencias?.get(b.id) || "";

          if (resA && !resB) return -1;
          if (!resA && resB) return 1;
          if (!resA && !resB) return a.first_name.localeCompare(b.first_name);

          const parseLocation = (loc: string) => {
            const parts = loc.split(",").map((p) => p.trim());
            if (parts.length > 1) {
              return { city: parts[0], country: parts[1] };
            }
            return { city: parts[0], country: "España" };
          };

          const locA = parseLocation(resA);
          const locB = parseLocation(resB);
          const isSpainA = locA.country === "España" || locA.country === "Spain";
          const isSpainB = locB.country === "España" || locB.country === "Spain";

          if (isSpainA && !isSpainB) return -1;
          if (!isSpainA && isSpainB) return 1;
          if (!isSpainA && !isSpainB) {
            const countryCompare = locA.country.localeCompare(locB.country, "es");
            if (countryCompare !== 0) return countryCompare;
          }

          const cityCompare = locA.city.localeCompare(locB.city, "es");
          if (cityCompare !== 0) return cityCompare;
          return a.first_name.localeCompare(b.first_name);
        });
        break;
      case "name-asc":
        techs.sort((a, b) => a.first_name.localeCompare(b.first_name));
        break;
      case "name-desc":
        techs.sort((a, b) => b.first_name.localeCompare(a.first_name));
        break;
      case "surname-asc":
        techs.sort((a, b) => a.last_name.localeCompare(b.last_name));
        break;
      case "surname-desc":
        techs.sort((a, b) => b.last_name.localeCompare(a.last_name));
        break;
      case "workload-desc":
        techs.sort((a, b) => {
          const streakA = workloadByTech?.get(a.id)?.streakEndingToday ?? 0;
          const streakB = workloadByTech?.get(b.id)?.streakEndingToday ?? 0;
          if (streakB !== streakA) return streakB - streakA;
          return a.first_name.localeCompare(b.first_name);
        });
        break;
      case "default":
      default:
        techs.sort((a, b) => {
          const aIsHouse = a.role === "house_tech";
          const bIsHouse = b.role === "house_tech";
          if (aIsHouse && !bIsHouse) return -1;
          if (!aIsHouse && bIsHouse) return 1;

          if (!aIsHouse && !bIsHouse && techConfirmedCounts?.counts) {
            const aCount = techConfirmedCounts.counts.get(a.id) || 0;
            const bCount = techConfirmedCounts.counts.get(b.id) || 0;
            if (bCount !== aCount) return bCount - aCount;
          }

          return 0;
        });
        break;
    }

    return techs;
  }, [technicians, sortJobId, techSortMethod, techResidencias, allAssignments, sortJobStatuses, techConfirmedCounts, workloadByTech]);

  const techMedalRankings = useMemo(
    () => buildMedalRankings(techConfirmedCounts, techSortMethod, sortJobId),
    [techConfirmedCounts, techSortMethod, sortJobId],
  );

  const techLastYearMedalRankings = useMemo(
    () => buildMedalRankings(techLastYearCounts, techSortMethod, sortJobId),
    [techLastYearCounts, techSortMethod, sortJobId],
  );

  const cycleTechSort = useCallback(() => {
    const methods: TechSortMethod[] = workloadByTech && workloadByTech.size > 0
      ? ["default", "location", "name-asc", "name-desc", "surname-asc", "surname-desc", "workload-desc"]
      : ["default", "location", "name-asc", "name-desc", "surname-asc", "surname-desc"];
    const currentIndex = methods.indexOf(techSortMethod);
    const nextIndex = (currentIndex + 1) % methods.length;
    setTechSortMethod(methods[nextIndex]);
    if (sortJobId) {
      setSortJobId(null);
    }
  }, [techSortMethod, sortJobId, workloadByTech]);

  const getSortLabel = useCallback(() => {
    switch (techSortMethod) {
      case "location": return mobile ? "📍 Ubic." : "📍 Ubicación";
      case "name-asc": return mobile ? "A→Z" : "A→Z Nombre";
      case "name-desc": return mobile ? "Z→A" : "Z→A Nombre";
      case "surname-asc": return mobile ? "A→Z Ape." : "A→Z Apellido";
      case "surname-desc": return mobile ? "Z→A Ape." : "Z→A Apellido";
      case "workload-desc": return mobile ? "↯ Carga" : "↯ Más carga primero";
      case "default": return "";
      default: return "";
    }
  }, [techSortMethod, mobile]);

  return {
    orderedTechnicians,
    setSortJobId,
    techMedalRankings,
    techLastYearMedalRankings,
    cycleTechSort,
    getSortLabel,
  };
};
