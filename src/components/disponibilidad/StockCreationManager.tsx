
import { useState, useEffect } from 'react';
import { StockEntry, Equipment } from '@/types/equipment';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { EquipmentCreationManager } from '@/components/equipment/EquipmentCreationManager';
import { StockMovementDialog } from '@/components/equipment/StockMovementDialog';

interface StockManagerProps {
  stock: StockEntry[];
  onStockUpdate: (stock: StockEntry[]) => void;
  department: string;
}

type GroupedEquipment = {
  [key: string]: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    currentQuantity: number;
  }>;
};

export const StockCreationManager = ({ stock, onStockUpdate, department }: StockManagerProps) => {
  const { toast } = useToast();
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [selectedCurrentStock, setSelectedCurrentStock] = useState<number>(0);
  const [isAdditionDialog, setIsAdditionDialog] = useState(true);
  const [showMovementDialog, setShowMovementDialog] = useState(false);

  // Fetch equipment list filtered by department
  const { data: equipmentList = [], refetch: refetchEquipment } = useQuery<Equipment[]>({
    queryKey: ['equipment', department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('department', department)
        .order('category')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch current stock levels filtered by department
  const { data: currentStockLevels = [] } = useQuery({
    queryKey: ['current-stock-levels', department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_stock_levels')
        .select('*')
        .eq('department', department);
      
      if (error) throw error;
      return data;
    }
  });

  // Initialize localStock with entries for all equipment
  const [localStock, setLocalStock] = useState<StockEntry[]>([]);

  // Initialize localStock when equipment list or stock changes
  useEffect(() => {
    const updatedStock = equipmentList.map(equipment => {
      const existingEntry = stock.find(s => s.equipment_id === equipment.id);
      if (existingEntry) {
        return existingEntry;
      }
      return {
        equipment_id: equipment.id,
        base_quantity: 0,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
    setLocalStock(updatedStock);
  }, [equipmentList, stock]);

  const handleQuantityChange = (equipmentId: string, quantity: number) => {
    setLocalStock(prev => {
      const updatedStock = [...prev];
      const existingIndex = updatedStock.findIndex(item => item.equipment_id === equipmentId);
      
      if (existingIndex >= 0) {
        updatedStock[existingIndex] = {
          ...updatedStock[existingIndex],
          base_quantity: quantity
        };
      } else {
        updatedStock.push({
          equipment_id: equipmentId,
          base_quantity: quantity,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      return updatedStock;
    });
  };

  // Group equipment by category with current stock levels
  const groupedEquipment = equipmentList.reduce((acc: GroupedEquipment, equipment) => {
    const category = equipment.category || 'uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    
    const stockEntry = localStock.find(s => s.equipment_id === equipment.id);
    const currentLevel = currentStockLevels.find(s => s.equipment_id === equipment.id);
    
    acc[category].push({
      id: equipment.id,
      name: equipment.name,
      category: equipment.category,
      quantity: stockEntry?.base_quantity || 0,
      currentQuantity: currentLevel?.current_quantity || 0
    });
    
    return acc;
  }, {});

  const handleSave = () => {
    onStockUpdate(localStock);
    toast({
      title: "Éxito",
      description: "Stock actualizado correctamente"
    });
  };

  const handleEquipmentChange = () => {
    refetchEquipment();
  };

  const handleMovementClick = (equipment: Equipment, isAddition: boolean, currentQuantity: number) => {
    setSelectedEquipment(equipment);
    setSelectedCurrentStock(currentQuantity);
    setIsAdditionDialog(isAddition);
    setShowMovementDialog(true);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Gestionar Equipamiento</h2>
        <EquipmentCreationManager onEquipmentChange={handleEquipmentChange} department={department} />
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Gestionar Stock</h2>
        <Button 
          onClick={handleSave} 
          className="w-full mb-4"
        >
          Guardar Inventario
        </Button>

        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-8">
            {Object.entries(groupedEquipment).map(([category, items]) => (
              <div key={category} className="space-y-4">
                <h3 className="text-lg font-semibold capitalize">{category}</h3>
                <div className="space-y-4">
                  {items.map(equipment => (
                    <div key={equipment.id} className="flex items-center space-x-4">
                      <div className="flex-1">
                        <Label>{equipment.name}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleMovementClick(
                            equipmentList.find(e => e.id === equipment.id)!,
                            false,
                            equipment.currentQuantity
                          )}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={equipment.currentQuantity}
                          readOnly
                          className="w-24 bg-muted"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleMovementClick(
                            equipmentList.find(e => e.id === equipment.id)!,
                            true,
                            equipment.currentQuantity
                          )}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {selectedEquipment && (
        <StockMovementDialog
          open={showMovementDialog}
          onOpenChange={setShowMovementDialog}
          equipment={selectedEquipment}
          isAddition={isAdditionDialog}
          currentStock={selectedCurrentStock}
        />
      )}
    </div>
  );
};

