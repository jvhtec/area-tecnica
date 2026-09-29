import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { trackError } from "@/lib/errorTracking";
import type { GearSetupFormData } from "@/types/festival-gear";
import { fetchGearSetupState, saveGlobalGearSetup, saveStageGearSetup } from "../api";
import { festivalGearKeys } from "../keys";
import { buildEmptyGearFormData } from "../model";

interface UseGearSetupFormOptions {
  jobId: string;
  stageNumber: number;
  readOnly: boolean;
  onSave?: () => void;
}

/**
 * State of the gear setup form for one stage: loads the saved setup, holds the edits, and saves.
 *
 * Server data only replaces the form when the stage changes or while nothing has been edited, so
 * a realtime refetch can never wipe what someone is typing.
 */
export function useGearSetupForm({ jobId, stageNumber, readOnly, onSave }: UseGearSetupFormOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isPrimaryStage = stageNumber === 1;

  const query = useQuery({
    queryKey: festivalGearKeys.setup(jobId, stageNumber),
    queryFn: () => fetchGearSetupState(jobId, stageNumber),
    enabled: !!jobId,
    // The form must not follow refetches on its own (see above).
    refetchOnWindowFocus: false,
  });

  const [setup, setSetup] = useState<GearSetupFormData>(buildEmptyGearFormData());
  const [isDirty, setIsDirty] = useState(false);
  const seededKey = useRef<string | null>(null);

  const stageKey = `${jobId}:${stageNumber}`;
  useEffect(() => {
    if (!query.data) return;
    const stageChanged = seededKey.current !== stageKey;
    if (!stageChanged && isDirty) return;
    seededKey.current = stageKey;
    setSetup(query.data.form);
    setIsDirty(false);
  }, [query.data, stageKey, isDirty]);

  useEffect(() => {
    if (!query.error) return;
    void trackError(query.error, { system: "festivals", operation: "load-festival-gear-setup", jobId });
    toast({
      title: "Error",
      description: "Error al cargar la configuración de equipamiento.",
      variant: "destructive",
    });
  }, [query.error, jobId, toast]);

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (isPrimaryStage) {
        await saveGlobalGearSetup(setup, jobId, query.data?.gearSetupId ?? null);
      } else {
        await saveStageGearSetup(setup, jobId, stageNumber);
      }
    },
    onSuccess: async () => {
      setIsDirty(false);
      await queryClient.invalidateQueries({ queryKey: festivalGearKeys.all(jobId) });
      onSave?.();
      toast({
        title: "Éxito",
        description: isPrimaryStage
          ? "La configuración de equipamiento global ha sido guardada."
          : `La configuración de Stage ${stageNumber} ha sido guardada.`,
      });
    },
    onError: (error) => {
      void trackError(error, { system: "festivals", operation: "save-festival-gear-setup", jobId });
      toast({
        title: "Error",
        description: "Error al guardar la configuración de equipamiento del festival.",
        variant: "destructive",
      });
    },
  });

  const handleChange = (changes: Partial<GearSetupFormData>) => {
    if (readOnly) return;
    setIsDirty(true);
    setSetup((previous) => ({ ...previous, ...changes }));
  };

  const save = () => {
    if (readOnly) return;
    saveMutation.mutate();
  };

  return {
    setup,
    handleChange,
    save,
    isLoading: query.isLoading || saveMutation.isPending,
    isSaving: saveMutation.isPending,
    gearSetupId: query.data?.gearSetupId ?? null,
    globalSetup: query.data?.globalSetup ?? null,
    /** True when this non-primary stage already has its own override saved. */
    hasStageSpecificSetup: !!query.data?.stageSetupId,
  };
}
