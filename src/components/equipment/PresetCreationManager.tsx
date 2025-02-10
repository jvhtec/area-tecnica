import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useSessionManager } from '@/hooks/useSessionManager';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Equipment, Preset, PresetItem, PresetWithItems } from '@/types/equipment';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Minus, Save, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';

interface PresetCreationManagerProps {
  onClose?: () => void;
  selectedDate?: Date;
}

const EQUIPMENT_CATEGORIES = ['convencional', 'robotica', 'fx', 'rigging', 'controles', 'cuadros', 'led', 'strobo'] as const;

const categoryLabels: Record<string, string> = {
  convencional: 'Convencional',
  robotica: 'Robótica',
  fx: 'FX',
  rigging: 'Rigging',
  controles: 'Controles',
  cuadros: 'Cuadros',
  led: 'LED',
  strobo: 'Strobo'
};

export function PresetCreationManager({ onClose, selectedDate }: PresetCreationManagerProps) {
  const { session } = useSessionManager();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [presetName, setPresetName] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<Record<string, number>>({});
  const isMobile = useIsMobile();

  // Fetch equipment list
  const { data: equipment } = useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Equipment[];
    }
  });

  // Fetch user's presets
  const { data: presets } = useQuery({
    queryKey: ['presets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presets')
        .select(`
          *,
          items:preset_items(
            *,
            equipment(*)
          )
        `)
        .eq('user_id', session?.user?.id);
      
      if (error) throw error;
      return (data || []).map(preset => ({
        ...preset,
        items: preset.items || [] // Ensure items is always an array
      })) as PresetWithItems[];
    },
    enabled: !!session?.user?.id
  });

  const createPresetMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('Must be logged in');
      if (!presetName.trim()) throw new Error('Preset name is required');
      if (Object.keys(selectedEquipment).length === 0) {
        throw new Error('Please select at least one equipment item');
      }

      // First create the preset
      const { data: preset, error: presetError } = await supabase
        .from('presets')
        .insert({
          name: presetName,
          user_id: session.user.id
        })
        .select()
        .single();

      if (presetError) throw presetError;

      // Then create all preset items
      const presetItems = Object.entries(selectedEquipment).map(([equipmentId, quantity]) => ({
        preset_id: preset.id,
        equipment_id: equipmentId,
        quantity
      }));

      const { error: itemsError } = await supabase
        .from('preset_items')
        .insert(presetItems);

      if (itemsError) throw itemsError;

      return preset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presets'] });
      setPresetName('');
      setSelectedEquipment({});
      toast({
        title: "Success",
        description: "Preset created successfully"
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

  const deletePresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const { error } = await supabase
        .from('presets')
        .delete()
        .eq('id', presetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presets'] });
      toast({
        title: "Success",
        description: "Preset deleted successfully"
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete preset"
      });
    }
  });

  const assignPresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      if (!session?.user?.id || !selectedDate) throw new Error('Missing required data');

      const { error } = await supabase
        .from('day_preset_assignments')
        .upsert({
          date: format(selectedDate, 'yyyy-MM-dd'),
          preset_id: presetId,
          user_id: session.user.id
        }, {
          onConflict: 'date,user_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preset-assignments'] });
      toast({
        title: "Success",
        description: "Preset assigned to date successfully"
      });
      if (onClose) onClose();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign preset to date"
      });
    }
  });

  const handleQuantityChange = (equipmentId: string, change: number) => {
    setSelectedEquipment(prev => {
      const current = prev[equipmentId] || 0;
      const newQuantity = Math.max(0, current + change);
      
      if (newQuantity === 0) {
        const { [equipmentId]: _, ...rest } = prev;
        return rest;
      }
      
      return { ...prev, [equipmentId]: newQuantity };
    });
  };

  const handleSave = () => {
    createPresetMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="presetName">Preset Name</Label>
          <Input
            id="presetName"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Enter preset name"
          />
        </div>

        <ScrollArea className={`${isMobile ? 'h-[400px]' : 'h-[300px]'} border rounded-md p-2 md:p-4`}>
          <Tabs defaultValue="convencional" className="w-full">
            <TabsList className="w-full flex overflow-x-auto no-scrollbar">
              {EQUIPMENT_CATEGORIES.map(category => (
                <TabsTrigger 
                  key={category} 
                  value={category} 
                  className="flex-shrink-0 whitespace-nowrap px-2 md:px-4"
                >
                  {categoryLabels[category]}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {EQUIPMENT_CATEGORIES.map(category => (
              <TabsContent key={category} value={category} className="mt-4 space-y-3">
                {equipment
                  ?.filter(item => item.category === category)
                  .map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm md:text-base">
                      <span className="truncate mr-2">{item.name}</span>
                      <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size={isMobile ? "sm" : "icon"}
                          onClick={() => handleQuantityChange(item.id, -1)}
                          disabled={!selectedEquipment[item.id]}
                          className="h-8 w-8"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center">{selectedEquipment[item.id] || 0}</span>
                        <Button
                          variant="outline"
                          size={isMobile ? "sm" : "icon"}
                          onClick={() => handleQuantityChange(item.id, 1)}
                          className="h-8 w-8"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </TabsContent>
            ))}
          </Tabs>
        </ScrollArea>

        <div className="flex justify-end gap-2">
          {onClose && (
            <Button 
              variant="outline" 
              onClick={onClose}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            disabled={createPresetMutation.isPending || !presetName.trim() || Object.keys(selectedEquipment).length === 0}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Preset
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">Saved Presets</h3>
        {presets?.map((preset) => (
          <Card key={preset.id}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{preset.name}</CardTitle>
                <div className="flex gap-2">
                  {selectedDate && (
                    <Button
                      variant="outline"
                      onClick={() => assignPresetMutation.mutate(preset.id)}
                      disabled={assignPresetMutation.isPending}
                      className="text-sm"
                    >
                      Assign to {format(selectedDate, 'PP')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePresetMutation.mutate(preset.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {preset.items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.equipment?.name}</span>
                    <span>x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
