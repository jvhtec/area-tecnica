
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Equipment, PresetItem } from '@/types/equipment';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Plus, Minus, Save } from 'lucide-react';

interface JobPresetManagerProps {
  jobId: string;
}

export const JobPresetManager = ({ jobId }: JobPresetManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localItems, setLocalItems] = useState<Record<string, number>>({});

  // Fetch job preset and items
  const { data: preset } = useQuery({
    queryKey: ['job-preset', jobId],
    queryFn: async () => {
      const { data: presetData, error: presetError } = await supabase
        .from('job_equipment_presets')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (presetError) throw presetError;

      if (presetData) {
        const { data: items, error: itemsError } = await supabase
          .from('job_preset_items')
          .select(`
            *,
            equipment:equipment (*)
          `)
          .eq('preset_id', presetData.id);

        if (itemsError) throw itemsError;

        return {
          ...presetData,
          items: items || []
        };
      }

      return null;
    }
  });

  // Fetch available equipment
  const { data: equipment = [] } = useQuery<Equipment[]>({
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

  // Initialize local items from preset
  useState(() => {
    if (preset?.items) {
      const initialItems: Record<string, number> = {};
      preset.items.forEach((item: PresetItem) => {
        initialItems[item.equipment_id] = item.quantity;
      });
      setLocalItems(initialItems);
    }
  });

  // Save preset mutation
  const savePresetMutation = useMutation({
    mutationFn: async () => {
      // Create preset if it doesn't exist
      let presetId = preset?.id;
      if (!presetId) {
        const { data: newPreset, error: presetError } = await supabase
          .from('job_equipment_presets')
          .insert({ job_id: jobId })
          .select()
          .single();

        if (presetError) throw presetError;
        presetId = newPreset.id;
      }

      // Update preset items
      const items = Object.entries(localItems).map(([equipmentId, quantity]) => ({
        preset_id: presetId,
        equipment_id: equipmentId,
        quantity
      }));

      // Delete existing items
      const { error: deleteError } = await supabase
        .from('job_preset_items')
        .delete()
        .eq('preset_id', presetId);

      if (deleteError) throw deleteError;

      // Insert new items
      const { error: insertError } = await supabase
        .from('job_preset_items')
        .insert(items);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-preset'] });
      toast({
        title: "Success",
        description: "Preset saved successfully"
      });
    },
    onError: (error) => {
      console.error('Error saving preset:', error);
      toast({
        title: "Error",
        description: "Failed to save preset",
        variant: "destructive"
      });
    }
  });

  const handleQuantityChange = (equipmentId: string, quantity: number) => {
    setLocalItems(prev => ({
      ...prev,
      [equipmentId]: Math.max(0, quantity)
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Equipment Preset</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => savePresetMutation.mutate()}
          className="w-full mb-4"
          disabled={savePresetMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Preset
        </Button>

        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-8">
            {equipment.reduce((acc: JSX.Element[], equipment) => {
              const category = equipment.category || 'uncategorized';
              if (!acc.some(el => el.key === category)) {
                acc.push(
                  <div key={category} className="space-y-4">
                    <h3 className="text-lg font-semibold capitalize">{category}</h3>
                    <div className="space-y-4">
                      {equipment.filter(e => e.category === category).map(e => (
                        <div key={e.id} className="flex items-center space-x-4">
                          <div className="flex-1">
                            <Label>{e.name}</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleQuantityChange(e.id, (localItems[e.id] || 0) - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={localItems[e.id] || 0}
                              onChange={(e) => handleQuantityChange(e.id, parseInt(e.target.value) || 0)}
                              className="w-24"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleQuantityChange(e.id, (localItems[e.id] || 0) + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return acc;
            }, [])}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

