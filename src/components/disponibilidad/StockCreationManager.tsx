
import { useState } from 'react';
import { StockEntry, Equipment } from '../types';
import { equipmentList } from '../data/equipmentList';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Plus } from 'lucide-react';
import { useToast } from './ui/use-toast';

interface StockManagerProps {
  stock: StockEntry[];
  onStockUpdate: (stock: StockEntry[]) => void;
}

export const StockManager = ({ stock, onStockUpdate }: StockManagerProps) => {
  const [localStock, setLocalStock] = useState<StockEntry[]>(stock);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const { toast } = useToast();

  const handleQuantityChange = (equipmentId: string, quantity: number) => {
    setLocalStock(prev =>
      prev.map(item =>
        item.equipmentId === equipmentId
          ? { ...item, baseQuantity: quantity }
          : item
      )
    );
  };

  const handleAddNewItem = () => {
    if (!newItemName.trim()) {
      toast({
        title: "Error",
        description: "El nombre del equipo es requerido",
        variant: "destructive"
      });
      return;
    }

    const newId = newItemName.toLowerCase().replace(/\s+/g, '-');
    
    if (equipmentList.some(e => e.id === newId)) {
      toast({
        title: "Error",
        description: "Ya existe un elemento con este nombre",
        variant: "destructive"
      });
      return;
    }

    const newEquipment: Equipment = {
      id: newId,
      name: newItemName,
      category: newItemCategory || undefined
    };

    equipmentList.push(newEquipment);
    setLocalStock(prev => [...prev, { equipmentId: newId, baseQuantity: 0 }]);
    setNewItemName('');
    setNewItemCategory('');

    toast({
      title: "Éxito",
      description: `Nuevo equipo añadido: ${newItemName}`,
    });
  };

  const handleSave = () => {
    onStockUpdate(localStock);
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleSave} className="w-full mb-4">Guardar Inventario</Button>
      
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
          <Button onClick={handleAddNewItem} className="w-full flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Añadir Equipo
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {equipmentList.map(equipment => (
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
                value={localStock.find(s => s.equipmentId === equipment.id)?.baseQuantity || 0}
                onChange={(e) => handleQuantityChange(equipment.id, parseInt(e.target.value) || 0)}
                className="w-24"
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
