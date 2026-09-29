import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  ALL_SECTIONS_ENABLED,
  type GearSection,
} from "@/components/festival/push-to-flex-pullsheet/model";
import { toast } from "@/hooks/use-toast";
import { trackError } from "@/lib/errorTracking";
import { getJobPullsheetsWithFlexApi, pushEquipmentToPullsheet } from "@/services/flexPullsheets";
import type { GearSetupFormData } from "@/types/festival-gear";
import { extractFlexElementId } from "@/utils/flexUrlParser";
import { getErrorMessage } from "@/utils/errorMessage";
import { fetchFlexResourceIdsByName, fetchPresetItems, fetchSoundPresets } from "../api";
import { festivalFlexKeys } from "../keys";
import {
  collectGearLines,
  gearModelNames,
  matchGearToResources,
  matchPresetToResources,
  mergeEquipmentToPush,
} from "../pullsheetEquipment";

interface Options {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gearSetup: GearSetupFormData;
  jobId: string;
}

type InputMode = "select" | "url";

export interface PushOutcome {
  succeeded: number;
  failed: Array<{ name: string; error: string }>;
}

const CLOSE_AFTER_SUCCESS_MS = 2000;

/** Tells the user (once per failure) that something the dialog needs could not be loaded. */
function useLoadErrorToast(error: unknown, operation: string, description: string, jobId: string) {
  useEffect(() => {
    if (!error) return;
    void trackError(error, { system: "festivals", operation, jobId });
    toast({ title: "Error", description, variant: "destructive" });
  }, [error, operation, description, jobId]);
}

/**
 * State of the "push gear to a Flex pullsheet" dialog: which pullsheet, which sections and PA
 * preset, what would be pushed, and the push itself. Everything derivable is derived, not synced.
 */
export function usePushToFlexPullsheet({ open, onOpenChange, gearSetup, jobId }: Options) {
  const [sections, setSections] = useState<Record<GearSection, boolean>>({ ...ALL_SECTIONS_ENABLED });
  const [includePaPreset, setIncludePaPreset] = useState(false);
  const [paPresetId, setPaPresetId] = useState<string | null>(null);
  // What the user chose; until they choose, the loaded pullsheets decide (see below).
  const [chosenMode, setChosenMode] = useState<InputMode | null>(null);
  const [chosenPullsheetId, setChosenPullsheetId] = useState<string | null>(null);
  const [pullsheetUrl, setPullsheetUrl] = useState("");
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushOutcome | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  // Closing the dialog (by any path) starts the next opening from scratch.
  useEffect(() => {
    if (open) return;
    setSections({ ...ALL_SECTIONS_ENABLED });
    setIncludePaPreset(false);
    setPaPresetId(null);
    setChosenMode(null);
    setChosenPullsheetId(null);
    setPullsheetUrl("");
    setPushResult(null);
  }, [open]);

  // --- Target pullsheet ---------------------------------------------------------------------
  const pullsheetsQuery = useQuery({
    queryKey: festivalFlexKeys.pullsheets(jobId),
    queryFn: () => getJobPullsheetsWithFlexApi(jobId),
    enabled: open && !!jobId,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const pullsheets = pullsheetsQuery.data ?? [];

  const mode: InputMode = chosenMode ?? (pullsheets.length > 0 ? "select" : "url");
  // A single pullsheet is selected for the user.
  const selectedPullsheetId = chosenPullsheetId ?? (pullsheets.length === 1 ? pullsheets[0].element_id : null);
  const urlElementId = extractFlexElementId(pullsheetUrl);
  const elementId = mode === "select" ? selectedPullsheetId : urlElementId;
  const isValidUrl = urlElementId !== null;

  // --- PA preset ----------------------------------------------------------------------------
  const presetsQuery = useQuery({
    queryKey: festivalFlexKeys.presets(jobId),
    queryFn: () => fetchSoundPresets(jobId),
    enabled: open && !!jobId,
  });
  const presetItemsQuery = useQuery({
    queryKey: festivalFlexKeys.presetItems(paPresetId),
    queryFn: () => fetchPresetItems(paPresetId!),
    enabled: open && includePaPreset && !!paPresetId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // --- Gear ---------------------------------------------------------------------------------
  const gearLines = useMemo(() => collectGearLines(gearSetup, sections), [gearSetup, sections]);
  const modelNames = useMemo(() => gearModelNames(gearLines), [gearLines]);
  const resourcesQuery = useQuery({
    queryKey: festivalFlexKeys.resourceIds(modelNames),
    queryFn: () => fetchFlexResourceIdsByName(modelNames),
    enabled: open && modelNames.length > 0,
    // The Flex mapping is edited elsewhere; never push against a stale one.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const gearLookup = useMemo(
    () => (resourcesQuery.data ? matchGearToResources(gearLines, resourcesQuery.data) : null),
    [gearLines, resourcesQuery.data],
  );
  const presetLookup = useMemo(
    () => (includePaPreset && presetItemsQuery.data ? matchPresetToResources(presetItemsQuery.data) : null),
    [includePaPreset, presetItemsQuery.data],
  );
  const equipmentToPush = useMemo(
    () => mergeEquipmentToPush(gearLookup?.found ?? [], includePaPreset ? (presetLookup?.found ?? []) : []),
    [gearLookup, includePaPreset, presetLookup],
  );

  useLoadErrorToast(pullsheetsQuery.error, "flex-pullsheets-load", "No se pudieron cargar los pullsheets de este trabajo", jobId);
  useLoadErrorToast(presetsQuery.error, "flex-pa-presets-load", "No se pudieron cargar los presets de PA", jobId);
  useLoadErrorToast(presetItemsQuery.error, "flex-preset-items-load", "No se pudo consultar el equipo del preset", jobId);
  useLoadErrorToast(resourcesQuery.error, "flex-resources-load", "No se pudo consultar el equipo en la base de datos", jobId);

  const isLookingUp = resourcesQuery.isFetching || presetItemsQuery.isFetching;

  // --- Actions ------------------------------------------------------------------------------
  const toggleSection = (key: GearSection) => setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const setPaPresetEnabled = (enabled: boolean) => {
    setIncludePaPreset(enabled);
    setPaPresetId(null);
  };

  const canPush =
    !!elementId && equipmentToPush.length > 0 && !isPushing && (mode === "select" ? !!selectedPullsheetId : isValidUrl);

  const push = async () => {
    if (!elementId || equipmentToPush.length === 0) return;

    setIsPushing(true);
    setPushResult(null);
    try {
      const result = await pushEquipmentToPullsheet(elementId, equipmentToPush);
      setPushResult(result);

      if (result.failed.length === 0) {
        toast({ title: "Éxito", description: `Se enviaron ${result.succeeded} artículos al pullsheet de Flex` });
        closeTimer.current = setTimeout(() => onOpenChange(false), CLOSE_AFTER_SUCCESS_MS);
      } else if (result.succeeded > 0) {
        toast({
          title: "Éxito parcial",
          description: `Se enviaron ${result.succeeded} artículos, ${result.failed.length} fallaron`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: "No se pudo enviar ningún artículo a Flex", variant: "destructive" });
      }
    } catch (error) {
      void trackError(error, { system: "festivals", operation: "flex-pullsheet-push", jobId });
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo enviar el equipo a Flex"),
        variant: "destructive",
      });
    } finally {
      setIsPushing(false);
    }
  };

  const close = () => {
    if (!isPushing) onOpenChange(false);
  };

  return {
    // target
    mode,
    setMode: setChosenMode,
    pullsheets,
    isLoadingPullsheets: pullsheetsQuery.isLoading,
    selectedPullsheetId,
    setSelectedPullsheetId: setChosenPullsheetId,
    pullsheetUrl,
    setPullsheetUrl,
    isValidUrl,
    elementId,
    // what to push
    sections,
    toggleSection,
    includePaPreset,
    setPaPresetEnabled,
    paPresets: presetsQuery.data ?? [],
    isLoadingPaPresets: presetsQuery.isLoading,
    paPresetId,
    setPaPresetId,
    gearLookup,
    presetLookup,
    equipmentToPush,
    isLookingUp,
    // push
    canPush,
    isPushing,
    pushResult,
    push,
    close,
  };
}
