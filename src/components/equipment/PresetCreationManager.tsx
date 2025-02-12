
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSessionManager } from '@/hooks/useSessionManager';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PresetEditor } from './PresetEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, Trash2 } from 'lucide-react';
import { PresetWithItems } from '@/types/equipment';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface PresetCreationManagerProps {
  onClose?: () => void;
  selectedDate?: Date;
}

export function PresetCreationManager({ onClose, selectedDate }: PresetCreationManagerProps) {
  const { session } = useSessionManager();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPreset, setEditingPreset] = useState<PresetWithItems | null>(null);
  const [presetToDelete, setPresetToDelete] = useState<PresetWithItems | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch user's presets
  const { data: presets } = useQuery({
    queryKey: ['presets', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      
      const { data, error } = await supabase
        .from('presets')
        .select(`
          *,
          items:preset_items (
            *,
            equipment:equipment (*)
          )
        `)
        .eq('user_id', session.user.id)
        .order('name');
      
      if (error) throw error;
      return data as PresetWithItems[];
    },
    enabled: !!session?.user?.id
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

  const handleSavePreset = async (name: string, items: any[]) => {
    try {
      if (!session?.user?.id) throw new Error('Must be logged in');

      if (editingPreset) {
        // Update existing preset
        const { error: presetError } = await supabase
          .from('presets')
          .update({ name })
          .eq('id', editingPreset.id);

        if (presetError) throw presetError;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('preset_items')
          .delete()
          .eq('preset_id', editingPreset.id);

        if (deleteError) throw deleteError;
      } else {
        // Create new preset
        const { data: preset, error: presetError } = await supabase
          .from('presets')
          .insert({
            name,
            user_id: session.user.id
          })
          .select()
          .single();

        if (presetError) throw presetError;

        // Insert new items
        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from('preset_items')
            .insert(
              items.map(item => ({
                preset_id: preset.id,
                equipment_id: item.equipment_id,
                quantity: item.quantity
              }))
            );

          if (itemsError) throw itemsError;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['presets'] });
      setEditingPreset(null);
      setIsCreating(false);
      toast({
        title: "Success",
        description: "Preset saved successfully"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  };

  if (isCreating || editingPreset) {
    return (
      <PresetEditor
        preset={editingPreset}
        onSave={handleSavePreset}
        onCancel={() => {
          setEditingPreset(null);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Presets</h2>
        <Button onClick={() => setIsCreating(true)}>
          Create New Preset
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Presets</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {presets?.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h3 className="font-medium">{preset.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {preset.items.length} items
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingPreset(preset)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPresetToDelete(preset)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!presets || presets.length === 0) && (
                <p className="text-muted-foreground text-center py-4">
                  No presets created yet
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog 
        open={!!presetToDelete}
        onOpenChange={(open) => !open && setPresetToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the preset
              and remove it from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (presetToDelete) {
                  deletePresetMutation.mutate(presetToDelete.id);
                  setPresetToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
