import { useState } from "react";
import { toast } from "sonner";
import { format, parseISO, addDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
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
      // Convert local Madrid datetime to UTC
      const parsedDate = parseISO(artistDate);
      const endDateBase = isAfterMidnight ? addDays(parsedDate, 1) : parsedDate;

      const localStartDatetime = `${artistDate}T${showStart}:00`;
      const localEndDatetime = `${format(endDateBase, "yyyy-MM-dd")}T${showEnd}:00`;

      const plannedStartDate = fromZonedTime(localStartDatetime, "Europe/Madrid").toISOString();
      const plannedEndDate = fromZonedTime(localEndDatetime, "Europe/Madrid").toISOString();

      // 3. Compute document number with retry on conflict: DDMMAA.xSQT
      //    x = ordinal of extras presupuestos already created for this job + 1
      let documentNumber: string | null = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (!documentNumber && retryCount < maxRetries) {
        const { count } = await supabase
          .from("flex_folders")
          .select("id", { count: "exact", head: true })
          .eq("job_id", jobId)
          .eq("folder_type", "comercial_presupuesto");

        const ordinal = (count ?? 0) + 1;
        const docDate = format(parsedDate, "ddMMyy");
        documentNumber = `${docDate}.${ordinal}SQT`;
        retryCount++;
      }

      if (!documentNumber) {
        throw new Error("No se pudo calcular el número de documento después de múltiples intentos");
      }

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

        // Retry insertion with exponential backoff
        let extrasInserted = false;
        let extrasInsertError: any = null;
        const retryDelays = [500, 1000, 2000];

        for (let i = 0; i < retryDelays.length + 1; i++) {
          const { error } = await supabase
            .from("flex_folders")
            .insert({
              job_id: jobId,
              parent_id: comercialFolder.element_id,
              element_id: extrasElementId,
              department: "sound",
              folder_type: "comercial_extras",
            });

          if (!error) {
            extrasInserted = true;
            break;
          }

          extrasInsertError = error;

          if (i < retryDelays.length) {
            await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
          }
        }

        if (!extrasInserted) {
          console.error(`Orphaned Flex folder created with element_id: ${extrasElementId}`, extrasInsertError);
          toast.error(
            `Error al persistir carpeta extras en base de datos. Carpeta huérfana creada con element_id: ${extrasElementId}`,
            { duration: 10000 }
          );
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

      // 7. Persist presupuesto to DB with retry
      let presupuestoInserted = false;
      let presupuestoInsertError: any = null;
      const retryDelays = [500, 1000, 2000];

      for (let i = 0; i < retryDelays.length + 1; i++) {
        const { error } = await supabase
          .from("flex_folders")
          .insert({
            job_id: jobId,
            parent_id: extrasElementId,
            element_id: presupuesto.elementId,
            department: "sound",
            folder_type: "comercial_presupuesto",
          });

        if (!error) {
          presupuestoInserted = true;
          break;
        }

        presupuestoInsertError = error;

        if (i < retryDelays.length) {
          await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
        }
      }

      if (!presupuestoInserted) {
        console.error(`Orphaned Flex presupuesto created with element_id: ${presupuesto.elementId}`, presupuestoInsertError);
        toast.error(
          `Error al persistir presupuesto en base de datos. Presupuesto huérfano creado con element_id: ${presupuesto.elementId}`,
          { duration: 10000 }
        );
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