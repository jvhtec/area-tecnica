
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface EquipmentModel {
  id: string;
  name: string;
  category: string;
  department: string;
  resource_id?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const useEquipmentModels = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: models = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['equipment-models'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('department', 'sound')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as EquipmentModel[];
    }
  });

  const createModelMutation = useMutation({
    mutationFn: async (model: { name: string; category: string }) => {
      const { data, error } = await supabase
        .from('equipment')
        .insert([{ ...model, department: 'sound' }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-models'] });
      toast({
        title: "Success",
        description: "Equipment model created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateModelMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; category?: string }) => {
      const { data, error } = await supabase
        .from('equipment')
        .update(updates)
        .eq('id', id)
        .eq('department', 'sound')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-models'] });
      toast({
        title: "Success",
        description: "Equipment model updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id)
        .eq('department', 'sound');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-models'] });
      toast({
        title: "Success",
        description: "Equipment model deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return {
    models,
    isLoading,
    error,
    createModel: createModelMutation.mutate,
    updateModel: updateModelMutation.mutate,
    deleteModel: deleteModelMutation.mutate,
    isCreating: createModelMutation.isPending,
    isUpdating: updateModelMutation.isPending,
    isDeleting: deleteModelMutation.isPending
  };
};
