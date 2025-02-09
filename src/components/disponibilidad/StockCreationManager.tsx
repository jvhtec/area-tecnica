
import { useState, useEffect } from 'react';
import { StockEntry } from '@/types/equipment';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface StockManagerProps {
  stock: StockEntry[];
  onStockUpdate: (stock: StockEntry[]) => void;
}

type GroupedEquipment = {
  [key: string]: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
  }>;
};

export const StockCreationManager = ({ stock, onStockUpdate }: StockManagerProps) => {
  const { toast } = useToast();

  // Fetch equipment list
  const { data: equipmentList = [] } = useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('category')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Initialize localStock with entries for all equipment
  const [localStock, setLocalStock] = useState<StockEntry[]>([]);

  // Group equipment by category
  const groupedEquipment = equipmentList.reduce((acc: GroupedEquipment, equipment) => {
    const category = equipment.category || 'uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    
    const stockEntry = localStock.find(s => s.equipment_id === equipment.id);
    acc[category].push({
      id: equipment.id,
      name: equipment.name,
      category: equipment.category,
      quantity: stockEntry?.base_quantity || 0
    });
    
    return acc;
  }, {});

  // Update localStock when equipment list or stock changes
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
        updated_at: new Date().toISOString(),
        user_id: '' // This will be set when saving to the database
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
          updated_at: new Date().toISOString(),
          user_id: ''
        });
      }
      
      return updatedStock;
    });
  };

  const handleSave = () => {
    onStockUpdate(localStock);
  };

  return (
    <div className="space-y-4">
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
                    <Input
                      type="number"
                      min="0"
                      value={equipment.quantity}
                      onChange={(e) => handleQuantityChange(equipment.id, parseInt(e.target.value) || 0)}
                      className="w-24"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
