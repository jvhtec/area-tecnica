import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/hooks/use-toast";
import { useJobSelection } from "@/hooks/useJobSelection";
import type {
  Accommodation,
  EventData,
  HojaDeRutaImageRecord,
  TravelArrangement,
} from "@/types/hoja-de-ruta";
import { getErrorMessage } from "@/utils/errorMessage";
import { createHojaDocumentSnapshot } from "@/utils/hoja-de-ruta/documentSnapshot";
import {
  mergeStaffWithAssignments,
  remapAccommodationStaffReferences,
} from "@/utils/hoja-de-ruta/staffSync";

import { useHojaCollectionEditors } from "@/features/hoja-de-ruta/model/useHojaCollectionEditors";
import { useHojaDocumentInitialization } from "@/features/hoja-de-ruta/model/useHojaDocumentInitialization";
import { useHojaDocumentRealtime } from "@/features/hoja-de-ruta/model/useHojaDocumentRealtime";
import { useHojaDocumentSave } from "@/features/hoja-de-ruta/model/useHojaDocumentSave";
import { toHojaStatus } from "@/features/hoja-de-ruta/api/hojaDocumentApi";
import { useHojaDocumentPersistence } from "@/features/hoja-de-ruta/api/useHojaDocumentPersistence";
import { useHojaDocumentState } from "@/features/hoja-de-ruta/model/useHojaDocumentState";
import { useHojaValidation } from "@/features/hoja-de-ruta/model/useHojaValidation";

export type UseHojaDocumentOptions = {
  prepareImagesForSave: (jobId: string) => Promise<HojaDeRutaImageRecord[]>;
  hydratePersistedImages: (
    jobId: string,
    rows: HojaDeRutaImageRecord[] | null | undefined,
    options?: { force?: boolean },
  ) => Promise<void>;
  getRemovedImageIds: () => string[];
  commitImageSave: () => Promise<void>;
  isImageDirty: boolean;
};

export const useHojaDocument = (
  jobId: string | undefined,
  {
    prepareImagesForSave,
    hydratePersistedImages,
    getRemovedImageIds,
    commitImageSave,
    isImageDirty,
  }: UseHojaDocumentOptions,
) => {
  const { toast } = useToast();
  const {
    eventData,
    setEventData,
    travelArrangements,
    setTravelArrangements,
    accommodations,
    setAccommodations,
    selectedJobId,
    setSelectedJobId,
    isInitialized,
    setIsInitialized,
  } = useHojaDocumentState();

  const { data: jobs, isLoading: isLoadingJobs } = useJobSelection(selectedJobId);

  useEffect(() => {
    if (jobId && selectedJobId !== jobId) {
      setSelectedJobId(jobId);
    }
  }, [jobId, selectedJobId, setSelectedJobId]);

  const [hasSavedData, setHasSavedData] = useState(false);
  const [hasBasicJobData, setHasBasicJobData] = useState(false);
  const [dataSource, setDataSource] = useState<"none" | "saved" | "job" | "mixed">("none");
  const [lastSaveTime, setLastSaveTime] = useState(0);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [hasExternalConflict, setHasExternalConflict] = useState(false);
  const [staffingDiff, setStaffingDiff] = useState({ added: 0, removed: 0 });
  const [hasPowerDrift, setHasPowerDrift] = useState(false);

  const {
    hojaDeRuta,
    isLoading: isLoadingHojaDeRuta,
    isFetching: isFetchingHojaDeRuta,
    fetchError,
    saveAll,
    isSaving,
    setStatus,
    reopen,
    isChangingStatus,
    forceRefetch,
  } = useHojaDocumentPersistence(selectedJobId);
  const staffRef = useRef(eventData.staff);
  const documentVersionRef = useRef(documentVersion);
  const isSavingRef = useRef(isSaving);
  const isChangingStatusRef = useRef(isChangingStatus);
  staffRef.current = eventData.staff;
  documentVersionRef.current = documentVersion;
  isSavingRef.current = isSaving;
  isChangingStatusRef.current = isChangingStatus;

  const {
    autoPopulateBasicJobData,
    loadCurrentJobAssignments,
    fetchPowerRequirements,
  } = useHojaDocumentInitialization(
    selectedJobId,
    hojaDeRuta,
    isLoadingHojaDeRuta || isFetchingHojaDeRuta,
    isInitialized,
    setEventData,
    setTravelArrangements,
    setAccommodations,
    setIsInitialized,
    setHasSavedData,
    setHasBasicJobData,
    setDataSource,
  );

  const snapshot = useMemo(
    () => createHojaDocumentSnapshot(eventData, travelArrangements, accommodations),
    [eventData, travelArrangements, accommodations],
  );
  const savedSnapshotRef = useRef<string | null>(null);
  const baselineJobRef = useRef("");
  const awaitingInitRef = useRef(false);

  useEffect(() => {
    if (baselineJobRef.current === selectedJobId) return;
    baselineJobRef.current = selectedJobId;
    savedSnapshotRef.current = null;
    awaitingInitRef.current = Boolean(selectedJobId);
    setDocumentVersion(0);
    setHasExternalConflict(false);
    setStaffingDiff({ added: 0, removed: 0 });
    setHasPowerDrift(false);
    setHasSavedData(false);
    setHasBasicJobData(false);
    setDataSource("none");
    setLastSaveTime(0);
    if (selectedJobId) void forceRefetch();
  }, [forceRefetch, selectedJobId]);

  useEffect(() => {
    if (!isInitialized) {
      awaitingInitRef.current = false;
      return;
    }
    if (awaitingInitRef.current || savedSnapshotRef.current !== null) return;
    savedSnapshotRef.current = snapshot;
    setDocumentVersion(Number(hojaDeRuta?.document_version || 0));
  }, [hojaDeRuta?.document_version, isInitialized, snapshot]);

  const markSaved = useCallback(() => {
    savedSnapshotRef.current = snapshot;
    setHasExternalConflict(false);
    setHasSavedData(true);
  }, [snapshot]);

  const isDirty = Boolean(
    isInitialized
    && savedSnapshotRef.current !== null
    && (savedSnapshotRef.current !== snapshot || isImageDirty),
  );

  const validation = useHojaValidation(eventData, travelArrangements, accommodations);

  const documentStatus = toHojaStatus(hojaDeRuta?.status);
  const isFinal = documentStatus === "final";

  const { handleSaveAll } = useHojaDocumentSave({
    selectedJobId,
    eventData,
    travelArrangements,
    accommodations,
    expectedVersion: documentVersion,
    saveAll,
    prepareImagesForSave,
    getRemovedImageIds,
    commitImageSave,
    setLastSaveTime,
    markSaved,
    onSavedVersion: setDocumentVersion,
    onConflict: () => setHasExternalConflict(true),
    validateBeforeSave: validation.validateDocument,
    isApproved: documentStatus === "approved",
  });

  const handleStatusTransition = useCallback(async (
    nextStatus: "review" | "approved" | "final",
  ) => {
    if (!selectedJobId) return;
    if (hasExternalConflict) {
      toast({
        title: "Conflicto de edición",
        description: "Recarga la versión más reciente antes de cambiar el estado.",
        variant: "destructive",
      });
      return;
    }

    try {
      await validation.validateDocument();
    } catch {
      toast({
        title: "Revisa la Hoja de Ruta",
        description: "Corrige los campos indicados antes de cambiar el estado.",
        variant: "destructive",
      });
      return;
    }

    let expectedStatusVersion = documentVersionRef.current;
    if (isDirty || !hojaDeRuta?.id) {
      try {
        const saved = await handleSaveAll();
        if (!saved) return;
        expectedStatusVersion = saved.document_version;
      } catch {
        return;
      }
    }

    let updated: Awaited<ReturnType<typeof setStatus>>;
    try {
      updated = await setStatus({
        status: nextStatus,
        expectedVersion: expectedStatusVersion,
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "40001") {
        setHasExternalConflict(true);
      }
      toast({
        title: "No se pudo cambiar el estado",
        description: getErrorMessage(error, "Inténtalo de nuevo."),
        variant: "destructive",
      });
      return;
    }
    setDocumentVersion(updated.document_version);
    setHasExternalConflict(false);

    const labels = {
      review: "En revisión",
      approved: "Aprobada",
      final: "Final",
    } as const;
    toast({
      title: labels[nextStatus],
      description:
        nextStatus === "review"
          ? "La Hoja de Ruta está lista para revisión."
          : nextStatus === "approved"
            ? "La Hoja de Ruta puede publicarse para el equipo."
            : "La Hoja de Ruta se ha finalizado y queda bloqueada para edición.",
    });
  }, [
    handleSaveAll,
    hasExternalConflict,
    hojaDeRuta?.id,
    isDirty,
    selectedJobId,
    setStatus,
    toast,
    validation,
  ]);

  const handleReopen = useCallback(async (reason: string) => {
    if (!selectedJobId) return false;
    if (hasExternalConflict) {
      toast({
        title: "Conflicto de edición",
        description: "Recarga la versión más reciente antes de reabrir la Hoja de Ruta.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const updated = await reopen({
        reason,
        expectedVersion: documentVersionRef.current,
      });
      setDocumentVersion(updated.document_version);
      setHasExternalConflict(false);
      toast({
        title: "Hoja de Ruta reabierta",
        description: "Vuelve a estar en borrador. El cambio queda registrado con su motivo.",
      });
      return true;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "40001") {
        setHasExternalConflict(true);
      }
      toast({
        title: "No se pudo reabrir",
        description: getErrorMessage(error, "Inténtalo de nuevo."),
        variant: "destructive",
      });
      return false;
    }
  }, [hasExternalConflict, reopen, selectedJobId, toast]);

  useEffect(() => {
    if (!fetchError) return;
    toast({
      title: "Error",
      description: "No se pudieron cargar los datos guardados. Inténtalo de nuevo.",
      variant: "destructive",
    });
  }, [fetchError, toast]);

  const checkStaffingDiff = useCallback(async () => {
    if (!selectedJobId || !isInitialized) return;
    const assignmentData = await loadCurrentJobAssignments(selectedJobId);
    if (!assignmentData) return;

    const currentIds = new Set(
      assignmentData.staffFromAssignments
        .map((entry) => entry.technician_id)
        .filter((id): id is string => Boolean(id)),
    );
    const documentIds = new Set(
      staffRef.current
        .map((entry) => entry.technician_id)
        .filter((id): id is string => Boolean(id)),
    );

    setStaffingDiff({
      added: Array.from(currentIds).filter((id) => !documentIds.has(id)).length,
      removed: Array.from(documentIds).filter((id) => !currentIds.has(id)).length,
    });
  }, [isInitialized, loadCurrentJobAssignments, selectedJobId]);

  const applyStaffingChanges = useCallback(async () => {
    if (!selectedJobId) return;
    const assignmentData = await loadCurrentJobAssignments(selectedJobId);
    if (!assignmentData) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las asignaciones actuales.",
        variant: "destructive",
      });
      return;
    }

    const savedStaff = eventData.staff;
    const merged = mergeStaffWithAssignments(
      savedStaff,
      assignmentData.staffFromAssignments,
    );

    setEventData((prev) => ({ ...prev, staff: merged.staff }));
    setAccommodations((prev) =>
      remapAccommodationStaffReferences(
        prev,
        savedStaff,
        merged.savedIndexMap,
        merged.staff,
      )
    );
    setStaffingDiff({ added: 0, removed: 0 });
  }, [
    eventData.staff,
    loadCurrentJobAssignments,
    selectedJobId,
    setAccommodations,
    setEventData,
    toast,
  ]);

  const checkPowerDrift = useCallback(async () => {
    if (!selectedJobId || !isInitialized) return;
    const current = await fetchPowerRequirements(selectedJobId);
    if (!current.sourceUpdatedAt) {
      setHasPowerDrift(false);
      return;
    }

    const representedRevision = eventData.powerRequirementsSourceUpdatedAt
      ? Date.parse(eventData.powerRequirementsSourceUpdatedAt)
      : NaN;
    const currentRevision = Date.parse(current.sourceUpdatedAt);
    const missingSnapshot = !Number.isFinite(representedRevision);
    const sourceIsNewer = Number.isFinite(currentRevision)
      && Number.isFinite(representedRevision)
      && currentRevision > representedRevision;

    setHasPowerDrift(Boolean(current.text) && (missingSnapshot || sourceIsNewer));
  }, [
    eventData.powerRequirementsSourceUpdatedAt,
    fetchPowerRequirements,
    isInitialized,
    selectedJobId,
  ]);

  const applyPowerRequirementsChanges = useCallback(async () => {
    if (!selectedJobId) return;
    const current = await fetchPowerRequirements(selectedJobId);
    setEventData((prev) => ({
      ...prev,
      powerRequirements: current.text,
      powerRequirementsSourceUpdatedAt: current.sourceUpdatedAt,
    }));
    setHasPowerDrift(false);
  }, [fetchPowerRequirements, selectedJobId, setEventData]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  // Detect a newer document version written by another editor, Tour Ops or a
  // crew change. The RPC remains the final authority and rejects stale writes
  // with SQLSTATE 40001.
  const handleRemoteVersion = useCallback((nextVersion: number) => {
    if (
      isSavingRef.current
      || isChangingStatusRef.current
      || nextVersion <= documentVersionRef.current
    ) {
      return;
    }
    setHasExternalConflict(true);
    toast({
      title: "Cambios externos",
      description: "Otra persona ha guardado una versión más reciente de esta Hoja de Ruta.",
      variant: "destructive",
    });
  }, [toast]);

  useHojaDocumentRealtime({
    jobId: selectedJobId,
    enabled: isInitialized,
    onStaffingChange: () => { void checkStaffingDiff(); },
    onPowerChange: () => { void checkPowerDrift(); },
    onRemoteVersion: handleRemoteVersion,
  });

  const editors = useHojaCollectionEditors({
    staff: eventData.staff,
    setEventData,
    setTravelArrangements,
    setAccommodations,
  });

  const reloadLatest = useCallback(async () => {
    savedSnapshotRef.current = null;
    setHasExternalConflict(false);
    setIsInitialized(false);
    const latest = await forceRefetch();
    if (selectedJobId) {
      await hydratePersistedImages(selectedJobId, latest.data?.images || [], { force: true });
    }
  }, [forceRefetch, hydratePersistedImages, selectedJobId, setIsInitialized]);

  const overwriteWithLocalChanges = useCallback(async () => {
    const latest = await forceRefetch();
    const latestVersion = Number(latest.data?.document_version ?? documentVersionRef.current);
    const saved = await handleSaveAll({ expectedVersion: latestVersion });
    if (saved) setHasExternalConflict(false);
  }, [forceRefetch, handleSaveAll]);

  return {
    eventData,
    setEventData,
    selectedJobId,
    setSelectedJobId,
    travelArrangements,
    setTravelArrangements,
    accommodations,
    setAccommodations,
    isLoadingJobs,
    isLoadingHojaDeRuta,
    isSaving,
    isChangingStatus,
    jobs,
    hojaDeRuta,
    handleSaveAll,
    autoPopulateFromJob: autoPopulateBasicJobData,
    autoPopulateBasicJobData,
    refreshData: forceRefetch,
    reloadLatest,
    overwriteWithLocalChanges,
    isInitialized,
    hasSavedData,
    hasBasicJobData,
    dataSource,
    isDirty,
    hasExternalConflict,
    documentStatus,
    isFinal,
    handleStatusTransition,
    handleReopen,
    staffingDiff,
    applyStaffingChanges,
    hasPowerDrift,
    applyPowerRequirementsChanges,
    documentVersion,
    validation,
    ...editors,
    fetchError,
    lastSaveTime,
  };
};
