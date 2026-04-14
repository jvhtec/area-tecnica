import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { useSelectedCellStore } from "@/stores/useSelectedCellStore";
import { supabase } from "@/integrations/supabase/client";
import { ConflictError } from "@/features/staffing/hooks/useStaffing";
import {
  buildMatrixCellKey,
  MATRIX_DATE_KEY_FORMAT,
  MATRIX_TIMEZONE,
  parseMatrixDateKey,
} from "@/components/matrix/optimized-assignment-matrix/matrixCore";
import type {
  CellAction,
  MatrixAvailability,
  MatrixAvailabilityDialogState,
  MatrixCellActionType,
  MatrixConflictDialogState,
  MatrixDialogsState,
  MatrixTechnician,
  MatrixTimesheetAssignment,
  StaffingChannel,
  StaffingIntentPhase,
} from "@/components/matrix/optimized-assignment-matrix/types";

const FRIDGE_BLOCKED_ACTIONS = new Set<MatrixCellActionType>([
  "select-job",
  "assign",
  "select-job-for-staffing",
  "confirm",
  "offer-details",
  "offer-details-wa",
  "offer-details-email",
  "availability-wa",
  "availability-email",
]);

function formatStaffingDate(date: Date): string {
  return formatInTimeZone(date, MATRIX_TIMEZONE, MATRIX_DATE_KEY_FORMAT);
}

interface UseMatrixInteractionControllerArgs {
  technicians: MatrixTechnician[];
  fridgeSet?: Set<string>;
  allowDirectAssign: boolean;
  isManagementUser: boolean;
  getAssignmentForCell: (technicianId: string, date: Date) => MatrixTimesheetAssignment | undefined;
  getAvailabilityForCell: (technicianId: string, date: Date) => MatrixAvailability | undefined;
  invalidateAssignmentQueries: () => Promise<void>;
  invalidateAvailabilityQueries?: () => Promise<void>;
  prefetchTechnicianData: (technicianId: string) => Promise<void>;
  updateAssignmentOptimistically: (technicianId: string, jobId: string, status: string) => void;
  toast: MatrixDialogsState["toast"];
  sendStaffingEmail: MatrixDialogsState["sendStaffingEmail"];
  checkTimeConflictEnhanced: MatrixDialogsState["checkTimeConflictEnhanced"];
  declinedJobsByTech: Map<string, Set<string>>;
}

interface MatrixInteractionControllerResult extends MatrixDialogsState {
  selectedCells: Set<string>;
  handleCellSelect: (technicianId: string, date: Date, selected: boolean) => void;
  handleCellClick: (
    technicianId: string,
    date: Date,
    action: MatrixCellActionType,
    selectedJobId?: string,
  ) => void;
  handleCellPrefetch: (technicianId: string) => void;
  handleOptimisticUpdate: (technicianId: string, jobId: string, status: string) => void;
}

export function useMatrixInteractionController({
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
}: UseMatrixInteractionControllerArgs): MatrixInteractionControllerResult {
  const [cellAction, setCellAction] = useState<CellAction | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [availabilityPreferredChannel, setAvailabilityPreferredChannel] = useState<StaffingChannel | null>(null);
  const [offerPreferredChannel, setOfferPreferredChannel] = useState<StaffingChannel | null>(null);
  const [offerChannel, setOfferChannel] = useState<StaffingChannel>("email");
  const [availabilityDialog, setAvailabilityDialog] = useState<MatrixAvailabilityDialogState | null>(null);
  const [availabilitySending, setAvailabilitySending] = useState(false);
  const [availabilityCoverage, setAvailabilityCoverage] = useState<"full" | "single" | "multi">("single");
  const [availabilitySingleDate, setAvailabilitySingleDate] = useState<Date | null>(null);
  const [availabilityMultiDates, setAvailabilityMultiDates] = useState<Date[]>([]);
  const [conflictDialog, setConflictDialog] = useState<MatrixConflictDialogState | null>(null);

  const {
    selectCell,
    clearSelection: clearGlobalSelection,
    clearMultiSelection: clearGlobalMultiSelection,
    isCellSelected: isGlobalCellSelected,
  } = useSelectedCellStore();

  const forcedStaffingAction = useMemo<StaffingIntentPhase | undefined>(() => {
    if (cellAction?.type !== "select-job-for-staffing") return undefined;
    if (cellAction.intendedPhase) return cellAction.intendedPhase;
    if (availabilityPreferredChannel) return "availability";
    if (offerPreferredChannel) return "offer";
    return undefined;
  }, [availabilityPreferredChannel, cellAction, offerPreferredChannel]);

  const forcedStaffingChannel = useMemo<StaffingChannel | undefined>(() => {
    if (cellAction?.type !== "select-job-for-staffing") return undefined;
    if (cellAction.intendedChannel) return cellAction.intendedChannel;
    if (forcedStaffingAction === "availability") {
      return availabilityPreferredChannel ?? undefined;
    }
    if (forcedStaffingAction === "offer") {
      return offerPreferredChannel ?? undefined;
    }
    return undefined;
  }, [availabilityPreferredChannel, cellAction, forcedStaffingAction, offerPreferredChannel]);

  const closeDialogs = useCallback(() => {
    setCellAction(null);
    setSelectedCells(new Set());
    setAvailabilityPreferredChannel(null);
    setOfferPreferredChannel(null);
    setAvailabilityDialog(null);
    setConflictDialog(null);
    clearGlobalSelection();
    clearGlobalMultiSelection();
    void invalidateAssignmentQueries();
  }, [clearGlobalMultiSelection, clearGlobalSelection, invalidateAssignmentQueries]);

  const currentTechnician = useMemo(() => {
    if (!cellAction?.technicianId) return null;
    return technicians.find((technician) => technician.id === cellAction.technicianId) ?? null;
  }, [cellAction?.technicianId, technicians]);

  const handleDirectToggleUnavailable = useCallback(
    async (technicianId: string, date: Date) => {
      const dateKey = formatStaffingDate(date);
      const existing = getAvailabilityForCell(technicianId, date);

      if (existing) {
        const { error } = await supabase
          .from("technician_availability")
          .delete()
          .eq("technician_id", technicianId)
          .eq("date", dateKey);

        if (error) {
          toast({
            title: "Error",
            description: "No se pudo eliminar la no disponibilidad.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Disponibilidad restaurada",
          description: `${dateKey} marcado como disponible.`,
        });
      } else {
        const { error } = await supabase
          .from("technician_availability")
          .upsert([{ technician_id: technicianId, date: dateKey, status: "day_off" }], {
            onConflict: "technician_id,date",
          });

        if (error) {
          toast({
            title: "Error",
            description: "No se pudo marcar como no disponible.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "No disponible",
          description: `${dateKey} marcado como no disponible.`,
        });
      }

      try {
        await Promise.all([
          invalidateAssignmentQueries(),
          invalidateAvailabilityQueries?.() ?? Promise.resolve(),
        ]);
      } catch (error) {
        console.error("[matrix] Failed to invalidate availability caches", error);
        toast({
          title: "Aviso de sincronización",
          description: "La disponibilidad se guardó, pero no se pudo refrescar la caché local.",
          variant: "destructive",
        });
      }

      try {
        window.dispatchEvent(new CustomEvent("assignment-updated"));
      } catch (error) {
        console.error("[matrix] Failed to dispatch assignment-updated", error);
        toast({
          title: "Aviso de sincronización",
          description: "La disponibilidad se guardó, pero no se pudo notificar la actualización local.",
          variant: "destructive",
        });
      }
    },
    [getAvailabilityForCell, invalidateAssignmentQueries, invalidateAvailabilityQueries, toast],
  );

  const handleCellClick = useCallback(
    (technicianId: string, date: Date, action: MatrixCellActionType, selectedJobId?: string) => {
      const assignment = getAssignmentForCell(technicianId, date);
      const isFridge = fridgeSet?.has(technicianId);

      if (isFridge && FRIDGE_BLOCKED_ACTIONS.has(action)) {
        toast({
          title: "En la nevera",
          description: "Este técnico está en la nevera y no puede ser asignado.",
          variant: "destructive",
        });
        return;
      }

      if (!allowDirectAssign && (action === "select-job" || action === "assign")) {
        return;
      }

      if ((action === "unavailable" || action === "toggle-unavailable") && !isManagementUser) {
        toast({
          title: "Sin permiso",
          description: "Solo managers y administradores pueden marcar disponibilidad.",
          variant: "destructive",
        });
        return;
      }

      if (action === "availability-wa") {
        const targetJobId = selectedJobId || assignment?.job_id;
        if (targetJobId) {
          setAvailabilityDialog({
            open: true,
            jobId: targetJobId,
            profileId: technicianId,
            dateIso: formatStaffingDate(date),
            singleDay: true,
            channel: "whatsapp",
          });
        } else {
          setCellAction({
            type: "select-job-for-staffing",
            technicianId,
            date,
            assignment,
            intendedPhase: "availability",
            intendedChannel: "whatsapp",
          });
        }
        return;
      }

      if (action === "availability-email") {
        const targetJobId = selectedJobId || assignment?.job_id;
        if (targetJobId) {
          setAvailabilityDialog({
            open: true,
            jobId: targetJobId,
            profileId: technicianId,
            dateIso: formatStaffingDate(date),
            singleDay: true,
            channel: "email",
          });
        } else {
          setAvailabilityPreferredChannel("email");
          setCellAction({ type: "select-job-for-staffing", technicianId, date, assignment });
        }
        return;
      }

      if (action === "offer-details-wa") {
        const targetJobId = selectedJobId || assignment?.job_id;
        if (targetJobId) {
          setOfferChannel("whatsapp");
          setCellAction({ type: "offer-details", technicianId, date, assignment, selectedJobId: targetJobId });
        } else {
          setOfferPreferredChannel("whatsapp");
          setCellAction({ type: "select-job-for-staffing", technicianId, date, assignment });
        }
        return;
      }

      if (action === "offer-details-email") {
        const targetJobId = selectedJobId || assignment?.job_id;
        if (targetJobId) {
          setOfferChannel("email");
          setCellAction({ type: "offer-details", technicianId, date, assignment, selectedJobId: targetJobId });
        } else {
          setOfferPreferredChannel("email");
          setCellAction({ type: "select-job-for-staffing", technicianId, date, assignment });
        }
        return;
      }

      if (action === "toggle-unavailable") {
        void handleDirectToggleUnavailable(technicianId, date);
        return;
      }

      setCellAction({ type: action, technicianId, date, assignment, selectedJobId });
    },
    [allowDirectAssign, fridgeSet, getAssignmentForCell, handleDirectToggleUnavailable, isManagementUser, toast],
  );

  const handleJobSelected = useCallback((jobId: string) => {
    setCellAction((current) => {
      if (current?.type !== "select-job") return current;
      return {
        ...current,
        type: "assign",
        selectedJobId: jobId,
      };
    });
  }, []);

  const handleCellSelect = useCallback(
    (technicianId: string, date: Date, selected: boolean) => {
      const cellKey = buildMatrixCellKey(technicianId, date);

      setSelectedCells((current) => {
        const next = new Set(current);
        if (selected) {
          next.add(cellKey);
        } else {
          next.delete(cellKey);
        }
        return next;
      });

      if (selected) {
        selectCell(technicianId, date);
      } else if (isGlobalCellSelected(technicianId, date)) {
        clearGlobalSelection();
      }
    },
    [clearGlobalSelection, isGlobalCellSelected, selectCell],
  );

  const handleStaffingActionSelected = useCallback(
    (jobId: string, action: StaffingIntentPhase, options?: { singleDay?: boolean }) => {
      if (cellAction?.type !== "select-job-for-staffing") {
        return;
      }

      const declinedSet = declinedJobsByTech.get(cellAction.technicianId);
      if (declinedSet?.has(jobId)) {
        toast({
          title: "Trabajo ya rechazado",
          description: "Elige otro trabajo para este técnico en esta fecha.",
          variant: "destructive",
        });
        return;
      }

      if (action === "offer") {
        setOfferChannel(offerPreferredChannel ?? "email");
        setOfferPreferredChannel(null);
        setCellAction({
          ...cellAction,
          type: "offer-details",
          selectedJobId: jobId,
          singleDay: options?.singleDay,
        });
        return;
      }

      void (async () => {
        let result: Awaited<ReturnType<typeof checkTimeConflictEnhanced>>;
        try {
          result = await checkTimeConflictEnhanced(cellAction.technicianId, jobId, {
            targetDateIso: formatStaffingDate(cellAction.date),
            singleDayOnly: Boolean(options?.singleDay),
            includePending: true,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "No se pudo comprobar la disponibilidad.";
          toast({
            title: "Error al comprobar conflictos",
            description: message,
            variant: "destructive",
          });
          return;
        }

        if (result.hasHardConflict) {
          const conflict = result.hardConflicts[0];
          toast({
            title: "Conflicto de horarios",
            description: `Ya tiene confirmado: ${conflict.title} (${new Date(conflict.start_time || "").toLocaleString()} - ${new Date(conflict.end_time || "").toLocaleString()})`,
            variant: "destructive",
          });
          return;
        }

        const defaultChannel = cellAction.intendedChannel || availabilityPreferredChannel || "email";
        setAvailabilityDialog({
          open: true,
          jobId,
          profileId: cellAction.technicianId,
          dateIso: formatStaffingDate(cellAction.date),
          singleDay: Boolean(options?.singleDay),
          channel: defaultChannel,
        });
      })();
    },
    [availabilityPreferredChannel, cellAction, checkTimeConflictEnhanced, declinedJobsByTech, offerPreferredChannel, toast],
  );

  const handleCellPrefetch = useCallback(
    (technicianId: string) => {
      void prefetchTechnicianData(technicianId);
    },
    [prefetchTechnicianData],
  );

  const handleOptimisticUpdate = useCallback(
    (technicianId: string, jobId: string, status: string) => {
      updateAssignmentOptimistically(technicianId, jobId, status);
    },
    [updateAssignmentOptimistically],
  );

  const handleEmailError = useCallback(
    (error: unknown, payload: Record<string, unknown>) => {
      setAvailabilitySending(false);

      if (error instanceof ConflictError) {
        setConflictDialog({
          open: true,
          details: error.details as MatrixConflictDialogState["details"],
          originalPayload: payload,
        });
        return;
      }

      const message = error instanceof Error ? error.message : "No se pudo enviar la solicitud de staffing";
      toast({
        title: "Error al enviar",
        description: message,
        variant: "destructive",
      });
    },
    [toast],
  );

  useEffect(() => {
    if (!availabilityDialog?.open) return;

    setAvailabilityCoverage(availabilityDialog.singleDay ? "single" : "full");

    const selectedDatesForTechnician = Array.from(selectedCells)
      .filter((cellKey) => cellKey.startsWith(`${availabilityDialog.profileId}-`))
      .map((cellKey) => cellKey.slice(availabilityDialog.profileId.length + 1))
      .map((dateKey) => parseMatrixDateKey(dateKey))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((left, right) => left.getTime() - right.getTime());

    if (selectedDatesForTechnician.length > 1) {
      setAvailabilitySingleDate(null);
      setAvailabilityMultiDates(selectedDatesForTechnician);
      setAvailabilityCoverage("multi");
      return;
    }

    const clickedDate = availabilityDialog.dateIso ? parseMatrixDateKey(availabilityDialog.dateIso) : null;
    setAvailabilitySingleDate(clickedDate);
    setAvailabilityMultiDates(clickedDate ? [clickedDate] : []);
  }, [availabilityDialog, selectedCells]);

  return {
    selectedCells,
    cellAction,
    currentTechnician,
    closeDialogs,
    handleJobSelected,
    handleStaffingActionSelected,
    forcedStaffingAction,
    forcedStaffingChannel,
    availabilityDialog,
    setAvailabilityDialog,
    availabilityCoverage,
    setAvailabilityCoverage,
    availabilitySingleDate,
    setAvailabilitySingleDate,
    availabilityMultiDates,
    setAvailabilityMultiDates,
    availabilitySending,
    setAvailabilitySending,
    conflictDialog,
    setConflictDialog,
    handleEmailError,
    offerChannel,
    toast,
    sendStaffingEmail,
    checkTimeConflictEnhanced,
    handleCellSelect,
    handleCellClick,
    handleCellPrefetch,
    handleOptimisticUpdate,
  };
}
