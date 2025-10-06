import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { PresetEditor } from '@/components/equipment/PresetEditor';
import { PresetItem, PresetWithItems } from '@/types/equipment';
import { Department } from '@/types/equipment';
import { DepartmentProvider } from '@/contexts/DepartmentContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
}

export function TourPresetManagerDialog({ open, onOpenChange, tourId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetWithItems | null>(null);
  const [copyingPreset, setCopyingPreset] = useState<PresetWithItems | null>(null);
  const [presetToDelete, setPresetToDelete] = useState<PresetWithItems | null>(null);
  const [department, setDepartment] = useState<Department>('sound');

  const { data: presets = [] } = useQuery({
    queryKey: ['tour-presets', tourId, department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presets')
        .select(`
          *,
          items:preset_items (
            *,
            equipment:equipment (*)
          )
        `)
        .eq('tour_id', tourId)
        .eq('department', department)
        .order('name');
      if (error) throw error;
      return (data || []) as PresetWithItems[];
    },
    enabled: !!tourId
  });

  const deletePresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const { error: itemsError } = await supabase
        .from('preset_items')
        .delete()
        .eq('preset_id', presetId);
      if (itemsError) throw itemsError;

      const { error: presetError } = await supabase
        .from('presets')
        .delete()
        .eq('id', presetId);
      if (presetError) throw presetError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-presets', tourId] });
      toast({ title: 'Success', description: 'Preset deleted' });
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  });

  const handleSavePreset = async (name: string, items: Omit<PresetItem, 'id' | 'preset_id'>[], fixedTourId?: string | null) => {
    try {
      if (editingPreset) {
        const { error: presetError } = await supabase
          .from('presets')
          .update({ name })
          .eq('id', editingPreset.id);
        if (presetError) throw presetError;

        const { error: delError } = await supabase
          .from('preset_items')
          .delete()
          .eq('preset_id', editingPreset.id);
        if (delError) throw delError;

        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from('preset_items')
            .insert(items.map(i => ({ ...i, preset_id: editingPreset.id })));
          if (itemsError) throw itemsError;
        }
      } else {
        const { data: created, error: createErr } = await supabase
          .from('presets')
          .insert({ name, department, tour_id: tourId })
          .select()
          .single();
        if (createErr) throw createErr;

        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from('preset_items')
            .insert(items.map(i => ({ ...i, preset_id: created.id })));
          if (itemsError) throw itemsError;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['tour-presets', tourId] });
      setEditingPreset(null);
      setCopyingPreset(null);
      setIsCreating(false);
      toast({ title: 'Success', description: 'Preset saved' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const Manager = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Department</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={department}
            onChange={(e) => setDepartment(e.target.value as Department)}
          >
            <option value="sound">Sound</option>
            <option value="lights">Lights</option>
            <option value="video">Video</option>
          </select>
        </div>
        <Button size="sm" onClick={() => setIsCreating(true)}>Create New Preset</Button>
      </div>

      <Card>
        <CardContent>
          <ScrollArea className="h-[420px]">
            <div className="space-y-3 py-2">
              {presets.map((p) => (
                <div key={p.id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.items.length} items · {department}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setCopyingPreset({ ...p, name: `Copy of ${p.name}` })}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditingPreset(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setPresetToDelete(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {presets.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-6">
                  No presets for this tour and department.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tour Presets</DialogTitle>
        </DialogHeader>

        {isCreating || editingPreset || copyingPreset ? (
          <DepartmentProvider department={department}>
            <PresetEditor
              preset={editingPreset || copyingPreset}
              isCopy={!!copyingPreset}
              onSave={handleSavePreset}
              onCancel={() => { setIsCreating(false); setEditingPreset(null); setCopyingPreset(null); }}
              fixedTourId={tourId}
            />
          </DepartmentProvider>
        ) : (
          <Manager />
        )}
      </DialogContent>
    </Dialog>
  );
}

