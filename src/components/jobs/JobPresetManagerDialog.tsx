import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Pencil, Trash2, Calculator } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { PresetEditor } from '@/components/equipment/PresetEditor';
import { PA_PRESET_ALLOWED_CATEGORIES, PresetItem, PresetWithItems, Department, mapPresetWithItemsRow } from '@/types/equipment';
import { DepartmentProvider } from '@/contexts/DepartmentContext';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { AmplifierTool } from '@/components/sound/AmplifierTool';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

/**
 * Render a dialog UI for managing and assigning equipment presets for a specific job.
 *
 * Provides listing, creation, copying, editing, deletion, and bulk assignment of presets scoped to a selected department (sound, lights, video). When creating or editing, exposes a preset editor and optionally an amplifier calculator for sound presets.
 *
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback invoked when the dialog open state changes
 * @param jobId - ID of the job whose presets are being managed
 * @returns The Job Preset Manager dialog element
 */
export function JobPresetManagerDialog({ open, onOpenChange, jobId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetWithItems | null>(null);
  const [copyingPreset, setCopyingPreset] = useState<PresetWithItems | null>(null);
  const [presetToDelete, setPresetToDelete] = useState<PresetWithItems | null>(null);
  const [department, setDepartment] = useState<Department>('sound');
  const [showCalculator, setShowCalculator] = useState(false);

  // Fetch job date range
  const { data: jobDates = [] } = useQuery({
    queryKey: ['job-dates', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('start_time, end_time')
        .eq('id', jobId)
        .single();
      if (error) throw error;
      if (!data) return [];
      const start = new Date(data.start_time);
      const end = new Date(data.end_time);
      const dates: Date[] = [];
      const d = new Date(start);
      while (d <= end) {
        dates.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
      return dates;
    },
    enabled: !!jobId
  });

  // Fetch presets for this job and selected department
  const { data: presets = [] } = useQuery({
    queryKey: ['job-presets', jobId, department],
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
        .eq('department', department)
        .eq('job_id', jobId)
        .order('name');
      if (error) throw error;
      return (data || []).map(mapPresetWithItemsRow);
    }
  });

  // Assign a preset to all job dates
  const assignPresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      // Choose sequential order per date
      const rows = await Promise.all(jobDates.map(async (dt) => {
        const dateStr = format(dt, 'yyyy-MM-dd');
        const { data: existing } = await supabase
          .from('day_preset_assignments')
          .select('order')
          .eq('date', dateStr)
          .order('order', { ascending: false })
          .limit(1);
        const nextOrder = existing && existing.length > 0 ? ((existing[0].order || 0) + 1) : 0;
        return {
          date: dateStr,
          preset_id: presetId,
          user_id: session?.user?.id || '00000000-0000-0000-0000-000000000000',
          order: nextOrder,
          source: 'job',
          source_id: jobId
        };
      }));
      const { error } = await supabase.from('day_preset_assignments').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preset-assignments'] });
      toast({ title: 'Assigned', description: 'Preset assigned to job dates' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign preset to job dates',
        variant: 'destructive',
      });
    }
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
      queryClient.invalidateQueries({ queryKey: ['presets', department] });
      toast({ title: 'Preset deleted' });
    },
    onError: (error) =>
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete preset',
        variant: 'destructive',
      })
  });

  const handleSavePreset = async (name: string, items: Omit<PresetItem, 'id' | 'preset_id'>[]) => {
    try {
      const { data: created, error: createErr } = await supabase
        .from('presets')
        .insert({ name, department, job_id: jobId })
        .select()
        .single();
      if (createErr) throw createErr;

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('preset_items')
          .insert(items.map(i => ({ ...i, preset_id: created.id })));
        if (itemsError) throw itemsError;
      }

      // Auto-assign preset to all job dates
      if (jobDates.length > 0) {
        const rows = await Promise.all(jobDates.map(async (dt) => {
          const dateStr = format(dt, 'yyyy-MM-dd');
          const { data: existing } = await supabase
            .from('day_preset_assignments')
            .select('order')
            .eq('date', dateStr)
            .order('order', { ascending: false })
            .limit(1);
          const nextOrder = existing && existing.length > 0 ? ((existing[0].order || 0) + 1) : 0;
          return {
            date: dateStr,
            preset_id: created.id,
            user_id: session?.user?.id || '00000000-0000-0000-0000-000000000000',
            order: nextOrder,
            source: 'job',
            source_id: jobId
          };
        }));
        const { error: assignError } = await supabase.from('day_preset_assignments').insert(rows);
        if (assignError) {
          console.error('Error auto-assigning preset:', assignError);
          // Don't throw - preset was created successfully, just notify about assignment issue
          toast({
            title: 'Preset saved',
            description: 'Preset created but could not auto-assign to dates',
            variant: 'default'
          });
          queryClient.invalidateQueries({ queryKey: ['job-presets', jobId, department] });
          setIsCreating(false);
          setEditingPreset(null);
          setCopyingPreset(null);
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['preset-assignments'] });
      }

      queryClient.invalidateQueries({ queryKey: ['job-presets', jobId, department] });
      setIsCreating(false);
      setEditingPreset(null);
      setCopyingPreset(null);
      toast({ title: 'Preset saved and assigned to all job dates' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save preset',
        variant: 'destructive',
      });
    }
  };

  const Manager = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
        <div className="flex gap-2 w-full sm:w-auto">
          {department === 'sound' && (
            <Button variant="outline" size="sm" onClick={() => setShowCalculator(true)} className="flex-1 sm:flex-initial">
              <Calculator className="h-4 w-4 mr-2" />
              Create from Calculator
            </Button>
          )}
          <Button size="sm" onClick={() => setIsCreating(true)} className="flex-1 sm:flex-initial">
            Create New Preset
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <ScrollArea className="h-[420px]">
            <div className="space-y-3 py-2">
              {presets.map((p) => (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded p-3">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.items.length} items · {department}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {jobDates.length > 1 && (
                      <Button variant="outline" size="sm" onClick={() => assignPresetMutation.mutate(p.id)} className="text-xs">
                        Assign to all dates
                      </Button>
                    )}
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
                  No presets for this department.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Job Presets</DialogTitle>
          </DialogHeader>

          {isCreating || editingPreset || copyingPreset ? (
            <DepartmentProvider department={department}>
              <PresetEditor
                preset={editingPreset || copyingPreset}
                isCopy={!!copyingPreset}
                onSave={handleSavePreset}
                onCancel={() => { setIsCreating(false); setEditingPreset(null); setCopyingPreset(null); }}
                jobId={jobId}
                allowedCategories={department === 'sound' ? PA_PRESET_ALLOWED_CATEGORIES : undefined}
              />
            </DepartmentProvider>
          ) : (
            <Manager />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Amplifier Calculator - Create Preset</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-4">
            Configure speakers and calculate amplifiers. Results will be saved as a new preset for this job.
          </div>
          <DepartmentProvider department={department}>
            <AmplifierTool jobId={jobId} />
          </DepartmentProvider>
        </DialogContent>
      </Dialog>
    </>
  );
}