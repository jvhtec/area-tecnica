import { useState, useCallback } from 'react';
import { useHojaDeRutaData } from './useHojaDeRutaData';
import { EventData, TravelArrangement, Accommodation } from '@/types/hoja-de-ruta';

export const useHojaDeRutaPersistence = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { saveHojaDeRuta, isLoading: isSavingToDb } = useHojaDeRutaData();

  const saveData = useCallback(async (
    jobId: string,
    eventData: EventData,
    travelArrangements: TravelArrangement[],
    accommodations: Accommodation[]
  ) => {
    if (!jobId) return null;

    setIsSaving(true);
    try {
      const result = await saveHojaDeRuta(jobId, eventData, travelArrangements, accommodations);
      setLastSaved(new Date());
      return result;
    } catch (error) {
      console.error('Error saving hoja de ruta:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [saveHojaDeRuta]);

  return {
    saveData,
    isSaving: isSaving || isSavingToDb,
    lastSaved
  };
};