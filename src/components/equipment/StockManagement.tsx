import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Equipment } from '@/types/equipment';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Minus } from 'lucide-react';
import { StockMovementDialog } from './StockMovementDialog';

export function StockManagement() {
  const { session } = useOptimizedAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isAdditionDialog, setIsAdditionDialog] = useState(true);

  // Fetch equipment list and current stock levels from the view
  const { data: equipmentWithStock } = useQuery({
    queryKey: ['current-stock-levels'],
    queryFn: async () => {
      const { data: stockLevels, error } = await supabase
        .from('current_stock_levels')
        .select('*')
        .order('equipment_name');

      if (error) throw error;
      return stockLevels;
    },
    enabled: !!session?.user?.id
  });

  const handleAddStock = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setIsAdditionDialog(true);
  };

  const handleRemoveStock = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setIsAdditionDialog(false);
  };

  return (
    <div className="space-y-6">
      <ScrollArea className="h-[400px] rounded-md border p-4">
        <div className="space-y-4">
          {equipmentWithStock?.map((item) => {
            const currentQuantity = item.current_quantity || 0;

            return (
              <div key={item.equipment_id} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">{item.equipment_name}</p>
                  {item.category && (
                    <p className="text-sm text-muted-foreground capitalize">{item.category}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold min-w-[3rem] text-center">
                    {currentQuantity}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleAddStock({
                        id: item.equipment_id,
                        name: item.equipment_name,
                        category: item.category,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      })}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveStock({
                        id: item.equipment_id,
                        name: item.equipment_name,
                        category: item.category,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      })}
                      disabled={currentQuantity <= 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {selectedEquipment && (
        <StockMovementDialog
          equipment={selectedEquipment}
          open={!!selectedEquipment}
          onOpenChange={(open) => !open && setSelectedEquipment(null)}
          isAddition={isAdditionDialog}
          currentStock={
            equipmentWithStock?.find(
              (item) => item.equipment_id === selectedEquipment.id
            )?.current_quantity || 0
          }
        />
      )}
    </div>
  );
}
