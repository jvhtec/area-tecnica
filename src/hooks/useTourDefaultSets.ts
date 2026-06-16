
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";


import { queryKeys } from "@/lib/react-query";
import type { TourPackageSize } from "@/utils/tourPackages";

export interface TourDefaultSet {
  id: string;
  tour_id: string;
  name: string;
  description?: string | null;
  department: 'sound' | 'lights' | 'video';
  package_size?: TourPackageSize | null;
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
    queryKey: queryKeys.scope("tour-default-sets", tourId, department),
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
      return (data || []) as TourDefaultSet[];
    },
    enabled: !!tourId,
  });

  // Fetch default tables for all sets
  const { data: defaultTables = [], isLoading: tablesLoading } = useQuery({
    queryKey: queryKeys.scope("tour-default-tables", tourId, department),
    queryFn: async () => {
      if (defaultSets.length === 0) return [];

      const setIds = defaultSets.map(set => set.id);
      const { data, error } = await supabase
        .from("tour_default_tables")
        .select("*")
        .in("set_id", setIds)
        .order("metadata->order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as TourDefaultTable[];
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
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-default-sets", tourId) });
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

  // Update default set metadata
  const updateSetMutation = useMutation({
    mutationFn: async ({ setId, updates }: { setId: string, updates: Partial<Pick<TourDefaultSet, "name" | "description" | "package_size">> }) => {
      const { data, error } = await supabase
        .from("tour_default_sets")
        .update(updates)
        .eq("id", setId)
        .select()
        .single();

      if (error) throw error;
      return data as TourDefaultSet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-default-sets", tourId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") });
      toast({
        title: "Success",
        description: "Default set updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update default set",
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
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-default-tables", tourId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-default-tables", tourId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-default-sets", tourId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-default-tables", tourId) });
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

  // Duplicate default set and all child tables
  const duplicateSetMutation = useMutation({
    mutationFn: async ({
      setId,
      name,
      description,
      package_size,
    }: {
      setId: string;
      name?: string;
      description?: string | null;
      package_size?: TourPackageSize | null;
    }) => {
      const sourceSet = defaultSets.find((set) => set.id === setId);
      if (!sourceSet) {
        throw new Error("Source default set not found");
      }

      const { data: newSet, error: setError } = await supabase
        .from("tour_default_sets")
        .insert({
          tour_id: sourceSet.tour_id,
          name: name || `${sourceSet.name} Copy`,
          description: description ?? sourceSet.description ?? null,
          department: sourceSet.department,
          package_size: package_size ?? sourceSet.package_size ?? null,
        })
        .select()
        .single();

      if (setError) throw setError;

      const sourceTables = defaultTables.filter((table) => table.set_id === setId);
      if (sourceTables.length > 0) {
        const { error: tablesError } = await supabase
          .from("tour_default_tables")
          .insert(
            sourceTables.map((table) => ({
              set_id: newSet.id,
              table_name: table.table_name,
              table_data: table.table_data,
              table_type: table.table_type,
              total_value: table.total_value,
              metadata: table.metadata,
            }))
          );

        if (tablesError) throw tablesError;
      }

      return newSet as TourDefaultSet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-default-sets", tourId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-default-tables", tourId) });
      toast({
        title: "Success",
        description: "Default set duplicated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate default set",
        variant: "destructive",
      });
    },
  });

  // Copy selected child tables into an existing set
  const copyTablesToSetMutation = useMutation({
    mutationFn: async ({
      tableIds,
      targetSetId,
    }: {
      tableIds: string[];
      targetSetId: string;
    }) => {
      const sourceTables = defaultTables.filter((table) => tableIds.includes(table.id));
      if (sourceTables.length === 0) {
        throw new Error("No default tables selected");
      }

      const { data, error } = await supabase
        .from("tour_default_tables")
        .insert(
          sourceTables.map((table) => ({
            set_id: targetSetId,
            table_name:
              table.set_id === targetSetId
                ? `${table.table_name} Copy`
                : table.table_name,
            table_data: table.table_data,
            table_type: table.table_type,
            total_value: table.total_value,
            metadata: table.metadata,
          })),
        )
        .select();

      if (error) throw error;
      return data as TourDefaultTable[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-default-tables", tourId) });
      toast({
        title: "Success",
        description: "Default table(s) copied successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to copy default tables",
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
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-default-tables", tourId) });
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
    updateSet: updateSetMutation.mutateAsync,
    createTable: createTableMutation.mutateAsync,
    updateTable: updateTableMutation.mutateAsync,
    deleteSet: deleteSetMutation.mutateAsync,
    deleteTable: deleteTableMutation.mutateAsync,
    duplicateSet: duplicateSetMutation.mutateAsync,
    copyTablesToSet: copyTablesToSetMutation.mutateAsync,
    isCreatingSet: createSetMutation.isPending,
    isUpdatingSet: updateSetMutation.isPending,
    isCreatingTable: createTableMutation.isPending,
    isUpdatingTable: updateTableMutation.isPending,
    isDeletingSet: deleteSetMutation.isPending,
    isDeletingTable: deleteTableMutation.isPending,
    isDuplicatingSet: duplicateSetMutation.isPending,
    isCopyingTables: copyTablesToSetMutation.isPending,
  };
};
