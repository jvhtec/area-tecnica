import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PresetWithItems, Equipment, PresetItem } from '@/types/equipment';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Save, X } from 'lucide-react';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';

interface PresetEditorProps {
  preset?: PresetWithItems;
  isCopy?: boolean;
  onSave: (name: string, items: Omit<PresetItem, 'id' | 'preset_id'>[]) => void;
  onCancel: () => void;
}

export const PresetEditor = ({ preset, isCopy = false, onSave, onCancel }: PresetEditorProps) => {
  const { session } = useOptimizedAuth();
  const [name, setName] = useState(preset?.name || '');
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    if (!preset?.items) return {};
    return preset.items.reduce((acc, item) => {
      acc[item.equipment_id] = item.quantity;
      return acc;
    }, {} as Record<string, number>);
  });

  // Fetch equipment list
  const { data: equipmentList } = useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data: equipment, error } = await supabase
        .from('equipment')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return equipment as Equipment[];
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

  const handleSave = () => {
    if (!name.trim()) return;

    const now = new Date().toISOString();
    const items = Object.entries(quantities)
      .filter(([_, quantity]) => quantity > 0)
      .map(([equipment_id, quantity]) => ({
        equipment_id,
        quantity,
        notes: '',
        created_at: now,
        updated_at: now
      }));

    onSave(name, items);
  };

  return (
    <Card className="w-full h-[600px] bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>
          {isCopy ? 'Copy Preset' : preset ? 'Edit Preset' : 'Create New Preset'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="preset-name">Preset Name</Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter preset name..."
              className="mt-1"
            />
          </div>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {equipmentList?.map((equipment) => (
                <div key={equipment.id} className="flex items-center space-x-4">
                  <div className="flex-1">
                    <Label>{equipment.name}</Label>
                    {equipment.category && (
                      <p className="text-sm text-muted-foreground">{equipment.category}</p>
                    )}
                  </div>
                  <Input
                    type="number"
                    min="0"
                    value={quantities[equipment.id] || 0}
                    onChange={(e) => handleQuantityChange(equipment.id, e.target.value)}
                    className="w-24"
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onCancel}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              <Save className="mr-2 h-4 w-4" />
              Save Preset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
