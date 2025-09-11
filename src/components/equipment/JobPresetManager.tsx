
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Equipment } from '@/types/equipment';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Minus, Save } from 'lucide-react';

interface JobPresetManagerProps {
  jobId: string;
}

export const JobPresetManager = ({ jobId }: JobPresetManagerProps) => {
  const { toast } = useToast();
  const [localItems, setLocalItems] = useState<Record<string, number>>({});

  // Note: This is a temporary stub - job equipment preset tables don't exist yet
  const preset = null;

  // Fetch available equipment
  const { data: equipmentList = [] } = useQuery<Equipment[]>({
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

  // Save preset function (placeholder)
  const handleSavePreset = () => {
    toast({
      title: "Coming Soon",
      description: "Job equipment presets will be available soon",
      variant: "default"
    });
  };

  const handleQuantityChange = (equipmentId: string, newQuantity: number) => {
    setLocalItems(prev => ({
      ...prev,
      [equipmentId]: Math.max(0, newQuantity)
    }));
  };

  // Group equipment by category
  const groupedEquipment = equipmentList.reduce((grouped: Record<string, Equipment[]>, item) => {
    const category = item.category || 'uncategorized';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
    return grouped;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Equipment Preset</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleSavePreset}
          className="w-full mb-4"
        >
          <Save className="mr-2 h-4 w-4" />
          Save Preset
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
                          onClick={() => handleQuantityChange(equipment.id, (localItems[equipment.id] || 0) - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={localItems[equipment.id] || 0}
                          onChange={(e) => handleQuantityChange(equipment.id, parseInt(e.target.value) || 0)}
                          className="w-24"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleQuantityChange(equipment.id, (localItems[equipment.id] || 0) + 1)}
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
      </CardContent>
    </Card>
  );
};
