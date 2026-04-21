import { useState } from "react";
import { toast } from "sonner";
import { format, parseISO, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { createFlexFolder } from "@/utils/flex-folders/api";
import { FLEX_FOLDER_IDS, DEPARTMENT_IDS, RESPONSIBLE_PERSON_IDS } from "@/utils/flex-folders/constants";

export function useCreateExtrasPresupuesto(jobId: string | undefined) {
  const [creatingExtrasForArtistId, setCreatingExtrasForArtistId] = useState<string | null>(null);

  const createExtrasPresupuesto = async (
    artistId: string,
    artistName: string,
    artistDate: string,   // YYYY-MM-DD
    showStart: string,    // HH:MM
    showEnd: string,      // HH:MM
    isAfterMidnight = false
  ) => {
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

      if (jobError || !job) throw new Error("No se pudo obtener la información del job");

      const jobTitle = job.title?.trim() || "Sin título";

      // 2. Build ISO date strings from the artist's show day/time
      const parsedDate = parseISO(artistDate);
      const endDateBase = isAfterMidnight ? addDays(parsedDate, 1) : parsedDate;
      const plannedStartDate = `${artistDate}T${showStart}:00.000Z`;
      const plannedEndDate = `${format(endDateBase, "yyyy-MM-dd")}T${showEnd}:00.000Z`;

      // 3. Compute document number: DDMMAA.xSQT
      //    x = ordinal of extras presupuestos already created for this job + 1
      const { count } = await supabase
        .from("flex_folders")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("folder_type", "comercial_presupuesto");

      const ordinal = (count ?? 0) + 1;
      const docDate = format(parsedDate, "ddMMyy");
      const documentNumber = `${docDate}.${ordinal}SQT`;

      // 4. Find the comercial department folder for this job
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

      // 5. Find or create the sound extras subfolder inside comercial
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
        const extrasFolder = await createFlexFolder({
          definitionId: FLEX_FOLDER_IDS.subFolder,
          parentElementId: comercialFolder.element_id,
          open: true,
          locked: false,
          name: `Extras ${jobTitle} - Sonido`,
          plannedStartDate,
          plannedEndDate,
          locationId: FLEX_FOLDER_IDS.location,
          departmentId: DEPARTMENT_IDS.sound,
          personResponsibleId: RESPONSIBLE_PERSON_IDS.sound,
        });

        extrasElementId = extrasFolder.elementId;

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
          console.error(`Orphaned Flex folder created with element_id: ${extrasElementId}`, extrasInsertError);
          throw extrasInsertError;
        }
      }

      // 6. Create the presupuesto inside the extras folder
      const presupuesto = await createFlexFolder({
        definitionId: FLEX_FOLDER_IDS.presupuesto,
        parentElementId: extrasElementId,
        open: true,
        locked: false,
        name: `${artistName} - Extras`,
        plannedStartDate,
        plannedEndDate,
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS.sound,
        documentNumber,
        personResponsibleId: RESPONSIBLE_PERSON_IDS.sound,
      });

      // 7. Persist presupuesto to DB
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
        console.error(`Orphaned Flex presupuesto created with element_id: ${presupuesto.elementId}`, presupuestoInsertError);
        throw presupuestoInsertError;
      }

      toast.success(`Presupuesto "${artistName} - Extras" (${documentNumber}) creado en Flex`);
    } catch (error) {
      console.error("Error creating Flex extras presupuesto:", error);
      toast.error(
        error instanceof Error ? error.message : "Error al crear el presupuesto de extras en Flex"
      );
    } finally {
      setCreatingExtrasForArtistId(null);
    }
  };

  return { createExtrasPresupuesto, creatingExtrasForArtistId };
}
