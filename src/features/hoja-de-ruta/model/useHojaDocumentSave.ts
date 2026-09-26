import { useCallback, useRef } from "react";

import { useToast } from "@/hooks/use-toast";
import type {
  Accommodation,
  EventData,
  HojaDeRutaImageRecord,
  TravelArrangement,
} from "@/types/hoja-de-ruta";
import { getErrorMessage } from "@/utils/errorMessage";
import type { HojaDocumentSaveInput } from "@/features/hoja-de-ruta/model/HojaDocument";
import { HojaDocumentValidationError } from "@/features/hoja-de-ruta/model/useHojaValidation";

type AtomicSave = (payload: HojaDocumentSaveInput) => Promise<{
  id: string;
  document_version: number;
}>;

type UseHojaDeRutaSaveOptions = {
  selectedJobId: string;
  eventData: EventData;
  travelArrangements: TravelArrangement[];
  accommodations: Accommodation[];
  expectedVersion: number;
  saveAll: AtomicSave;
  prepareImagesForSave: (jobId: string) => Promise<HojaDeRutaImageRecord[]>;
  getRemovedImageIds: () => string[];
  commitImageSave: () => Promise<void>;
  setLastSaveTime: React.Dispatch<React.SetStateAction<number>>;
  markSaved: () => void;
  onSavedVersion: (version: number) => void;
  onConflict: () => void;
  validateBeforeSave: () => Promise<boolean>;
};

const errorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value : undefined;
};

export const useHojaDocumentSave = ({
  selectedJobId,
  eventData,
  travelArrangements,
  accommodations,
  expectedVersion,
  saveAll,
  prepareImagesForSave,
  getRemovedImageIds,
  commitImageSave,
  setLastSaveTime,
  markSaved,
  onSavedVersion,
  onConflict,
  validateBeforeSave,
}: UseHojaDeRutaSaveOptions) => {
  const { toast } = useToast();
  const saveInProgressRef = useRef(false);

  const handleSaveAll = useCallback(async (options?: { expectedVersion?: number }) => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "No hay trabajo seleccionado para guardar.",
        variant: "destructive",
      });
      return;
    }

    if (saveInProgressRef.current) return;

    saveInProgressRef.current = true;
    try {
      await validateBeforeSave();
      const images = await prepareImagesForSave(selectedJobId);
      const saved = await saveAll({
        eventData,
        travelArrangements,
        accommodations,
        images,
        removedImageIds: getRemovedImageIds(),
        expectedVersion: options?.expectedVersion ?? expectedVersion,
      });

      onSavedVersion(saved.document_version);
      await commitImageSave();
      setLastSaveTime(Date.now());
      markSaved();

      toast({
        title: "Guardado",
        description: "La Hoja de Ruta se ha guardado correctamente.",
      });
      return saved;
    } catch (error: unknown) {
      if (error instanceof HojaDocumentValidationError) {
        toast({
          title: "Revisa la Hoja de Ruta",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
      const isConflict = errorCode(error) === "40001";
      if (isConflict) onConflict();
      const message = isConflict
        ? "Otra persona ha guardado cambios en esta Hoja de Ruta. Recarga los datos antes de sobrescribirlos."
        : getErrorMessage(error, "No se pudo guardar la Hoja de Ruta.");

      toast({
        title: isConflict ? "Conflicto de edición" : "Error al guardar",
        description: message,
        variant: "destructive",
      });
      throw error;
    } finally {
      saveInProgressRef.current = false;
    }
  }, [
    accommodations,
    commitImageSave,
    eventData,
    expectedVersion,
    getRemovedImageIds,
    markSaved,
    onSavedVersion,
    onConflict,
    prepareImagesForSave,
    saveAll,
    selectedJobId,
    setLastSaveTime,
    toast,
    travelArrangements,
    validateBeforeSave,
  ]);

  return {
    handleSaveAll,
    saveInProgress: saveInProgressRef.current,
  };
};
