import { useCallback } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";

type ToastOptions = Parameters<ReturnType<typeof useToast>["toast"]>[0];

type MutationFeedbackOptions<T> = {
  action: () => Promise<T>;
  success: ToastOptions;
  error: {
    title: string;
    fallbackDescription: string;
  };
  invalidate?: QueryKey[];
  queryClient?: QueryClient;
  onSuccess?: (result: T) => void | Promise<void>;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const useMutationFeedback = () => {
  const { toast } = useToast();

  return useCallback(
    async <T,>({
      action,
      success,
      error,
      invalidate = [],
      queryClient,
      onSuccess,
    }: MutationFeedbackOptions<T>): Promise<T | null> => {
      try {
        const result = await action();
        if (queryClient && invalidate.length > 0) {
          await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
        }
        await onSuccess?.(result);
        toast(success);
        return result;
      } catch (err) {
        console.error(error.title, err);
        toast({
          title: error.title,
          description: getErrorMessage(err, error.fallbackDescription),
          variant: "destructive",
        });
        return null;
      }
    },
    [toast],
  );
};
