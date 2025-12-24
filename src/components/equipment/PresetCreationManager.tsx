import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PresetEditor } from './PresetEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { PA_PRESET_ALLOWED_CATEGORIES, PresetWithItems, PresetItem, mapPresetWithItemsRow } from '@/types/equipment';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDepartment } from '@/contexts/DepartmentContext';
import { endOfDay, startOfDay } from 'date-fns';

interface PresetCreationManagerProps {
  onClose?: () => void;
  selectedDate?: Date;
}

export function PresetCreationManager({ onClose, selectedDate }: PresetCreationManagerProps) {
  const { session } = useOptimizedAuth();
  const { department } = useDepartment();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPreset, setEditingPreset] = useState<PresetWithItems | null>(null);
  const [copyingPreset, setCopyingPreset] = useState<PresetWithItems | null>(null);
  const [presetToDelete, setPresetToDelete] = useState<PresetWithItems | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const dayRange = useMemo(() => {
    if (!selectedDate) return null;
    return {
      start: startOfDay(selectedDate).toISOString(),
      end: endOfDay(selectedDate).toISOString(),
    };
  }, [selectedDate]);

  const { data: jobsForSelectedDate = [] } = useQuery({
    queryKey: ['jobs-for-preset-push', department, dayRange?.start, dayRange?.end],
    queryFn: async () => {
      if (!department || !dayRange) return [];

      const { data, error } = await supabase
        .from('jobs')
        .select(
          `
            id,
            title,
            start_time,
            end_time,
            job_departments!inner(department)
          `
        )
        .in('job_type', ['single', 'festival', 'tourdate', 'evento'])
        .eq('job_departments.department', department)
        // Include jobs overlapping this day (handle end_time NULL)
        .or(
          `and(end_time.is.null,start_time.gte.${dayRange.start},start_time.lte.${dayRange.end}),and(end_time.gte.${dayRange.start},start_time.lte.${dayRange.end})`
        )
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        title: string | null;
        start_time: string | null;
      }>;
    },
    enabled: Boolean(department && dayRange),
  });

  const jobCandidates = useMemo(
    () =>
      jobsForSelectedDate
        .filter((job) => Boolean(job?.id))
        .map((job) => ({
          id: job.id,
          title: job.title || 'Untitled job',
          startTime: job.start_time,
        })),
    [jobsForSelectedDate]
  );

  // Fetch all presets for the department (shared access)
  const { data: presets } = useQuery({
    queryKey: ['presets', department],
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
        .eq('department', department)
        .order('is_template', { ascending: false })
        .order('name');
      
      if (error) throw error;
      return (data || []).map(mapPresetWithItemsRow);
    },
    enabled: !!session?.user?.id
  });

  const deletePresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      // Delete preset items first
      const { error: itemsError } = await supabase
        .from('preset_items')
        .delete()
        .eq('preset_id', presetId);

      if (itemsError) throw itemsError;

      // Then delete the preset
      const { error: presetError } = await supabase
        .from('presets')
        .delete()
        .eq('id', presetId);

      if (presetError) throw presetError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presets', department] });
      toast({
        title: "Success",
        description: "Preset deleted successfully"
      });
    },
    onError: (error) => {
      console.error('Error deleting preset:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete preset"
      });
    }
  });

  const handleSavePreset = async (name: string, items: Omit<PresetItem, 'id' | 'preset_id'>[], tourId?: string | null) => {
    try {
      if (!session?.user?.id) throw new Error('Must be logged in');

      if (editingPreset) {
        // Update existing preset
        const { error: presetError } = await supabase
          .from('presets')
          .update({ name, tour_id: tourId ?? null })
          .eq('id', editingPreset.id);

        if (presetError) throw presetError;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('preset_items')
          .delete()
          .eq('preset_id', editingPreset.id);

        if (deleteError) throw deleteError;

        // Insert updated items
        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from('preset_items')
            .insert(
              items.map(item => ({
                ...item,
                preset_id: editingPreset.id
              }))
            );

          if (itemsError) throw itemsError;
        }
      } else {
        // Create new preset (now using created_by, user_id is nullable for shared presets)
        const { data: preset, error: presetError } = await supabase
          .from('presets')
          .insert({
            name,
            created_by: session.user.id,
            user_id: session.user.id, // Keep for backwards compatibility
            is_template: false,
            department: department,
            tour_id: tourId ?? null
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
                ...item,
                preset_id: preset.id
              }))
            );

          if (itemsError) throw itemsError;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['presets', department] });
      setEditingPreset(null);
      setCopyingPreset(null);
      setIsCreating(false);
      toast({
        title: "Success",
        description: "Preset saved successfully"
      });
    } catch (error) {
      console.error('Error saving preset:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save preset'
      });
    }
  };

  if (isCreating || editingPreset || copyingPreset) {
    return (
      <PresetEditor
        preset={editingPreset || copyingPreset}
        isCopy={!!copyingPreset}
        onSave={handleSavePreset}
        onCancel={() => {
          setEditingPreset(null);
          setCopyingPreset(null);
          setIsCreating(false);
        }}
        jobId={(editingPreset || copyingPreset)?.job_id ?? undefined}
        jobCandidates={jobCandidates}
        allowedCategories={department === 'sound' ? PA_PRESET_ALLOWED_CATEGORIES : undefined}
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
                      onClick={() => {
                        const presetCopy = {
                          ...preset,
                          name: `Copy of ${preset.name}`
                        };
                        setCopyingPreset(presetCopy);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
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
