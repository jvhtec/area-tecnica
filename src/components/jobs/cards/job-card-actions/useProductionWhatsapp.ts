import React from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useQuery } from "@tanstack/react-query";

import {
  buildProductionWhatsappTemplate,
  formatDateGroupLabel,
  resolveSuggestedCallTime,
} from "@/components/jobs/cards/job-card-actions/jobActionFormatters";
import {
  pickLatestJobHojaDeRutaDocument,
  pickLatestLinkedJobHojaDeRutaDocument,
  pickLatestTourHojaDeRutaDocument,
  type HojaDeRutaAttachmentRow,
} from "@/components/jobs/cards/job-card-actions/hojaDeRutaAttachment";
import {
  MADRID_TIME_ZONE,
  type JobCardJob,
  type JobAssignmentRow,
  type WaProdAssignment,
  type WaProdHojaDeRutaDoc,
  type WaProdTimesheetRow,
  type WaSendResult,
} from "@/components/jobs/cards/job-card-actions/types";
import { useToast } from "@/hooks/use-toast";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { createQueryKey } from "@/lib/optimized-react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { Department } from "@/types/department";
import { isManagementRole } from "@/utils/permissions";
import { extractFunctionErrorMessage } from "@/utils/supabaseFunctionError";

export type ProductionWhatsappState = ReturnType<typeof useProductionWhatsapp>;

type UseProductionWhatsappArgs = {
  job: JobCardJob;
  userRole: string | null;
  isProjectManagementPage: boolean;
  department?: Department;
};

export const useProductionWhatsapp = ({
  job,
  userRole,
  isProjectManagementPage,
  department,
}: UseProductionWhatsappArgs) => {
  const { toast } = useToast();
  const { userDepartment } = useOptimizedAuth();
  const normalizedUserDepartment = typeof userDepartment === "string"
    ? userDepartment.toLowerCase().replace(/_warehouse$/, "")
    : "";
  const isManagementUser = isManagementRole(userRole);
  const canSendProductionWhatsapp = Boolean(
    isProjectManagementPage
    && department === "production"
    && (
      isManagementUser
      || normalizedUserDepartment === "production"
      || normalizedUserDepartment === "produccion"
      || normalizedUserDepartment === "producción"
    )
  );

  const [waProdOpen, setWaProdOpen] = React.useState(false);
  const [waProdDateGroup, setWaProdDateGroup] = React.useState<string>("all");
  const [waProdRecipientIds, setWaProdRecipientIds] = React.useState<string[]>([]);
  const [waProdCallTime, setWaProdCallTime] = React.useState<string>("");
  const [waProdMessage, setWaProdMessage] = React.useState<string>("");
  const [waProdDirty, setWaProdDirty] = React.useState(false);
  const [waProdSending, setWaProdSending] = React.useState(false);
  const [waProdAttachHojaDeRuta, setWaProdAttachHojaDeRuta] = React.useState(false);

  const { data: waProdAssignments = [], isLoading: waProdAssignmentsLoading } = useQuery({
    queryKey: createQueryKey.whatsapp.prodAssignmentsByJob(job.id),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from("job_assignments")
        .select("id, technician_id, single_day, assignment_date, profiles!job_assignments_technician_id_fkey(first_name,last_name,phone)")
        .eq("job_id", job.id);
      if (error) throw error;

      const rows = ((data as JobAssignmentRow[] | null) || []).map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          id: row.id,
          technician_id: row.technician_id,
          single_day: Boolean(row.single_day),
          assignment_date: row.assignment_date || null,
          profile: profile
            ? { first_name: profile.first_name ?? null, last_name: profile.last_name ?? null, phone: profile.phone ?? null }
            : null,
        } as WaProdAssignment;
      });

      rows.sort((a, b) => {
        const aKey = a.single_day && a.assignment_date ? a.assignment_date : "";
        const bKey = b.single_day && b.assignment_date ? b.assignment_date : "";
        if (aKey !== bKey) return aKey.localeCompare(bKey);
        const aName = `${a.profile?.first_name ?? ""} ${a.profile?.last_name ?? ""}`.trim();
        const bName = `${b.profile?.first_name ?? ""} ${b.profile?.last_name ?? ""}`.trim();
        return aName.localeCompare(bName);
      });

      return rows;
    },
    enabled: Boolean(waProdOpen && canSendProductionWhatsapp && job?.id),
    staleTime: 30_000,
  });

  const { data: waProdTimesheets = [] } = useQuery({
    queryKey: createQueryKey.whatsapp.prodTimesheetsByJob(job.id),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from("timesheets")
        .select("technician_id,date")
        .eq("job_id", job.id)
        .eq("is_active", true);

      if (error) throw error;
      return (data as WaProdTimesheetRow[] | null) || [];
    },
    enabled: Boolean(waProdOpen && canSendProductionWhatsapp && job?.id),
    staleTime: 30_000,
  });

  const { data: waProdHojaDeRutaDoc = null, isLoading: waProdHojaDeRutaLoading } = useQuery({
    queryKey: [
      ...createQueryKey.whatsapp.prodHojaDeRutaDocByJob(job.id),
      job.tour_date_id ?? null,
      job.tour_id ?? job.tour?.id ?? null,
    ],
    queryFn: async (): Promise<WaProdHojaDeRutaDoc | null> => {
      const findJobHojaDocument = async (jobId: string): Promise<WaProdHojaDeRutaDoc | null> => {
        const { data, error } = await dataLayerClient.from("job_documents")
          .select("id, job_id, file_name, file_path, file_type, uploaded_at")
          .eq("job_id", jobId)
          .order("uploaded_at", { ascending: false })
          .limit(25);

        if (error) throw error;
        return pickLatestJobHojaDeRutaDocument(data as HojaDeRutaAttachmentRow[] | null, jobId);
      };

      const directJobDoc = await findJobHojaDocument(job.id);
      if (directJobDoc) return directJobDoc;

      if (job.tour_date_id) {
        const { data: hojaRows, error: hojaError } = await dataLayerClient.from("hoja_de_ruta")
          .select("job_id")
          .eq("tour_date_id", job.tour_date_id)
          .order("created_at", { ascending: false });

        if (hojaError) throw hojaError;

        const linkedJobIds = Array.from(new Set(
          ((hojaRows as Array<{ job_id: string | null }> | null) || [])
            .map((row) => row.job_id)
            .filter((id): id is string => Boolean(id && id !== job.id))
        ));

        if (linkedJobIds.length > 0) {
          const { data: linkedDocs, error: linkedDocsError } = await dataLayerClient.from("job_documents")
            .select("id, job_id, file_name, file_path, file_type, uploaded_at")
            .in("job_id", linkedJobIds)
            .order("uploaded_at", { ascending: false });

          if (linkedDocsError) throw linkedDocsError;
          const linkedJobDoc = pickLatestLinkedJobHojaDeRutaDocument(
            linkedDocs as HojaDeRutaAttachmentRow[] | null,
            linkedJobIds
          );
          if (linkedJobDoc) return linkedJobDoc;
        }
      }

      const tourId = job.tour_id || job.tour?.id || null;
      if (!tourId) return null;

      const { data: tourDocs, error: tourDocsError } = await dataLayerClient.from("tour_documents")
        .select("id, file_name, file_path, file_type, uploaded_at")
        .eq("tour_id", tourId)
        .order("uploaded_at", { ascending: false })
        .limit(25);

      if (tourDocsError) throw tourDocsError;
      return pickLatestTourHojaDeRutaDocument(tourDocs as HojaDeRutaAttachmentRow[] | null);
    },
    enabled: Boolean(waProdOpen && canSendProductionWhatsapp && job?.id),
    staleTime: 30_000,
  });

  const waProdWorkDates = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of waProdTimesheets) {
      const technicianId = row.technician_id;
      const date = row.date || null;
      if (!technicianId || !date) continue;
      if (!map.has(technicianId)) map.set(technicianId, new Set());
      map.get(technicianId)!.add(date);
    }
    return map;
  }, [waProdTimesheets]);

  const assignmentMatchesWaGroup = React.useCallback((assignment: WaProdAssignment, groupKey: string): boolean => {
    if (groupKey === "all") return true;
    if (groupKey.startsWith("day:")) {
      const date = groupKey.replace(/^day:/, "");
      return Boolean(waProdWorkDates.get(assignment.technician_id)?.has(date));
    }

    console.warn("[WhatsApp production] Unknown date group key:", groupKey);
    return false;
  }, [waProdWorkDates]);

  const waProdGroups = React.useMemo(() => {
    const keys = new Set<string>();
    keys.add("all");

    for (const row of waProdTimesheets) {
      if (row?.date) keys.add(`day:${row.date}`);
    }

    const list = Array.from(keys).map((key) => {
      if (key === "all") {
        const range = job?.start_time && job?.end_time
          ? `${formatInTimeZone(new Date(job.start_time), MADRID_TIME_ZONE, "dd/MM/yyyy")} – ${formatInTimeZone(new Date(job.end_time), MADRID_TIME_ZONE, "dd/MM/yyyy")}`
          : job?.start_time
            ? `${formatInTimeZone(new Date(job.start_time), MADRID_TIME_ZONE, "dd/MM/yyyy")}`
            : "";
        return { key, label: range ? `Todos los días (${range})` : "Todos los días" };
      }

      const date = key.replace(/^day:/, "");
      return { key, label: formatDateGroupLabel(date) };
    });

    list.sort((a, b) => {
      if (a.key === "all") return -1;
      if (b.key === "all") return 1;
      return a.key.localeCompare(b.key);
    });

    return list;
  }, [waProdTimesheets, job]);

  const buildWaProdTemplate = React.useCallback((opts: { groupKey: string; callTime: string }) => (
    buildProductionWhatsappTemplate(job, opts)
  ), [job]);

  const handleWaProdSend = React.useCallback(async () => {
    try {
      if (!waProdRecipientIds.length) {
        toast({ title: "Selecciona destinatarios", description: "Elige al menos una persona.", variant: "destructive" });
        return;
      }
      const trimmed = (waProdMessage || "").trim();
      if (!trimmed) {
        toast({ title: "Mensaje vacío", description: "Escribe un mensaje antes de enviar.", variant: "destructive" });
        return;
      }

      const attachHojaDeRuta = waProdAttachHojaDeRuta && Boolean(waProdHojaDeRutaDoc);

      setWaProdSending(true);
      const { data, error } = await dataLayerClient.functions.invoke<WaSendResult>("send-job-whatsapp-message", {
        body: {
          job_id: job?.id,
          message: trimmed,
          recipient_ids: waProdRecipientIds,
          attach_hoja_de_ruta: attachHojaDeRuta,
        },
      });

      if (error) {
        toast({ title: "Error al enviar", description: await extractFunctionErrorMessage(error), variant: "destructive" });
        return;
      }

      const sent = data?.sentCount ?? null;
      const failed = data?.failed?.length ?? 0;
      const descriptionParts = [
        sent !== null ? `Enviados: ${sent}. Fallos: ${failed}.` : `Mensaje enviado. Fallos: ${failed}.`,
      ];
      if (attachHojaDeRuta) {
        const attachmentSent = data?.attachmentSentCount ?? 0;
        const attachmentFailed = data?.attachmentFailed?.length ?? 0;
        descriptionParts.push(`Hoja de Ruta: ${attachmentSent} enviadas, ${attachmentFailed} fallos.`);
      }
      toast({
        title: "Enviado",
        description: descriptionParts.join(" "),
      });
      setWaProdOpen(false);
    } catch (error: unknown) {
      const fallback = error instanceof Error ? error.message : String(error);
      const message = await extractFunctionErrorMessage(error, fallback);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setWaProdSending(false);
    }
  }, [job?.id, toast, waProdMessage, waProdRecipientIds, waProdAttachHojaDeRuta, waProdHojaDeRutaDoc]);

  React.useEffect(() => {
    if (!waProdOpen) return;
    if (waProdDirty) return;
    setWaProdMessage(buildWaProdTemplate({ groupKey: waProdDateGroup || "all", callTime: waProdCallTime }));
  }, [waProdOpen, waProdDirty, waProdDateGroup, waProdCallTime, buildWaProdTemplate]);

  React.useEffect(() => {
    if (!waProdOpen) return;
    if (!waProdRecipientIds.length) return;
    const allowedIds = new Set(
      waProdAssignments
        .filter((assignment) => assignmentMatchesWaGroup(assignment, waProdDateGroup))
        .map((assignment) => assignment.technician_id)
    );
    const filtered = waProdRecipientIds.filter((id) => allowedIds.has(id));
    const isSame = filtered.length === waProdRecipientIds.length
      && filtered.every((id, index) => id === waProdRecipientIds[index]);
    if (!isSame) setWaProdRecipientIds(filtered);
  }, [waProdOpen, waProdAssignments, waProdDateGroup, waProdRecipientIds, assignmentMatchesWaGroup]);

  const openProductionWhatsappDialog = React.useCallback(() => {
    const suggested = resolveSuggestedCallTime(job);
    setWaProdDateGroup("all");
    setWaProdRecipientIds([]);
    setWaProdCallTime(suggested);
    setWaProdDirty(false);
    setWaProdAttachHojaDeRuta(false);
    setWaProdMessage(buildProductionWhatsappTemplate(job, { groupKey: "all", callTime: suggested }));
    setWaProdOpen(true);
  }, [job]);

  const handleProductionDialogOpenChange = React.useCallback((open: boolean) => {
    setWaProdOpen(open);
    if (!open) {
      setWaProdRecipientIds([]);
      setWaProdDirty(false);
      setWaProdAttachHojaDeRuta(false);
    }
  }, []);

  return {
    assignmentMatchesWaGroup,
    buildWaProdTemplate,
    canSendProductionWhatsapp,
    handleProductionDialogOpenChange,
    handleWaProdSend,
    openProductionWhatsappDialog,
    setWaProdAttachHojaDeRuta,
    setWaProdCallTime,
    setWaProdDateGroup,
    setWaProdDirty,
    setWaProdMessage,
    setWaProdOpen,
    setWaProdRecipientIds,
    waProdAssignments,
    waProdAssignmentsLoading,
    waProdAttachHojaDeRuta,
    waProdCallTime,
    waProdDateGroup,
    waProdGroups,
    waProdHojaDeRutaDoc,
    waProdHojaDeRutaLoading,
    waProdMessage,
    waProdOpen,
    waProdRecipientIds,
    waProdSending,
  };
};
