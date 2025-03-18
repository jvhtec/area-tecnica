
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';

type MutationContext = {
  previousData: any;
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
    optimisticUpdate?: (variables: TVariables, oldData: any) => any;
    onSuccess?: (data: TData, variables: TVariables, context: MutationContext) => void;
    onError?: (error: TError, variables: TVariables, context: MutationContext) => void;
    onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, context: MutationContext) => void;
  }
) {
  const queryClient = useQueryClient();
  const normalizedQueryKey = Array.isArray(options.queryKey) ? options.queryKey : [options.queryKey];
  
  return useMutation<TData, TError, TVariables, MutationContext>({
    mutationFn,
    
    onMutate: async (variables) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: normalizedQueryKey });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(normalizedQueryKey);
      
      // Perform optimistic update if provided
      if (options.optimisticUpdate) {
        queryClient.setQueryData(normalizedQueryKey, (oldData: any) => {
          return options.optimisticUpdate ? options.optimisticUpdate(variables, oldData) : oldData;
        });
      }
      
      // Return the context with the previous data
      return { previousData };
    },
    
    onError: (error, variables, context) => {
      // Rollback to previous data on error
      queryClient.setQueryData(normalizedQueryKey, context.previousData);
      
      // Call the provided onError callback if any
      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
    
    onSuccess: (data, variables, context) => {
      // Call the provided onSuccess callback if any
      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    
    onSettled: (data, error, variables, context) => {
      // Always invalidate the query after mutation settles
      queryClient.invalidateQueries({ queryKey: normalizedQueryKey });
      
      // Call the provided onSettled callback if any
      if (options.onSettled) {
        options.onSettled(data, error, variables, context);
      }
    }
  });
}
