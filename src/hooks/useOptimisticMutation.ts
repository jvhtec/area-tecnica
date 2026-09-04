
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * The value returned by `onMutate` and handed back to the later callbacks. React Query v5
 * calls this the *onMutateResult* (the 4th generic is `TOnMutateResult`); the separate
 * `MutationFunctionContext` argument that follows it is a different thing entirely.
 */
type OptimisticSnapshot = {
  previousData: unknown;
};

/**
 * Generic type for optimistic mutations with real-time updates
 * @template TData The type of data returned by the mutation
 * @template TVariables The type of variables used by the mutation
 * @template TError The type of error returned by the mutation
 */
export function useOptimisticMutation<
  TData,
  TVariables,
  TError = Error
>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    queryKey: string | string[];
    optimisticUpdate?: (variables: TVariables, oldData: unknown) => unknown;
    // React Query passes `undefined` here when `onMutate` never ran (or threw).
    onSuccess?: (data: TData, variables: TVariables, onMutateResult: OptimisticSnapshot | undefined) => void;
    onError?: (error: TError, variables: TVariables, onMutateResult: OptimisticSnapshot | undefined) => void;
    onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, onMutateResult: OptimisticSnapshot | undefined) => void;
  }
) {
  const queryClient = useQueryClient();
  const normalizedQueryKey = Array.isArray(options.queryKey) ? options.queryKey : [options.queryKey];

  return useMutation<TData, TError, TVariables, OptimisticSnapshot>({
    mutationFn,

    onMutate: async (variables) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: normalizedQueryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(normalizedQueryKey);

      // Perform optimistic update if provided
      if (options.optimisticUpdate) {
        queryClient.setQueryData(normalizedQueryKey, (oldData: unknown) => {
          return options.optimisticUpdate ? options.optimisticUpdate(variables, oldData) : oldData;
        });
      }

      // Return the snapshot so the later callbacks can roll back
      return { previousData };
    },

    onError: (error, variables, onMutateResult) => {
      // Rollback to previous data on error (no snapshot means it never happened)
      if (onMutateResult) {
        queryClient.setQueryData(normalizedQueryKey, onMutateResult.previousData);
      }

      // Call the provided onError callback if any
      if (options.onError) {
        options.onError(error, variables, onMutateResult);
      }
    },

    onSuccess: (data, variables, onMutateResult) => {
      // Call the provided onSuccess callback if any
      if (options.onSuccess) {
        options.onSuccess(data, variables, onMutateResult);
      }
    },

    onSettled: (data, error, variables, onMutateResult) => {
      // Always invalidate the query after mutation settles
      queryClient.invalidateQueries({ queryKey: normalizedQueryKey });

      // Call the provided onSettled callback if any
      if (options.onSettled) {
        options.onSettled(data, error, variables, onMutateResult);
      }
    }
  });
}
