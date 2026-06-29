
import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { queryKeys, queryClient } from "@/lib/react-query";
import { ApiService } from "@/lib/api-service";

type EntityMutationVariables = {
  id?: string | number;
  isDelete?: boolean;
} & Record<string, unknown>;

// Create custom hooks for specific data types with appropriate overrides
export const useEntityQuery = <T>(
  entityType: string,
  id: string,
  options?: UseQueryOptions<T>
) => {
  const apiService = ApiService.getInstance();
  
  return useQuery({
    queryKey: queryKeys.custom(entityType, id),
    queryFn: () => apiService.get<T>(`/api/${entityType}/${id}`),
    ...options,
  });
};

// Create a hook for entity list queries
export const useEntityListQuery = <T>(
  entityType: string,
  filters?: Record<string, unknown>,
  options?: UseQueryOptions<T[]>
) => {
  const apiService = ApiService.getInstance();
  
  // Build query string from filters
  const queryString = filters 
    ? `?${Object.entries(filters)
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join('&')}`
    : '';
  
  return useQuery({
    queryKey: queryKeys.custom(entityType, 'list', filters),
    queryFn: () => apiService.get<T[]>(`/api/${entityType}${queryString}`),
    ...options,
  });
};

// Define a type for the context with previousData
interface MutationContext<T> {
  previousData?: T;
}

// Create a hook for entity mutations with optimistic updates
export const useEntityMutation = <T, TVariables extends EntityMutationVariables>(
  entityType: string,
  options?: UseMutationOptions<T, Error, TVariables, MutationContext<T>> & {
    optimisticUpdate?: (variables: TVariables) => void;
    onSuccessInvalidation?: string[];
  }
) => {
  const apiService = ApiService.getInstance();
  const { optimisticUpdate, onSuccessInvalidation, ...mutationOptions } = options ?? {};
  
  return useMutation({
    ...mutationOptions,
    mutationFn: (variables: TVariables) => {
      const isCreate = !('id' in variables);
      const isDelete = variables.isDelete === true;
      
      if (isDelete) {
        const id = variables.id;
        return apiService.delete<T>(`/api/${entityType}/${id}`);
      } else if (isCreate) {
        return apiService.post<T>(`/api/${entityType}`, variables);
      } else {
        const id = variables.id;
        return apiService.put<T>(`/api/${entityType}/${id}`, variables);
      }
    },
    onMutate: async (variables, mutationContext): Promise<MutationContext<T>> => {
      const optionContext = (await mutationOptions.onMutate?.(variables, mutationContext)) ?? {};
      if (optimisticUpdate) {
        await queryClient.cancelQueries({ queryKey: queryKeys.custom(entityType) });
        
        // Get the current data and type cast it
        const previousData = queryClient.getQueryData<T>([entityType]);
        
        // Perform optimistic update
        optimisticUpdate(variables);
        
        // Return typed context
        return { ...optionContext, previousData };
      }
      return optionContext ?? {};
    },
    onError: (err, variables, context, mutationContext) => {
      // If we have previous data, roll back to it
      if (context?.previousData) {
        queryClient.setQueryData([entityType], context.previousData);
      }
      
      // Call the original onError if it exists
      mutationOptions.onError?.(err, variables, context, mutationContext);
    },
    onSuccess: (data, variables, context, mutationContext) => {
      // Invalidate relevant queries
      if (onSuccessInvalidation) {
        onSuccessInvalidation.forEach(key => {
          queryClient.invalidateQueries({ queryKey: queryKeys.custom(key) });
        });
      } else {
        // Default invalidation
        queryClient.invalidateQueries({ queryKey: queryKeys.custom(entityType) });
      }
      
      // Call the original onSuccess if it exists
      mutationOptions.onSuccess?.(data, variables, context, mutationContext);
    },
  });
};
