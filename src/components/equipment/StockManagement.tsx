
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSessionManager } from '@/hooks/useSessionManager';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Equipment, StockEntry } from '@/types/equipment';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Save } from 'lucide-react';

export function StockManagement() {
  const { session } = useSessionManager();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');

  // Fetch equipment list and stock entries
  const { data: equipmentWithStock } = useQuery({
    queryKey: ['equipment-with-stock'],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data: equipment } = await supabase
        .from('equipment')
        .select('*')
        .order('name');

      const { data: stockEntries } = await supabase
        .from('stock_entries')
        .select('*')
        .eq('user_id', session.user.id);

      if (!equipment) return [];

      // Create a map of equipment quantities
      const stockMap = (stockEntries || []).reduce((acc, entry) => {
        acc[entry.equipment_id] = entry.base_quantity;
        return acc;
      }, {} as Record<string, number>);

      return equipment.map(item => ({
        ...item,
        quantity: stockMap[item.id] || 0
      }));
    },
    enabled: !!session?.user?.id
  });

  const createEquipmentMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('Debe iniciar sesión');
      if (!newItemName.trim()) throw new Error('El nombre del equipo es requerido');

      const { data: existingEquipment, error: checkError } = await supabase
        .from('equipment')
        .select('id')
        .eq('name', newItemName)
        .single();

      if (existingEquipment) throw new Error('Ya existe un equipo con este nombre');

      const { error } = await supabase
        .from('equipment')
        .insert({
          name: newItemName,
          category: newItemCategory.trim() || null
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-with-stock'] });
      setNewItemName('');
      setNewItemCategory('');
      toast({
        title: "Éxito",
        description: "Equipo creado correctamente"
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  });

  const updateStockMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('Debe iniciar sesión');

      const entries = Object.entries(quantities).map(([equipmentId, quantity]) => ({
        user_id: session.user.id,
        equipment_id: equipmentId,
        base_quantity: quantity
      }));

      if (entries.length === 0) return;

      const { error } = await supabase
        .from('stock_entries')
        .upsert(entries, {
          onConflict: 'user_id,equipment_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-with-stock'] });
      setQuantities({});
      toast({
        title: "Éxito",
        description: "Cantidades actualizadas correctamente"
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  });

  const handleQuantityChange = (equipmentId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    if (quantity >= 0) {
      setQuantities(prev => ({
        ...prev,
        [equipmentId]: quantity
      }));
    }
  };

  const hasChanges = Object.keys(quantities).length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
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
            onClick={() => createEquipmentMutation.mutate()}
            disabled={createEquipmentMutation.isPending || !newItemName.trim()}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Añadir Equipo
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[400px] rounded-md border p-4">
        <div className="space-y-4">
          {equipmentWithStock?.map((item) => {
            const currentQuantity = quantities[item.id] ?? item.quantity;
            const hasChanged = quantities[item.id] !== undefined;

            return (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  {item.category && (
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                  )}
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min="0"
                    value={currentQuantity}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    className={hasChanged ? "border-primary" : ""}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <Button 
        onClick={() => updateStockMutation.mutate()}
        disabled={updateStockMutation.isPending || !hasChanges}
        className="w-full"
      >
        <Save className="mr-2 h-4 w-4" />
        Guardar Cantidades
      </Button>
    </div>
  );
}
