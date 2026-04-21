import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createFlexFolder } from "@/utils/flex-folders/api";
import { FLEX_FOLDER_IDS, DEPARTMENT_IDS, RESPONSIBLE_PERSON_IDS } from "@/utils/flex-folders/constants";

export function useCreateExtrasPresupuesto(jobId: string | undefined) {
  const [creatingExtrasForArtistId, setCreatingExtrasForArtistId] = useState<string | null>(null);

  const createExtrasPresupuesto = async (artistId: string, artistName: string) => {
    if (!jobId) {
      toast.error("No hay job ID disponible");
      return;
    }

    setCreatingExtrasForArtistId(artistId);

    try {
      // 1. Get job title for folder naming
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("title")
        .eq("id", jobId)
        .single();

      if (jobError || !job) {
        throw new Error("No se pudo obtener la información del job");
      }

      const jobTitle = job.title?.trim() || "Sin título";

      // 2. Find the comercial department folder for this job
      const { data: comercialFolder, error: comercialError } = await supabase
        .from("flex_folders")
        .select("id, element_id")
        .eq("job_id", jobId)
        .eq("folder_type", "department")
        .eq("department", "comercial")
        .maybeSingle();

      if (comercialError) throw comercialError;

      if (!comercialFolder) {
        toast.error(
          "No existe carpeta comercial para este evento en Flex. Crea primero las carpetas del job."
        );
        return;
      }

      // 3. Find or create the sound extras subfolder inside comercial
      const { data: existingExtras, error: extrasQueryError } = await supabase
        .from("flex_folders")
        .select("id, element_id")
        .eq("job_id", jobId)
        .eq("folder_type", "comercial_extras")
        .eq("department", "sound")
        .maybeSingle();

      if (extrasQueryError) throw extrasQueryError;

      let extrasElementId: string;

      if (existingExtras) {
        extrasElementId = existingExtras.element_id;
      } else {
        // Create the extras folder in Flex
        const extrasFolder = await createFlexFolder({
          definitionId: FLEX_FOLDER_IDS.subFolder,
          parentElementId: comercialFolder.element_id,
          open: true,
          locked: false,
          name: `Extras ${jobTitle} - Sonido`,
          locationId: FLEX_FOLDER_IDS.location,
          departmentId: DEPARTMENT_IDS.sound,
          personResponsibleId: RESPONSIBLE_PERSON_IDS.sound,
        });

        extrasElementId = extrasFolder.elementId;

        // Persist extras folder to DB
        const { error: extrasInsertError } = await supabase
          .from("flex_folders")
          .insert({
            job_id: jobId,
            parent_id: comercialFolder.element_id,
            element_id: extrasElementId,
            department: "sound",
            folder_type: "comercial_extras",
          });

        if (extrasInsertError) {
          console.error(
            `Orphaned Flex folder created with element_id: ${extrasElementId}`,
            extrasInsertError
          );
          throw extrasInsertError;
        }
      }

      // 4. Create the presupuesto inside the extras folder
      const presupuesto = await createFlexFolder({
        definitionId: FLEX_FOLDER_IDS.presupuesto,
        parentElementId: extrasElementId,
        open: true,
        locked: false,
        name: `${artistName} - Extras`,
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS.sound,
        personResponsibleId: RESPONSIBLE_PERSON_IDS.sound,
      });

      // 5. Persist presupuesto to DB
      const { error: presupuestoInsertError } = await supabase
        .from("flex_folders")
        .insert({
          job_id: jobId,
          parent_id: extrasElementId,
          element_id: presupuesto.elementId,
          department: "sound",
          folder_type: "comercial_presupuesto",
        });

      if (presupuestoInsertError) {
        console.error(
          `Orphaned Flex presupuesto created with element_id: ${presupuesto.elementId}`,
          presupuestoInsertError
        );
        throw presupuestoInsertError;
      }

      toast.success(`Presupuesto "${artistName} - Extras" creado en Flex`);
    } catch (error) {
      console.error("Error creating Flex extras presupuesto:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al crear el presupuesto de extras en Flex"
      );
    } finally {
      setCreatingExtrasForArtistId(null);
    }
  };

  return { createExtrasPresupuesto, creatingExtrasForArtistId };
}
