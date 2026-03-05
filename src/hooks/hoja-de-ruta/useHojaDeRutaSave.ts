import { useCallback, useEffect, useRef } from 'react';
import { EventData, TravelArrangement, Accommodation } from '@/types/hoja-de-ruta';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

type SaveHojaDeRutaFn = (args: { eventData: EventData; userId: string }) => Promise<unknown>;
type SaveTravelArrangementsFn = (travel: TravelArrangement[]) => Promise<unknown>;
type SaveAccommodationsFn = (accommodations: Accommodation[]) => Promise<unknown>;
type SaveVenueImagesFn = (images: { image_path: string; image_type: string }[]) => Promise<unknown>;

const debounce = <T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      callback(...args);
    }, delay);
  };
};

export const useHojaDeRutaSave = (
  selectedJobId: string,
  eventData: EventData,
  travelArrangements: TravelArrangement[],
  accommodations: Accommodation[],
  saveHojaDeRuta: SaveHojaDeRutaFn,
  saveTravelArrangements: SaveTravelArrangementsFn,
  saveAccommodations: SaveAccommodationsFn,
  saveVenueImages: SaveVenueImagesFn,
  venueImages: { image_path: string; image_type: string }[],
  isSaving: boolean,
  isSavingTravel: boolean,
  setLastSaveTime: React.Dispatch<React.SetStateAction<number>>
) => {
  const { toast } = useToast();
  const saveInProgressRef = useRef<boolean>(false);
  const lastSaveDataRef = useRef<string>("");
  const debouncedSaveRef = useRef<(() => void) | null>(null);

  // Enhanced function to fetch and merge additional job data (power requirements)
  const autoPopulateFromJob = useCallback(async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "No hay trabajo seleccionado para auto-completar.",
        variant: "destructive",
      });
      return;
    }

    console.log("🔄 SAVE: Auto-populating additional job data (power requirements) for:", selectedJobId);
    
    try {
      // Fetch power requirements
      const { data: powerRequirements, error: powerError } = await supabase
        .from("power_requirement_tables")
        .select("*")
        .eq("job_id", selectedJobId);

      if (powerError) throw powerError;

      // Always update power requirements if available
      if (powerRequirements && powerRequirements.length > 0) {
        console.log("⚡ SAVE: Updating power requirements");
        const powerText = powerRequirements
          .map((req: {
            department?: string | null;
            table_name?: string | null;
            total_watts?: number | string | null;
            current_per_phase?: number | string | null;
            pdu_type?: string | null;
          }) => {
            const department = (req.department || 'general').toUpperCase();
            return `${department} - ${req.table_name || 'tabla'}:\n` +
              `Potencia Total: ${req.total_watts ?? 'N/D'}W\n` +
              `Corriente por Fase: ${req.current_per_phase ?? 'N/D'}A\n` +
              `PDU Recomendado: ${req.pdu_type ?? 'N/D'}\n`;
          })
          .join("\n");

        return { powerRequirements: powerText };
      }
      
      console.log("✅ SAVE: Power requirements loaded successfully");
      return { powerRequirements: eventData.powerRequirements };
    } catch (error: unknown) {
      console.error("❌ SAVE: Error auto-populating from job:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos adicionales del trabajo.",
        variant: "destructive",
      });
      throw error;
    }
  }, [selectedJobId, eventData.powerRequirements, toast]);

  // Comprehensive save function that saves all form data
  const handleSaveAll = useCallback(async () => {
    console.log("🔍 DEBUG: handleSaveAll called with:", {
      selectedJobId,
      saveHojaDeRuta: typeof saveHojaDeRuta,
      saveTravelArrangements: typeof saveTravelArrangements,
      saveAccommodations: typeof saveAccommodations
    });

    if (!selectedJobId) {
      console.log("❌ SAVE: No job selected");
      toast({
        title: "Error",
        description: "No hay trabajo seleccionado para guardar.",
        variant: "destructive",
      });
      return;
    }

    // Prevent concurrent saves
    if (saveInProgressRef.current) {
      console.log("⚠️ SAVE: Save already in progress, skipping");
      return;
    }

    const currentDataSignature = JSON.stringify({
      eventData,
      travelArrangements,
      accommodations,
      venueImages,
      selectedJobId
    });

    // Skip save if data hasn't changed
    if (lastSaveDataRef.current === currentDataSignature) {
      console.log("⏭️ SAVE: Data unchanged, skipping save");
      return;
    }

    saveInProgressRef.current = true;
    console.log("💾 SAVE: Starting comprehensive save for job:", selectedJobId);

    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuario no autenticado");
      }

      console.log("🔍 DEBUG: About to call saveHojaDeRuta with:", {
        eventData: eventData.eventName,
        userId: user.id
      });

      // First, save the main hoja de ruta data (this creates the record if it doesn't exist)
      console.log("💾 SAVE: Saving event data...");
      await saveHojaDeRuta({
        eventData,
        userId: user.id
      });

      // Now save related data in parallel (they all depend on hoja_de_ruta existing)
      const savePromises = [];

      // Always persist child collections, even when empty.
      // Their mutation functions delete existing DB rows first, so this is required for deletions to stick.
      console.log("🚗 SAVE: Syncing travel arrangements...", travelArrangements.length);
      savePromises.push(
        saveTravelArrangements(travelArrangements)
      );

      console.log("🏨 SAVE: Syncing accommodations...", accommodations.length);
      savePromises.push(
        saveAccommodations(accommodations)
      );

      console.log("📸 SAVE: Syncing venue images...", venueImages.length);
      savePromises.push(
        saveVenueImages(venueImages)
      );

      // Execute related saves in parallel
      await Promise.all(savePromises);

      // Update tracking
      lastSaveDataRef.current = currentDataSignature;
      setLastSaveTime(Date.now());

      console.log("✅ SAVE: All data saved successfully");
      toast({
        title: "✅ Guardado exitoso",
        description: `Todos los datos han sido guardados correctamente.`,
      });
    } catch (error: unknown) {
      console.error("❌ SAVE: Error saving data:", error);
      
      let errorMessage = "Error desconocido al guardar los datos.";
      const rawMessage = error instanceof Error ? error.message : String(error);
      if (rawMessage.includes("duplicate key")) {
        errorMessage = "Ya existe un registro con estos datos.";
      } else if (rawMessage.includes("network")) {
        errorMessage = "Error de conexión. Verifique su conexión a internet.";
      } else if (rawMessage) {
        errorMessage = rawMessage;
      }

      toast({
        title: "❌ Error al guardar",
        description: errorMessage,
        variant: "destructive",
      });

      throw error; // Re-throw to allow caller to handle
    } finally {
      saveInProgressRef.current = false;
    }
  }, [
    selectedJobId,
    eventData,
    travelArrangements,
    accommodations,
    venueImages,
    saveHojaDeRuta,
    saveTravelArrangements,
    saveAccommodations,
    saveVenueImages,
    setLastSaveTime,
    toast
  ]);

  useEffect(() => {
    debouncedSaveRef.current = debounce(() => {
      if (!isSaving && !isSavingTravel) {
        handleSaveAll().catch(console.error);
      }
    }, 2000);
  }, [handleSaveAll, isSaving, isSavingTravel]);

  // Debounced save for auto-save functionality
  const debouncedSave = useCallback(() => {
    debouncedSaveRef.current?.();
  }, []);

  return {
    handleSaveAll,
    autoPopulateFromJob,
    debouncedSave,
    saveInProgress: saveInProgressRef.current
  };
};
