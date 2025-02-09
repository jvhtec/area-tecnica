
import { useState } from 'react';
import { StockEntry } from '@/types/equipment';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useToast } from '@/hooks/use-toast';
import { StockCreationManager } from '@/components/disponibilidad/StockCreationManager';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export function EquipmentManagement() {
  const { session, userRole } = useSessionManager();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch current user's stock
  const { data: stockEntries = [], error: stockError } = useQuery({
    queryKey: ['stock-entries', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      
      const { data, error } = await supabase
        .from('stock_entries')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) throw error;
      return data as StockEntry[];
    },
    enabled: !!session?.user?.id
  });

  // Update stock entries mutation
  const updateStockMutation = useMutation({
    mutationFn: async (updatedStock: StockEntry[]) => {
      if (!session?.user?.id) throw new Error('No user session');

      // Process each stock entry individually
      for (const entry of updatedStock) {
        const existingEntry = stockEntries.find(
          s => s.equipment_id === entry.equipment_id
        );

        if (existingEntry) {
          // Update existing entry
          const { error: updateError } = await supabase
            .from('stock_entries')
            .update({ base_quantity: entry.base_quantity })
            .eq('id', existingEntry.id)
            .eq('user_id', session.user.id);

          if (updateError) throw updateError;
        } else {
          // Insert new entry
          const { error: insertError } = await supabase
            .from('stock_entries')
            .insert({
              equipment_id: entry.equipment_id,
              base_quantity: entry.base_quantity,
              user_id: session.user.id
            });

          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-entries'] });
      toast({
        title: "Éxito",
        description: "Inventario actualizado correctamente"
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al actualizar el inventario"
      });
      console.error('Error updating stock:', error);
    }
  });

  const handleStockUpdate = (updatedStock: StockEntry[]) => {
    updateStockMutation.mutate(updatedStock);
  };

  if (stockError) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Error al cargar el inventario. Por favor, inténtelo de nuevo más tarde.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Gestionar Inventario</h1>
      <StockCreationManager 
        stock={stockEntries}
        onStockUpdate={handleStockUpdate}
      />
    </div>
  );
}
