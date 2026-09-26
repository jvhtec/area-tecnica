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
  commitImageSave: () => Promise<void>;
  setLastSaveTime: React.Dispatch<React.SetStateAction<number>>;
  markSaved: () => void;
  onSavedVersion: (version: number) => void;
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
  commitImageSave,
  setLastSaveTime,
  markSaved,
  onSavedVersion,
}: UseHojaDeRutaSaveOptions) => {
  const { toast } = useToast();
  const saveInProgressRef = useRef(false);

  const handleSaveAll = useCallback(async () => {
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
      const images = await prepareImagesForSave(selectedJobId);
      const saved = await saveAll({
        eventData,
        travelArrangements,
        accommodations,
        images,
        expectedVersion,
      });

      onSavedVersion(saved.document_version);
      await commitImageSave();
      setLastSaveTime(Date.now());
      markSaved();

      toast({
        title: "Guardado",
        description: "La Hoja de Ruta se ha guardado correctamente.",
      });
    } catch (error: unknown) {
      const isConflict = errorCode(error) === "40001";
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
    markSaved,
    onSavedVersion,
    prepareImagesForSave,
    saveAll,
    selectedJobId,
    setLastSaveTime,
    toast,
    travelArrangements,
  ]);

  return {
    handleSaveAll,
    saveInProgress: saveInProgressRef.current,
  };
};
