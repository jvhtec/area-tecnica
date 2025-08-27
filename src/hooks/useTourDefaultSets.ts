
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface TourDefaultSet {
  id: string;
  tour_id: string;
  name: string;
  description?: string;
  department: 'sound' | 'lights' | 'video';
  created_at: string;
  updated_at: string;
}

export interface TourDefaultTable {
  id: string;
  set_id: string;
  table_name: string;
  table_data: any; // The complete table structure with rows
  table_type: 'power' | 'weight';
  total_value: number;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export const useTourDefaultSets = (tourId: string, department?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch default sets
  const { data: defaultSets = [], isLoading: setsLoading } = useQuery({
    queryKey: ["tour-default-sets", tourId, department],
    queryFn: async () => {
      let query = supabase
        .from("tour_default_sets")
        .select("*")
        .eq("tour_id", tourId)
        .order("created_at", { ascending: true });

      if (department) {
        query = query.eq("department", department);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TourDefaultSet[];
    },
    enabled: !!tourId,
  });

  // Fetch default tables for all sets
  const { data: defaultTables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ["tour-default-tables", tourId, department],
    queryFn: async () => {
      if (defaultSets.length === 0) return [];

      const setIds = defaultSets.map(set => set.id);
      const { data, error } = await supabase
        .from("tour_default_tables")
        .select("*")
        .in("set_id", setIds)
        .order("metadata->order_index", { ascending: true, nullsLast: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as TourDefaultTable[];
    },
    enabled: defaultSets.length > 0,
  });

  // Create default set
  const createSetMutation = useMutation({
    mutationFn: async (setData: Omit<TourDefaultSet, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("tour_default_sets")
        .insert(setData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-default-sets", tourId] });
      toast({
        title: "Success",
        description: "Default set created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create default set",
        variant: "destructive",
      });
    },
  });

  // Create default table
  const createTableMutation = useMutation({
    mutationFn: async (tableData: Omit<TourDefaultTable, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("tour_default_tables")
        .insert(tableData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-default-tables", tourId] });
      toast({
        title: "Success",
        description: "Default table saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save default table",
        variant: "destructive",
      });
    },
  });

  // Update default table
  const updateTableMutation = useMutation({
    mutationFn: async ({ tableId, updates }: { tableId: string, updates: Partial<TourDefaultTable> }) => {
      const { data, error } = await supabase
        .from("tour_default_tables")
        .update(updates)
        .eq("id", tableId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-default-tables", tourId] });
      toast({
        title: "Success",
        description: "Default table updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update default table",
        variant: "destructive",
      });
    },
  });

  // Delete default set (and all its tables)
  const deleteSetMutation = useMutation({
    mutationFn: async (setId: string) => {
      const { error } = await supabase
        .from("tour_default_sets")
        .delete()
        .eq("id", setId);

      if (error) throw error;
      return setId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-default-sets", tourId] });
      queryClient.invalidateQueries({ queryKey: ["tour-default-tables", tourId] });
      toast({
        title: "Success",
        description: "Default set deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete default set",
        variant: "destructive",
      });
    },
  });

  // Delete default table
  const deleteTableMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { error } = await supabase
        .from("tour_default_tables")
        .delete()
        .eq("id", tableId);

      if (error) throw error;
      return tableId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-default-tables", tourId] });
      toast({
        title: "Success",
        description: "Default table deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete default table",
        variant: "destructive",
      });
    },
  });

  return {
    defaultSets,
    defaultTables,
    isLoading: setsLoading || tablesLoading,
    createSet: createSetMutation.mutateAsync,
    createTable: createTableMutation.mutateAsync,
    updateTable: updateTableMutation.mutateAsync,
    deleteSet: deleteSetMutation.mutateAsync,
    deleteTable: deleteTableMutation.mutateAsync,
    isCreatingSet: createSetMutation.isPending,
    isCreatingTable: createTableMutation.isPending,
    isUpdatingTable: updateTableMutation.isPending,
    isDeletingSet: deleteSetMutation.isPending,
    isDeletingTable: deleteTableMutation.isPending,
  };
};
