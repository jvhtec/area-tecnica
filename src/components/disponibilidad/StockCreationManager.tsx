
import { useState, useEffect } from 'react';
import { StockEntry } from '@/types/equipment';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface StockManagerProps {
  stock: StockEntry[];
  onStockUpdate: (stock: StockEntry[]) => void;
}

export const StockCreationManager = ({ stock, onStockUpdate }: StockManagerProps) => {
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch equipment list
  const { data: equipmentList = [] } = useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Initialize localStock with entries for all equipment
  const [localStock, setLocalStock] = useState<StockEntry[]>([]);

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

  const createEquipmentMutation = useMutation({
    mutationFn: async () => {
      if (!newItemName.trim()) throw new Error("El nombre del equipo es requerido");

      const { data: existingEquipment } = await supabase
        .from('equipment')
        .select('id')
        .eq('name', newItemName)
        .maybeSingle();

      if (existingEquipment) {
        throw new Error("Ya existe un equipo con este nombre");
      }

      const { data, error } = await supabase
        .from('equipment')
        .insert({
          name: newItemName,
          category: newItemCategory.trim() || null
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newEquipment) => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      
      // Create a new stock entry with quantity 0
      const newStockEntry: StockEntry = {
        equipment_id: newEquipment.id,
        base_quantity: 0,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: ''
      };
      
      setLocalStock(prev => [...prev, newStockEntry]);
      setNewItemName('');
      setNewItemCategory('');
      toast({
        title: "Éxito",
        description: `Nuevo equipo añadido: ${newEquipment.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  });

  const handleQuantityChange = (equipmentId: string, quantity: number) => {
    setLocalStock(prev => {
      const updatedStock = [...prev];
      const existingIndex = updatedStock.findIndex(item => item.equipment_id === equipmentId);
      
      if (existingIndex >= 0) {
        // Update existing entry
        updatedStock[existingIndex] = {
          ...updatedStock[existingIndex],
          base_quantity: quantity
        };
      } else {
        // Create new entry
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

  const handleAddNewItem = () => {
    createEquipmentMutation.mutate();
  };

  const handleSave = () => {
    onStockUpdate(localStock);
  };

  return (
    <div className="space-y-4">
      <Button 
        onClick={handleSave} 
        className="w-full mb-4"
        disabled={createEquipmentMutation.isPending}
      >
        Guardar Inventario
      </Button>
      
      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-medium">Añadir Nuevo Equipo</h3>
        <div className="space-y-2">
          <div>
            <Label>Nombre</Label>
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Ingrese nombre del equipo"
            />
          </div>
          <div>
            <Label>Categoría (opcional)</Label>
            <Input
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
              placeholder="Ingrese categoría"
            />
          </div>
          <Button 
            onClick={handleAddNewItem} 
            className="w-full flex items-center gap-2"
            disabled={createEquipmentMutation.isPending}
          >
            <Plus className="h-4 w-4" />
            Añadir Equipo
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {equipmentList.map(equipment => {
            const stockEntry = localStock.find(s => s.equipment_id === equipment.id);
            return (
              <div key={equipment.id} className="flex items-center space-x-4">
                <div className="flex-1">
                  <Label>{equipment.name}</Label>
                  {equipment.category && (
                    <p className="text-sm text-gray-500">{equipment.category}</p>
                  )}
                </div>
                <Input
                  type="number"
                  min="0"
                  value={stockEntry?.base_quantity || 0}
                  onChange={(e) => handleQuantityChange(equipment.id, parseInt(e.target.value) || 0)}
                  className="w-24"
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
