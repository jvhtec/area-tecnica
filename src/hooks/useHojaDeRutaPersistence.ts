import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getHojaAggregate,
  hojaDocumentQueryKey,
  saveHojaAggregate,
  setHojaStatus,
} from "@/features/hoja-de-ruta/api/hojaDocumentApi";
import {
  buildHojaSavePayload,
  mapHojaAggregateToDocument,
} from "@/features/hoja-de-ruta/mappers/hojaDocumentMapper";
import type {
  HojaDocumentSaveInput,
  HojaStatus,
} from "@/features/hoja-de-ruta/model/HojaDocument";

export type SaveHojaPayload = HojaDocumentSaveInput;

interface SaveCallbacks {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
}

export const useHojaDeRutaPersistence = (
  jobId: string,
  callbacks: SaveCallbacks = {},
) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled } = callbacks;
  const queryKey = hojaDocumentQueryKey(jobId);

  const {
    data: hojaDeRuta,
    isLoading,
    isFetching,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!jobId) return null;
      const aggregate = await getHojaAggregate(jobId);
      return aggregate ? mapHojaAggregateToDocument(jobId, aggregate) : null;
    },
    enabled: Boolean(jobId),
    staleTime: 60_000,
    retry: 1,
  });

  const saveAll = useMutation({
    mutationFn: async (input: SaveHojaPayload) => {
      if (!jobId) throw new Error("No hay un trabajo seleccionado");
      return saveHojaAggregate({
        jobId,
        expectedVersion: input.expectedVersion,
        payload: buildHojaSavePayload(input),
      });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, (current: typeof hojaDeRuta) => current
        ? { ...current, document_version: saved.document_version }
        : current);
      void queryClient.invalidateQueries({ queryKey });
      onSuccess?.();
    },
    onError,
    onSettled,
  });

  const statusMutation = useMutation({
    mutationFn: async (status: HojaStatus) => {
      if (!jobId) throw new Error("No hay un trabajo seleccionado");
      return setHojaStatus(jobId, status);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, (current: typeof hojaDeRuta) => current
        ? {
            ...current,
            status: updated.status,
            approved_by: updated.approved_by || undefined,
            approved_at: updated.approved_at || undefined,
            document_version: updated.document_version,
          }
        : current);
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const forceRefetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
    return refetch();
  }, [queryClient, queryKey, refetch]);

  return {
    hojaDeRuta,
    isLoading,
    isFetching,
    fetchError,
    saveAll: saveAll.mutateAsync,
    isSaving: saveAll.isPending,
    setStatus: statusMutation.mutateAsync,
    isChangingStatus: statusMutation.isPending,
    forceRefetch,
  };
};
