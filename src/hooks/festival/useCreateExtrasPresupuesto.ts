import { useState } from "react";
import { toast } from "sonner";
import { format, parseISO, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { createFlexFolder } from "@/utils/flex-folders/api";
import { FLEX_FOLDER_IDS, DEPARTMENT_IDS, RESPONSIBLE_PERSON_IDS } from "@/utils/flex-folders/constants";

// Module-level queue: serialises presupuesto creation per job so that
// concurrent button clicks (different artists, same job) cannot read the same
// count and produce duplicate document numbers within a single browser session.
const jobCreationQueues = new Map<string, Promise<void>>();

const RETRY_DELAYS = [500, 1000, 2000];
const FLEX_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export function formatArtistDateTimeForFlex(date: string, time: string): string {
  const match = time.match(FLEX_TIME_PATTERN);
  if (!match) {
    throw new Error(`Hora de artista invalida para Flex: ${time || "(vacia)"}`);
  }

  const [, hours, minutes, seconds = "00"] = match;

  return `${date}T${hours}:${minutes}:${seconds}.000Z`;
}

export function formatArtistExtrasFolderDocumentNumber(date: Date): string {
  return `${format(date, "ddMMyy")}ESQT`;
}

async function insertWithRetry(insertFn: () => Promise<{ error: unknown }>): Promise<void> {
  let lastError: unknown = null;
  for (let i = 0; i <= RETRY_DELAYS.length; i++) {
    const { error } = await insertFn();
    if (!error) return;
    lastError = error;
    if (i < RETRY_DELAYS.length) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[i]));
    }
  }
  throw lastError;
}

export function useCreateExtrasPresupuesto(jobId: string | undefined) {
  const [creatingExtrasForArtistIds, setCreatingExtrasForArtistIds] = useState<Set<string>>(new Set());

  const addCreating = (id: string) =>
    setCreatingExtrasForArtistIds(prev => new Set(prev).add(id));
  const removeCreating = (id: string) =>
    setCreatingExtrasForArtistIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  const isCreatingExtrasFor = (id: string) => creatingExtrasForArtistIds.has(id);

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

    addCreating(artistId);

    // Enqueue: wait for any in-flight request for this job to finish before
    // reading the count, ensuring ordinals are assigned sequentially.
    const prevTask = jobCreationQueues.get(jobId) ?? Promise.resolve();
    let releaseThisTask!: () => void;
    const thisTask = new Promise<void>(res => { releaseThisTask = res; });
    const nextPromise = prevTask.then(() => thisTask);
    jobCreationQueues.set(jobId, nextPromise);
    await prevTask.catch(() => {}); // a failure in the prev task must not block this one

    try {
      // 1. Get job title for folder naming
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("title")
        .eq("id", jobId)
        .single();

      if (jobError || !job) throw new Error("No se pudo obtener la información del job");

      const jobTitle = job.title?.trim() || "Sin título";

      // 2. Build Flex date strings from the artist's local show day/time
      const parsedDate = parseISO(artistDate);
      const endDateBase = isAfterMidnight ? addDays(parsedDate, 1) : parsedDate;

      const plannedStartDate = formatArtistDateTimeForFlex(artistDate, showStart);
      const plannedEndDate = formatArtistDateTimeForFlex(format(endDateBase, "yyyy-MM-dd"), showEnd);

      // 3. Compute document number: DDMMAA.xSQT
      //    Count runs inside the queue so the ordinal is always fresh.
      const { count } = await supabase
        .from("flex_folders")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("folder_type", "comercial_presupuesto");

      const ordinal = (count ?? 0) + 1;
      const docDate = format(parsedDate, "ddMMyy");
      const extrasFolderDocumentNumber = formatArtistExtrasFolderDocumentNumber(parsedDate);
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
          documentNumber: extrasFolderDocumentNumber,
          personResponsibleId: RESPONSIBLE_PERSON_IDS.sound,
        });

        extrasElementId = extrasFolder.elementId;

        try {
          await insertWithRetry(() =>
            supabase.from("flex_folders").insert({
              job_id: jobId,
              parent_id: comercialFolder.element_id,
              element_id: extrasElementId,
              department: "sound",
              folder_type: "comercial_extras",
            })
          );
        } catch (err) {
          console.error(`Orphaned Flex folder created with element_id: ${extrasElementId}`, err);
          toast.error(
            `Error al persistir carpeta extras en base de datos. Carpeta huérfana creada con element_id: ${extrasElementId}`,
            { duration: 10000 }
          );
          throw err;
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
      try {
        await insertWithRetry(() =>
          supabase.from("flex_folders").insert({
            job_id: jobId,
            parent_id: extrasElementId,
            element_id: presupuesto.elementId,
            department: "sound",
            folder_type: "comercial_presupuesto",
          })
        );
      } catch (err) {
        console.error(`Orphaned Flex presupuesto created with element_id: ${presupuesto.elementId}`, err);
        toast.error(
          `Error al persistir presupuesto en base de datos. Presupuesto huérfano creado con element_id: ${presupuesto.elementId}`,
          { duration: 10000 }
        );
        throw err;
      }

      toast.success(`Presupuesto "${artistName} - Extras" (${documentNumber}) creado en Flex`);
    } catch (error) {
      console.error("Error creating Flex extras presupuesto:", error);
      toast.error(
        error instanceof Error ? error.message : "Error al crear el presupuesto de extras en Flex"
      );
    } finally {
      releaseThisTask();
      if (jobCreationQueues.get(jobId) === nextPromise) {
        jobCreationQueues.delete(jobId);
      }
      removeCreating(artistId);
    }
  };

  return { createExtrasPresupuesto, isCreatingExtrasFor };
}
