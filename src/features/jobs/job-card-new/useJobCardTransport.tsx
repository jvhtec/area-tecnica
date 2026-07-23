import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { dataLayerClient } from "@/services/dataLayerClient";
import { extractFunctionErrorMessage } from "@/utils/supabaseFunctionError";
import { queryKeys } from "@/lib/react-query";
import type { Department } from "@/types/department";

import type {
  JobCardTransportDependencies,
  JobCardTransportState,
  TransportRequestSummary,
} from "@/features/jobs/job-card-new/jobCardNewTypes";

type ProfileContact = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

type AssignmentRoleKey = "sound_role" | "lights_role" | "video_role";

const ASSIGNMENT_ROLE_BY_DEPARTMENT: Partial<Record<Department, AssignmentRoleKey>> = {
  sound: "sound_role",
  lights: "lights_role",
  video: "video_role",
};

type JobAssignmentContactRow = {
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  profiles?: ProfileContact | ProfileContact[] | null;
};

type CreateWhatsappGroupResult = {
  wa_group_id?: string | null;
  note?: string | null;
  warnings?: {
    missing?: unknown[];
    invalid?: unknown[];
  };
};

type ClearWhatsappGroupResult = {
  success?: boolean;
  error?: string;
  message?: string;
  can_retry?: boolean;
};

type LogisticsEventWithDepartments = {
  id?: string;
  event_type?: string | null;
  logistics_event_departments?: Array<{ department?: string | null }> | null;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function useJobCardTransport({
  assignments,
  confirm,
  currentUserDepartment,
  department,
  isFestivalLike,
  isManagementUser,
  job,
  queryClient,
  setLogisticsDialogOpen,
  setLogisticsInitialEventType,
  setSelectedTransportRequest,
  setTransportDialogOpen,
  toast,
}: JobCardTransportDependencies): JobCardTransportState {
  const { data: myTransportRequest } = useQuery<TransportRequestSummary | null>({
    queryKey: queryKeys.scope("transport-request", job.id, currentUserDepartment),
    queryFn: async () => {
      if (!currentUserDepartment || !["sound", "lights", "video"].includes(currentUserDepartment)) {
        return null;
      }
      const { data, error } = await dataLayerClient
        .from("transport_requests")
        .select(
          "id, department, status, note, description, created_at, items:transport_request_items(id, transport_type, leftover_space_meters)",
        )
        .eq("job_id", job.id)
        .eq("department", currentUserDepartment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data as TransportRequestSummary | null;
    },
    enabled: Boolean(job.id && currentUserDepartment),
  });

  const { data: allRequests = [], isLoading: isAllRequestsLoading } = useQuery<
    TransportRequestSummary[]
  >({
    queryKey: queryKeys.scope("transport-requests-all", job.id),
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from("transport_requests")
        .select(
          "id, department, status, note, description, created_at, items:transport_request_items(id, transport_type, leftover_space_meters)",
        )
        .eq("job_id", job.id)
        .eq("status", "requested")
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []) as TransportRequestSummary[];
    },
    enabled: Boolean(
      job.id && (currentUserDepartment === "logistics" || isManagementUser),
    ),
  });

  const { data: jobEvents = [] } = useQuery({
    queryKey: queryKeys.scope("logistics-events-for-job", job.id),
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from("logistics_events")
        .select("id")
        .eq("job_id", job.id);
      if (error) return [];
      return data ?? [];
    },
    enabled: Boolean(job.id && job.job_type !== "dryhire"),
  });

  const isScheduled = jobEvents.length > 0;
  const hasRequest = Boolean(myTransportRequest) || allRequests.length > 0;
  const isTechDept = Boolean(
    currentUserDepartment &&
      ["sound", "lights", "video"].includes(currentUserDepartment),
  );
  const canManageTransportRequests =
    currentUserDepartment === "logistics" || isManagementUser;

  const transportButtonLabel = (() => {
    if (isScheduled) return "Transport Scheduled";
    if (canManageTransportRequests) {
      return allRequests.length > 0
        ? `Requests (${allRequests.length})`
        : "Logistics";
    }
    if (isTechDept) {
      return myTransportRequest ? "Transport Requested" : "Request Transport";
    }
    return undefined;
  })();

  const transportButtonTone = isScheduled
    ? "default"
    : hasRequest
      ? "secondary"
      : "outline";

  const handleTransportClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (canManageTransportRequests) {
      if (!isAllRequestsLoading && allRequests.length === 0) {
        setSelectedTransportRequest(null);
        setLogisticsInitialEventType("load");
        setTransportDialogOpen(false);
        setLogisticsDialogOpen(true);
        return;
      }
      setTransportDialogOpen(true);
    } else if (isTechDept && currentUserDepartment) {
      setTransportDialogOpen(true);
    }
  };

  const { data: waGroup, refetch: refetchWaGroup } = useQuery({
    queryKey: queryKeys.scope("job-whatsapp-group", job.id, department, 0),
    enabled: Boolean(job.id && department && isManagementUser && !isFestivalLike),
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from("job_whatsapp_groups")
        .select("id, wa_group_id")
        .eq("job_id", job.id)
        .eq("department", department)
        .eq("stage_number", 0)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  const { data: waRequest, refetch: refetchWaRequest } = useQuery({
    queryKey: queryKeys.scope("job-whatsapp-group-request", job.id, department, 0),
    enabled: Boolean(job.id && department && isManagementUser && !isFestivalLike),
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from("job_whatsapp_group_requests")
        .select("id, created_at")
        .eq("job_id", job.id)
        .eq("department", department)
        .eq("stage_number", 0)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  const hasAssignedTechnicians = useMemo(
    () => assignments.some((assignment) => Boolean(assignment.technician_id)),
    [assignments],
  );

  const { data: jobTimesheets = [] } = useQuery({
    queryKey: queryKeys.scope("job-timesheets-status", job.id),
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from("timesheets")
        .select("technician_id, status, date")
        .eq("job_id", job.id)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: hasAssignedTechnicians && job.job_type !== "dryhire",
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!hasAssignedTechnicians || job.job_type === "dryhire") return;

    const channel = dataLayerClient
      .channel(`job-timesheets-${job.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "timesheets",
          filter: `job_id=eq.${job.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.scope("job-timesheets-status", job.id),
          });
        },
      )
      .subscribe();

    return () => {
      void dataLayerClient.removeChannel(channel);
    };
  }, [hasAssignedTechnicians, job.id, job.job_type, queryClient]);

  const createWhatsappGroupCore = async () => {
    if (!isManagementUser) return;
    try {
      const { data: rows } = await dataLayerClient
        .from("job_assignments")
        .select(
          "sound_role, lights_role, video_role, profiles!job_assignments_technician_id_fkey(first_name,last_name,phone)",
        )
        .eq("job_id", job.id);
      const departmentRole = ASSIGNMENT_ROLE_BY_DEPARTMENT[department];
      if (!departmentRole) {
        toast({
          title: "Departamento no soportado",
          description:
            "Solo sonido, luces o vídeo pueden crear grupos de WhatsApp.",
          variant: "destructive",
        });
        return;
      }

      const assignmentRows = (rows ?? []) as JobAssignmentContactRow[];
      const crew = assignmentRows.filter((row) => Boolean(row[departmentRole]));
      const missing: string[] = [];
      let validPhones = 0;
      for (const row of crew) {
        const profile = Array.isArray(row.profiles)
          ? row.profiles[0]
          : row.profiles;
        const fullName =
          `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
          "Técnico";
        const phone = (profile?.phone ?? "").trim();
        if (!phone) missing.push(fullName);
        else validPhones += 1;
      }

      if (validPhones === 0) {
        toast({
          title: "Sin teléfonos",
          description: "No hay teléfonos válidos para el equipo asignado.",
          variant: "destructive",
        });
        return;
      }

      if (missing.length > 0) {
        const proceed = await confirm({
          title: "Crear grupo de WhatsApp",
          description: (
            <span className="whitespace-pre-line">
              {`Faltan teléfonos para ${missing.length} técnico(s):\n- ${missing.slice(0, 5).join("\n- ")}${missing.length > 5 ? "\n..." : ""}\n\n¿Crear el grupo igualmente?`}
            </span>
          ),
          confirmText: "Crear grupo",
        });
        if (!proceed) return;
      }

      const { data, error } = await dataLayerClient.functions.invoke(
        "create-whatsapp-group",
        {
          body: { job_id: job.id, department, stage_number: 0 },
        },
      );
      if (error) {
        toast({
          title: "Error al crear grupo",
          description: await extractFunctionErrorMessage(error),
          variant: "destructive",
        });
      } else {
        const result = data as CreateWhatsappGroupResult | null;
        const warnings = result?.warnings;
        toast({
          title: result?.wa_group_id ? "Grupo creado" : "Grupo solicitado",
          description:
            warnings && (warnings.missing?.length || warnings.invalid?.length)
              ? `Avisos: sin teléfono ${warnings.missing?.length ?? 0}, inválidos ${warnings.invalid?.length ?? 0}`
              : result?.note || "Operación realizada.",
        });
      }
      await Promise.all([refetchWaGroup(), refetchWaRequest()]);
    } catch (error: unknown) {
      await Promise.all([refetchWaGroup(), refetchWaRequest()]);
      toast({
        title: "Error al crear grupo",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleCreateWhatsappGroup = async (event: React.MouseEvent) => {
    event.stopPropagation();
    await createWhatsappGroupCore();
  };

  const handleRetryWhatsappGroup = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isManagementUser) return;

    try {
      const { data: clearResult, error: clearError } =
        await dataLayerClient.rpc("clear_whatsapp_group_request", {
          p_job_id: job.id,
          p_department: department,
          p_stage_number: 0,
        });

      if (clearError) {
        toast({
          title: "Error",
          description: `No se pudo limpiar la solicitud: ${clearError.message}`,
          variant: "destructive",
        });
        return;
      }

      const result = clearResult as ClearWhatsappGroupResult;
      if (!result.success) {
        toast({
          title: "Aviso",
          description: result.error || result.message,
          variant: result.can_retry ? "default" : "destructive",
        });
        await Promise.all([refetchWaGroup(), refetchWaRequest()]);
        return;
      }

      toast({
        title: "Solicitud limpiada",
        description: "Intentando crear el grupo de nuevo...",
      });
      await Promise.all([refetchWaGroup(), refetchWaRequest()]);
      await createWhatsappGroupCore();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: `Error al reintentar: ${getErrorMessage(error)}`,
        variant: "destructive",
      });
      await Promise.all([refetchWaGroup(), refetchWaRequest()]);
    }
  };

  const checkAndFulfillRequest = async (
    requestId: string,
    departmentForRequest: string,
  ) => {
    try {
      const { data: events } = await dataLayerClient
        .from("logistics_events")
        .select("id, event_type, logistics_event_departments(department)")
        .eq("job_id", job.id)
        .eq(
          "logistics_event_departments.department",
          departmentForRequest,
        );
      const logisticsEvents = (events ?? []) as LogisticsEventWithDepartments[];
      const hasLoad = logisticsEvents.some(
        (event) => event.event_type === "load",
      );
      const hasUnload = logisticsEvents.some(
        (event) => event.event_type === "unload",
      );
      if (hasLoad && hasUnload) {
        await dataLayerClient
          .from("transport_requests")
          .update({ status: "fulfilled" })
          .eq("id", requestId);
        queryClient.invalidateQueries({
          queryKey: queryKeys.scope(
            "transport-request",
            job.id,
            departmentForRequest,
          ),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.scope("transport-requests-all", job.id),
        });
      }
    } catch (error: unknown) {
      console.error("checkAndFulfillRequest failed", error);
    }
  };

  return {
    allRequests,
    checkAndFulfillRequest,
    handleCreateWhatsappGroup,
    handleRetryWhatsappGroup,
    handleTransportClick,
    isTechDept,
    jobTimesheets,
    myTransportRequest,
    transportButtonLabel,
    transportButtonTone,
    waGroup,
    waRequest,
  };
}
