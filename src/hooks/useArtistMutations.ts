import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import {
  generateOfflineId,
  getFestivalSnapshot,
  isBrowserOnline,
  queueFestivalChange,
} from "@/lib/offline";

import { queryKeys } from "@/lib/react-query";

type FestivalArtistInsert = Database["public"]["Tables"]["festival_artists"]["Insert"];
type FestivalArtistUpdate = Database["public"]["Tables"]["festival_artists"]["Update"];
type FestivalArtistUpdatePayload = FestivalArtistUpdate & { id: string };
type ArtistTimeField =
  | "show_start"
  | "show_end"
  | "soundcheck_start"
  | "soundcheck_end"
  | "line_check_start"
  | "line_check_end"
  | "load_in_time"
  | "foh_drive"
  | "foh_drive_position"
  | "mon_position";
type ArtistTimePayload = (FestivalArtistInsert | FestivalArtistUpdate) &
  Partial<Record<ArtistTimeField, string | null>>;

// Time fields and nullable-enum fields (foh_drive, foh_drive_position,
// mon_position) both need '' converted to null: the DB check constraints on
// the enum fields reject an empty string as an invalid value.
const artistTimeFields: ArtistTimeField[] = [
  "show_start",
  "show_end",
  "soundcheck_start",
  "soundcheck_end",
  "line_check_start",
  "line_check_end",
  "load_in_time",
  "foh_drive",
  "foh_drive_position",
  "mon_position",
];

// Helper function to format artist time data
const formatArtistTimeData = <T extends ArtistTimePayload>(artistData: T): T => {
  const formattedData = { ...artistData };

  artistTimeFields.forEach(field => {
    if (formattedData[field] === '') {
      formattedData[field] = null;
    }
  });
  return formattedData;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown error";
};

export const useArtistMutations = (jobId: string | undefined, selectedDate: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createArtistMutation = useMutation({
    networkMode: "always",
    mutationFn: async (artistData: FestivalArtistInsert) => {
      const dataToInsert = formatArtistTimeData({ ...artistData, job_id: jobId });

      // Offline: store the new artist in the local snapshot and queue it
      if (!isBrowserOnline() && jobId) {
        const snapshot = await getFestivalSnapshot(jobId);
        if (!snapshot) {
          throw new Error("Sin conexión y sin copia offline de este festival");
        }
        const offlineId = generateOfflineId();
        await queueFestivalChange({
          jobId,
          table: "festival_artists",
          operation: "insert",
          recordId: offlineId,
          payload: dataToInsert as Record<string, unknown>,
          label: (dataToInsert as { name?: string }).name,
        });
        return { ...dataToInsert, id: offlineId, __offline: true };
      }

      const { data, error } = await supabase
        .from("festival_artists")
        .insert([dataToInsert])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('festival-artists', jobId, selectedDate) });
      const savedOffline = Boolean((data as { __offline?: boolean })?.__offline);
      toast({
        title: savedOffline ? "Guardado offline" : "Success",
        description: savedOffline
          ? "Artista guardado localmente. Sincroniza cuando vuelvas a tener conexión."
          : "Artist created successfully",
      });
    },
    onError: (error: unknown) => {
      console.error("Error creating artist:", error);
      toast({
        title: "Error",
        description: "Could not create artist: " + getErrorMessage(error),
        variant: "destructive",
      });
    }
  });

  const updateArtistMutation = useMutation({
    networkMode: "always",
    mutationFn: async ({ id, ...updateData }: FestivalArtistUpdatePayload) => {
      const dataToUpdate = formatArtistTimeData(updateData);

      // Offline: apply to the local snapshot and queue for manual sync
      if (!isBrowserOnline() && jobId) {
        const snapshot = await getFestivalSnapshot(jobId);
        if (!snapshot) {
          throw new Error("Sin conexión y sin copia offline de este festival");
        }
        const existing = snapshot.data.artists.find((row) => row.id === id);
        await queueFestivalChange({
          jobId,
          table: "festival_artists",
          operation: "update",
          recordId: id,
          payload: dataToUpdate as Record<string, unknown>,
          baseUpdatedAt: (existing?.updated_at as string | null) ?? null,
          label: (dataToUpdate as { name?: string }).name ?? ((existing?.name as string | undefined) ?? undefined),
        });
        return { ...existing, ...dataToUpdate, id, __offline: true };
      }

      const { data, error } = await supabase
        .from("festival_artists")
        .update(dataToUpdate)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('festival-artists', jobId, selectedDate) });
      const savedOffline = Boolean((data as { __offline?: boolean })?.__offline);
      toast({
        title: savedOffline ? "Guardado offline" : "Success",
        description: savedOffline
          ? "Cambios guardados localmente. Sincroniza cuando vuelvas a tener conexión."
          : "Artist updated successfully",
      });
    },
    onError: (error: unknown) => {
      console.error("Error updating artist:", error);
      toast({
        title: "Error",
        description: "Could not update artist: " + getErrorMessage(error),
        variant: "destructive",
      });
    }
  });

  return {
    createArtist: createArtistMutation.mutate,
    updateArtist: updateArtistMutation.mutate,
    createArtistAsync: createArtistMutation.mutateAsync,
    updateArtistAsync: updateArtistMutation.mutateAsync,
    isCreating: createArtistMutation.isPending,
    isUpdating: updateArtistMutation.isPending,
  };
};
