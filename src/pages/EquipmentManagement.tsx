import { useState } from 'react';
import { StockEntry } from '@/types/equipment';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { StockCreationManager } from '@/components/disponibilidad/StockCreationManager';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function EquipmentManagement() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch current stock entries using the correct table name
  const { data: stockEntries = [], error: stockError } = useQuery({
    queryKey: ['stock-entries'],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      
      const { data, error } = await supabase
        .from('global_stock_entries')
        .select('*');

      if (error) {
        console.error('Error fetching stock entries:', error);
        throw error;
      }
      return data as StockEntry[];
    },
    enabled: !!session?.user?.id
  });

  // Update stock entries mutation with correct table name
  const updateStockMutation = useMutation({
    mutationFn: async (updatedStock: StockEntry[]) => {
      if (!session?.user?.id) throw new Error('No user session');

      // Process each stock entry individually
      for (const entry of updatedStock) {
        const { error: upsertError } = await supabase
          .from('global_stock_entries')
          .upsert({
            id: entry.id,
            equipment_id: entry.equipment_id,
            base_quantity: entry.base_quantity
          });

        if (upsertError) {
          console.error('Error updating stock entry:', upsertError);
          throw upsertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-entries'] });
      queryClient.invalidateQueries({ queryKey: ['current-stock-levels'] });
      toast({
        title: "Éxito",
        description: "Inventario actualizado correctamente"
      });
    },
    onError: (error) => {
      console.error('Error in updateStockMutation:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al actualizar el inventario"
      });
    }
  });

  const handleStockUpdate = (updatedStock: StockEntry[]) => {
    updateStockMutation.mutate(updatedStock);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Gestionar Inventario</h1>
      </div>

      {stockError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Error al cargar el inventario. Por favor, inténtelo de nuevo más tarde.
          </AlertDescription>
        </Alert>
      ) : (
        <StockCreationManager 
          stock={stockEntries}
          onStockUpdate={handleStockUpdate}
        />
      )}
    </div>
  );
}
