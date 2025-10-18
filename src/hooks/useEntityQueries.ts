
import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { queryClient } from "@/lib/react-query";
import { ApiService } from "@/lib/api-service";

// Create custom hooks for specific data types with appropriate overrides
export const useEntityQuery = <T>(
  entityType: string,
  id: string,
  options?: UseQueryOptions<T>
) => {
  const apiService = ApiService.getInstance();
  
  return useQuery({
    queryKey: [entityType, id],
    queryFn: () => apiService.get<T>(`/api/${entityType}/${id}`),
    ...options,
  });
};

// Create a hook for entity list queries
export const useEntityListQuery = <T>(
  entityType: string,
  filters?: Record<string, any>,
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
    queryKey: [entityType, 'list', filters],
    queryFn: () => apiService.get<T[]>(`/api/${entityType}${queryString}`),
    ...options,
  });
};

// Define a type for the context with previousData
interface MutationContext<T> {
  previousData?: T;
}

// Create a hook for entity mutations with optimistic updates
export const useEntityMutation = <T, TVariables extends object>(
  entityType: string,
  options?: UseMutationOptions<T, Error, TVariables, MutationContext<T>> & {
    optimisticUpdate?: (variables: TVariables) => void;
    onSuccessInvalidation?: string[];
  }
) => {
  const apiService = ApiService.getInstance();
  
  return useMutation({
    mutationFn: (variables: TVariables) => {
      const isCreate = !('id' in variables);
      const isDelete = 'isDelete' in variables && (variables as any).isDelete;
      
      if (isDelete) {
        const id = (variables as any).id;
        return apiService.delete<T>(`/api/${entityType}/${id}`);
      } else if (isCreate) {
        return apiService.post<T>(`/api/${entityType}`, variables);
      } else {
        const id = (variables as any).id;
        return apiService.put<T>(`/api/${entityType}/${id}`, variables);
      }
    },
    onMutate: async (variables): Promise<MutationContext<T>> => {
      if (options?.optimisticUpdate) {
        await queryClient.cancelQueries({ queryKey: [entityType] });
        
        // Get the current data and type cast it
        const previousData = queryClient.getQueryData<T>([entityType]);
        
        // Perform optimistic update
        options.optimisticUpdate(variables);
        
        // Return typed context
        return { previousData };
      }
      return {};
    },
    onError: (err, variables, context) => {
      // If we have previous data, roll back to it
      if (context?.previousData) {
        queryClient.setQueryData([entityType], context.previousData);
      }
      
      // Call the original onError if it exists
      if (options?.onError) {
        options.onError(err, variables, context);
      }
    },
    onSuccess: (data, variables, context) => {
      // Invalidate relevant queries
      if (options?.onSuccessInvalidation) {
        options.onSuccessInvalidation.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      } else {
        // Default invalidation
        queryClient.invalidateQueries({ queryKey: [entityType] });
      }
      
      // Call the original onSuccess if it exists
      if (options?.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    ...options,
  });
};
