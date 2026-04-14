import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfYear, startOfYear, subYears } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

import { supabase } from "@/integrations/supabase/client";
import {
  chunkArray,
  MATRIX_DATE_KEY_FORMAT,
  MATRIX_TIMEZONE,
  matrixQueryKeys,
} from "@/components/matrix/optimized-assignment-matrix/matrixCore";
import type {
  MatrixStaffingByJobStatus,
  MatrixTechnician,
  MatrixTimesheetAssignment,
  MatrixSortingState,
  TechSortMethod,
} from "@/components/matrix/optimized-assignment-matrix/types";

interface TechCountData {
  counts: Map<string, number>;
  departments: Map<string, string>;
}

interface UseMatrixSortingControllerArgs {
  technicians: MatrixTechnician[];
  allAssignments: MatrixTimesheetAssignment[];
  mobile: boolean;
  isManagementUser: boolean;
}

const EMPTY_STATUS_MAP = new Map<string, MatrixStaffingByJobStatus>();
const EMPTY_STRING_MAP = new Map<string, string | null>();
const EMPTY_COUNTS: TechCountData = {
  counts: new Map<string, number>(),
  departments: new Map<string, string>(),
};
const MAX_PARALLEL_CHUNKS = 6;

export function useMatrixSortingController({
  technicians,
  allAssignments,
  mobile,
  isManagementUser,
}: UseMatrixSortingControllerArgs): MatrixSortingState & { orderedTechnicians: MatrixTechnician[] } {
  const [sortJobId, setSortJobId] = useState<string | null>(null);
  const [techSortMethod, setTechSortMethod] = useState<TechSortMethod>("default");
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const technicianIds = useMemo(() => technicians.map((technician) => technician.id), [technicians]);

  const { data: sortJobStatuses = EMPTY_STATUS_MAP } = useQuery({
    queryKey: matrixQueryKeys.sortJobStatuses(sortJobId, technicianIds),
    queryFn: async () => {
      if (!sortJobId || !technicianIds.length) return EMPTY_STATUS_MAP;

      const map = new Map<string, MatrixStaffingByJobStatus>();
      const batches = chunkArray(technicianIds, 30);
      const errors: Array<{ profileIds: string[]; error: unknown }> = [];

      for (let index = 0; index < batches.length; index += MAX_PARALLEL_CHUNKS) {
        const batchGroup = batches.slice(index, index + MAX_PARALLEL_CHUNKS);
        const results = await Promise.all(
          batchGroup.map(async (batch) => {
            const { data, error } = await supabase
              .rpc("get_assignment_matrix_staffing")
              .eq("job_id", sortJobId)
              .in("profile_id", batch);

            return { batch, data, error };
          }),
        );

        results.forEach(({ batch, data, error }) => {
          if (error) {
            errors.push({ profileIds: batch, error });
            return;
          }

          (data || []).forEach((row: {
            profile_id: string;
            availability_status: string | null;
            offer_status: string | null;
          }) => {
            const availability =
              row.availability_status === "pending"
                ? "requested"
                : row.availability_status === "expired"
                  ? null
                  : row.availability_status;
            const offer =
              row.offer_status === "pending"
                ? "sent"
                : row.offer_status === "expired"
                  ? null
                  : row.offer_status;

            map.set(row.profile_id, {
              availability_status: availability as MatrixStaffingByJobStatus["availability_status"],
              offer_status: offer as MatrixStaffingByJobStatus["offer_status"],
            });
          });
        });
      }

      if (errors.length) {
        console.error("[matrix] Failed to load some sortJobStatuses batches", errors);
      }

      return map;
    },
    enabled: Boolean(sortJobId),
    staleTime: 2_000,
    gcTime: 60_000,
  });

  const { data: techResidencias = EMPTY_STRING_MAP } = useQuery({
    queryKey: matrixQueryKeys.techResidencias(technicianIds),
    queryFn: async () => {
      if (!technicianIds.length) return EMPTY_STRING_MAP;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, residencia")
        .in("id", technicianIds);

      if (error) return EMPTY_STRING_MAP;

      const map = new Map<string, string | null>();
      (data || []).forEach((row: { id: string; residencia?: string | null }) => {
        map.set(row.id, row.residencia ?? null);
      });
      return map;
    },
    enabled: technicianIds.length > 0 && techSortMethod === "location",
    staleTime: 60_000,
    gcTime: 300_000,
  });

  const { data: techConfirmedCounts = EMPTY_COUNTS } = useQuery({
    queryKey: matrixQueryKeys.techConfirmedCounts(),
    queryFn: async () => {
      const madridNow = toZonedTime(new Date(), MATRIX_TIMEZONE);
      const currentYearStart = formatInTimeZone(
        startOfYear(madridNow),
        MATRIX_TIMEZONE,
        MATRIX_DATE_KEY_FORMAT,
      );
      const { data: timesheets, error } = await supabase
        .from("timesheets")
        .select("technician_id")
        .eq("is_active", true)
        .gte("date", currentYearStart);

      if (error) return EMPTY_COUNTS;

      const counts = new Map<string, number>();
      (timesheets || []).forEach((timesheet: { technician_id: string }) => {
        counts.set(timesheet.technician_id, (counts.get(timesheet.technician_id) || 0) + 1);
      });

      if (!counts.size) return EMPTY_COUNTS;

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, department")
        .in("id", Array.from(counts.keys()));

      if (profileError) {
        return { counts, departments: new Map<string, string>() };
      }

      const departments = new Map<string, string>();
      (profiles || []).forEach((profile: { id: string; department?: string | null }) => {
        if (profile.department) {
          departments.set(profile.id, profile.department);
        }
      });

      return { counts, departments };
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });

  const { data: techLastYearCounts = EMPTY_COUNTS } = useQuery({
    queryKey: matrixQueryKeys.techLastYearCounts(),
    queryFn: async () => {
      const madridLastYear = toZonedTime(subYears(new Date(), 1), MATRIX_TIMEZONE);
      const yearStart = formatInTimeZone(
        startOfYear(madridLastYear),
        MATRIX_TIMEZONE,
        MATRIX_DATE_KEY_FORMAT,
      );
      const yearEnd = formatInTimeZone(
        endOfYear(madridLastYear),
        MATRIX_TIMEZONE,
        MATRIX_DATE_KEY_FORMAT,
      );

      const { data: timesheets, error } = await supabase
        .from("timesheets")
        .select("technician_id")
        .eq("is_active", true)
        .gte("date", yearStart)
        .lte("date", yearEnd);

      if (error) return EMPTY_COUNTS;

      const counts = new Map<string, number>();
      (timesheets || []).forEach((timesheet: { technician_id: string }) => {
        counts.set(timesheet.technician_id, (counts.get(timesheet.technician_id) || 0) + 1);
      });

      if (!counts.size) return EMPTY_COUNTS;

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, department")
        .in("id", Array.from(counts.keys()));

      if (profileError) {
        return { counts, departments: new Map<string, string>() };
      }

      const departments = new Map<string, string>();
      (profiles || []).forEach((profile: { id: string; department?: string | null }) => {
        if (profile.department) {
          departments.set(profile.id, profile.department);
        }
      });

      return { counts, departments };
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });

  const orderedTechnicians = useMemo(() => {
    const next = [...technicians];

    if (sortJobId) {
      const baseOrder = new Map<string, number>();
      technicians.forEach((technician, index) => {
        baseOrder.set(technician.id, index);
      });

      const scoreMap = new Map<string, number>();

      allAssignments.forEach((assignment) => {
        if (assignment.job_id !== sortJobId) return;
        const currentScore = scoreMap.get(assignment.technician_id) || 0;
        const status = (assignment.status || "").toLowerCase();
        const score = status === "confirmed" ? 3 : status === "invited" ? 1 : 0;
        scoreMap.set(assignment.technician_id, Math.max(currentScore, score));
      });

      technicians.forEach((technician) => {
        const status = sortJobStatuses.get(technician.id);
        if (!status) return;
        const currentScore = scoreMap.get(technician.id) || 0;
        let score = 0;
        if (status.offer_status === "confirmed") score = Math.max(score, 2);
        else if (status.offer_status === "sent") score = Math.max(score, 1.5);
        if (status.availability_status === "confirmed") score = Math.max(score, 1.2);
        else if (status.availability_status === "requested") score = Math.max(score, 1);
        if (score > 0) scoreMap.set(technician.id, Math.max(currentScore, score));
      });

      next.sort((left, right) => {
        const leftScore = scoreMap.get(left.id) || 0;
        const rightScore = scoreMap.get(right.id) || 0;
        if (rightScore !== leftScore) return rightScore - leftScore;
        return (baseOrder.get(left.id) || 0) - (baseOrder.get(right.id) || 0);
      });

      return next;
    }

    switch (techSortMethod) {
      case "location":
        next.sort((left, right) => {
          const leftLocation = techResidencias.get(left.id) || "";
          const rightLocation = techResidencias.get(right.id) || "";

          if (leftLocation && !rightLocation) return -1;
          if (!leftLocation && rightLocation) return 1;
          if (!leftLocation && !rightLocation) return left.first_name.localeCompare(right.first_name);

          const parseLocation = (location: string) => {
            const parts = location.split(",").map((part) => part.trim());
            if (parts.length > 1) {
              return { city: parts[0], country: parts[1] };
            }
            return { city: parts[0], country: "España" };
          };

          const leftParsed = parseLocation(leftLocation);
          const rightParsed = parseLocation(rightLocation);
          const leftIsSpain = leftParsed.country === "España" || leftParsed.country === "Spain";
          const rightIsSpain = rightParsed.country === "España" || rightParsed.country === "Spain";

          if (leftIsSpain && !rightIsSpain) return -1;
          if (!leftIsSpain && rightIsSpain) return 1;
          if (!leftIsSpain && !rightIsSpain) {
            const countryComparison = leftParsed.country.localeCompare(rightParsed.country, "es");
            if (countryComparison !== 0) return countryComparison;
          }

          const cityComparison = leftParsed.city.localeCompare(rightParsed.city, "es");
          if (cityComparison !== 0) return cityComparison;
          return left.first_name.localeCompare(right.first_name);
        });
        break;
      case "name-asc":
        next.sort((left, right) => left.first_name.localeCompare(right.first_name));
        break;
      case "name-desc":
        next.sort((left, right) => right.first_name.localeCompare(left.first_name));
        break;
      case "surname-asc":
        next.sort((left, right) => left.last_name.localeCompare(right.last_name));
        break;
      case "surname-desc":
        next.sort((left, right) => right.last_name.localeCompare(left.last_name));
        break;
      case "default":
      default:
        next.sort((left, right) => {
          const leftIsHouse = left.role === "house_tech";
          const rightIsHouse = right.role === "house_tech";
          if (leftIsHouse && !rightIsHouse) return -1;
          if (!leftIsHouse && rightIsHouse) return 1;
          if (!leftIsHouse && !rightIsHouse) {
            const leftCount = techConfirmedCounts.counts.get(left.id) || 0;
            const rightCount = techConfirmedCounts.counts.get(right.id) || 0;
            if (rightCount !== leftCount) return rightCount - leftCount;
          }
          return 0;
        });
        break;
    }

    return next;
  }, [allAssignments, sortJobId, sortJobStatuses, techConfirmedCounts.counts, techResidencias, techSortMethod, technicians]);

  const createMedalRankings = useCallback(
    (source: TechCountData) => {
      const rankings = new Map<string, "gold" | "silver" | "bronze">();

      if (techSortMethod !== "default" || sortJobId) {
        return rankings;
      }

      const techniciansByDepartment = new Map<string, Array<{ id: string; count: number }>>();
      Array.from(source.counts.entries()).forEach(([id, count]) => {
        const department = source.departments.get(id);
        if (!department) return;
        const existing = techniciansByDepartment.get(department) || [];
        existing.push({ id, count });
        techniciansByDepartment.set(department, existing);
      });

      techniciansByDepartment.forEach((departmentTechnicians) => {
        departmentTechnicians.sort((left, right) => right.count - left.count);
        let medalIndex = 0;
        let index = 0;

        while (index < departmentTechnicians.length && medalIndex < 3) {
          const currentCount = departmentTechnicians[index].count;
          if (currentCount === 0) break;

          const medal = medalIndex === 0 ? "gold" : medalIndex === 1 ? "silver" : "bronze";
          let tiedCount = 0;

          while (
            index + tiedCount < departmentTechnicians.length &&
            departmentTechnicians[index + tiedCount]?.count === currentCount
          ) {
            rankings.set(departmentTechnicians[index + tiedCount].id, medal);
            tiedCount += 1;
          }

          medalIndex += tiedCount;
          index += tiedCount;
        }
      });

      return rankings;
    },
    [sortJobId, techSortMethod],
  );

  const techMedalRankings = useMemo(() => createMedalRankings(techConfirmedCounts), [createMedalRankings, techConfirmedCounts]);
  const techLastYearMedalRankings = useMemo(
    () => createMedalRankings(techLastYearCounts),
    [createMedalRankings, techLastYearCounts],
  );

  const cycleTechSort = useCallback(() => {
    const methods: TechSortMethod[] = ["default", "location", "name-asc", "name-desc", "surname-asc", "surname-desc"];
    const nextIndex = (methods.indexOf(techSortMethod) + 1) % methods.length;
    setTechSortMethod(methods[nextIndex]);
    if (sortJobId) setSortJobId(null);
  }, [sortJobId, techSortMethod]);

  const getSortLabel = useCallback(() => {
    switch (techSortMethod) {
      case "location":
        return mobile ? "📍 Ubic." : "📍 Ubicación";
      case "name-asc":
        return mobile ? "A→Z" : "A→Z Nombre";
      case "name-desc":
        return mobile ? "Z→A" : "Z→A Nombre";
      case "surname-asc":
        return mobile ? "A→Z Ape." : "A→Z Apellido";
      case "surname-desc":
        return mobile ? "Z→A Ape." : "Z→A Apellido";
      case "default":
      default:
        return "";
    }
  }, [mobile, techSortMethod]);
  return {
    orderedTechnicians,
    isManagementUser,
    cycleTechSort,
    getSortLabel,
    setSortJobId,
    createUserOpen,
    setCreateUserOpen,
    techMedalRankings,
    techLastYearMedalRankings,
  };
}
