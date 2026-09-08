import { addDays, format, parseISO } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const FLEX_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export function formatArtistDateTimeForFlex(date: string, time: string | null | undefined): string {
  const match = typeof time === "string" ? time.match(FLEX_TIME_PATTERN) : null;
  if (!match) throw new Error(`Hora de artista invalida para Flex: ${time || "(vacia)"}`);
  const [, hours, minutes, seconds = "00"] = match;
  return `${date}T${hours}:${minutes}:${seconds}.000Z`;
}

export function buildArtistFlexDateRange(
  artistDate: string,
  showStart: string | null | undefined,
  showEnd: string | null | undefined,
  isAfterMidnight = false,
  dayStartTime = "07:00",
): { plannedStartDate: string; plannedEndDate: string } {
  const parsedDate = parseISO(artistDate);
  const effectiveShowStart = showStart?.trim() || dayStartTime;
  const effectiveShowEnd = showEnd?.trim() || dayStartTime;
  const endDateBase = isAfterMidnight || !showEnd?.trim() ? addDays(parsedDate, 1) : parsedDate;
  return {
    plannedStartDate: formatArtistDateTimeForFlex(artistDate, effectiveShowStart),
    plannedEndDate: formatArtistDateTimeForFlex(format(endDateBase, "yyyy-MM-dd"), effectiveShowEnd),
  };
}

export function formatArtistExtrasFolderDocumentNumber(date: Date): string {
  return `${format(date, "ddMMyy")}ESQT`;
}

export function useCreateExtrasPresupuesto(jobId: string | undefined, dayStartTime = "07:00") {
  const [creatingExtrasForArtistIds, setCreatingExtrasForArtistIds] = useState<Set<string>>(new Set());
  const isCreatingExtrasFor = (id: string) => creatingExtrasForArtistIds.has(id);

  const createExtrasPresupuesto = async (
    artistId: string,
    _artistName: string,
    _artistDate: string,
    _showStart: string | null | undefined,
    _showEnd: string | null | undefined,
    _isAfterMidnight = false,
  ) => {
    if (!jobId) {
      toast.error("No hay job ID disponible");
      return;
    }
    setCreatingExtrasForArtistIds((current) => new Set(current).add(artistId));
    try {
      const { data, error } = await supabase.functions.invoke("create-flex-folders", {
        body: { operation: "festival-artist-extras", artistId, jobId, dayStartTime },
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string; documentNumber?: string } | null;
      if (result?.success === false) throw new Error(result.error || "La creación requiere reconciliación");
      toast.success(`Presupuesto de extras creado en Flex${result?.documentNumber ? ` (${result.documentNumber})` : ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear el presupuesto de extras en Flex");
    } finally {
      setCreatingExtrasForArtistIds((current) => {
        const next = new Set(current);
        next.delete(artistId);
        return next;
      });
    }
  };

  return { createExtrasPresupuesto, isCreatingExtrasFor };
}
