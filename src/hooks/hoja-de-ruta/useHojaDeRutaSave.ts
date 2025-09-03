import { useCallback, useRef } from 'react';
import { EventData, TravelArrangement, Accommodation } from '@/types/hoja-de-ruta';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { debounce } from 'lodash';

export const useHojaDeRutaSave = (
  selectedJobId: string,
  eventData: EventData,
  travelArrangements: TravelArrangement[],
  accommodations: Accommodation[],
  saveHojaDeRuta: any,
  saveTravelArrangements: any,
  saveAccommodations: any,
  isSaving: boolean,
  isSavingTravel: boolean,
  setLastSaveTime: React.Dispatch<React.SetStateAction<number>>
) => {
  const { toast } = useToast();
  const saveInProgressRef = useRef<boolean>(false);
  const lastSaveDataRef = useRef<string>("");

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
          .map((req: any) => {
            return `${req.department.toUpperCase()} - ${req.table_name}:\n` +
              `Potencia Total: ${req.total_watts}W\n` +
              `Corriente por Fase: ${req.current_per_phase}A\n` +
              `PDU Recomendado: ${req.pdu_type}\n`;
          })
          .join("\n");

        return { powerRequirements: powerText };
      }
      
      console.log("✅ SAVE: Power requirements loaded successfully");
      return { powerRequirements: eventData.powerRequirements };
    } catch (error: any) {
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

      // Save all data in parallel for better performance
      const savePromises = [];

      // Always save event data
      console.log("💾 SAVE: Saving event data...");
      savePromises.push(
        saveHojaDeRuta({
          eventData,
          userId: user.id
        })
      );

      // Save travel arrangements if any exist
      if (travelArrangements.length > 0) {
        console.log("🚗 SAVE: Saving travel arrangements...", travelArrangements.length);
        savePromises.push(
          saveTravelArrangements(travelArrangements)
        );
      }

      // Save accommodations if any exist
      if (accommodations.length > 0) {
        console.log("🏨 SAVE: Saving accommodations...", accommodations.length);
        savePromises.push(
          saveAccommodations(accommodations)
        );
      }

      // Execute all saves in parallel
      await Promise.all(savePromises);

      // Update tracking
      lastSaveDataRef.current = currentDataSignature;
      setLastSaveTime(Date.now());

      console.log("✅ SAVE: All data saved successfully");
      toast({
        title: "✅ Guardado exitoso",
        description: `Todos los datos han sido guardados correctamente.`,
      });
    } catch (error: any) {
      console.error("❌ SAVE: Error saving data:", error);
      
      let errorMessage = "Error desconocido al guardar los datos.";
      if (error.message?.includes("duplicate key")) {
        errorMessage = "Ya existe un registro con estos datos.";
      } else if (error.message?.includes("network")) {
        errorMessage = "Error de conexión. Verifique su conexión a internet.";
      } else if (error.message) {
        errorMessage = error.message;
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
    saveHojaDeRuta,
    saveTravelArrangements,
    saveAccommodations,
    setLastSaveTime,
    toast
  ]);

  // Debounced save for auto-save functionality
  const debouncedSave = useCallback(
    debounce(() => {
      if (!isSaving && !isSavingTravel) {
        handleSaveAll().catch(console.error);
      }
    }, 2000),
    [handleSaveAll, isSaving, isSavingTravel]
  );

  return {
    handleSaveAll,
    autoPopulateFromJob,
    debouncedSave,
    saveInProgress: saveInProgressRef.current
  };
};