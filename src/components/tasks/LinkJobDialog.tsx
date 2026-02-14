import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { useGlobalTaskMutations } from '@/hooks/useGlobalTaskMutations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

type Dept = 'sound' | 'lights' | 'video' | 'production' | 'administrative';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}

interface LinkJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  department: Dept;
  currentJobId?: string | null;
  currentTourId?: string | null;
  onLinked?: () => void;
}

export const LinkJobDialog: React.FC<LinkJobDialogProps> = ({
  open,
  onOpenChange,
  taskId,
  department,
  currentJobId,
  currentTourId,
  onLinked,
}) => {
  const { toast } = useToast();
  const { linkTask } = useGlobalTaskMutations(department);
  const [linkType, setLinkType] = React.useState<'job' | 'tour'>(currentTourId ? 'tour' : 'job');
  const [selectedId, setSelectedId] = React.useState<string>(currentJobId || currentTourId || '');
  const [loading, setLoading] = React.useState(false);

  // Reset dialog state when it opens or when the current task links change
  React.useEffect(() => {
    if (open) {
      setLinkType(currentTourId ? 'tour' : 'job');
      setSelectedId(currentJobId || currentTourId || '');
    }
  }, [open, currentJobId, currentTourId]);

  const { data: jobItems } = useQuery({
    queryKey: ['jobs-for-linking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title')
        .in('status', ['Tentativa', 'Confirmado'])
        .order('start_time', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map((j) => ({ value: j.id, label: j.title || j.id }));
    },
  });

  const { data: tourItems } = useQuery({
    queryKey: ['tours-for-linking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tours')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map((t) => ({ value: t.id, label: t.name || t.id }));
    },
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      if (linkType === 'job') {
        await linkTask(taskId, selectedId || null, null);
      } else {
        await linkTask(taskId, null, selectedId || null);
      }
      toast({ title: 'Vinculación actualizada' });
      onOpenChange(false);
      onLinked?.();
    } catch (err: unknown) {
      toast({ title: 'Error', description: getErrorMessage(err) || 'No se pudo vincular', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setLoading(true);
    try {
      await linkTask(taskId, null, null);
      toast({ title: 'Vinculación eliminada' });
      setSelectedId('');
      onOpenChange(false);
      onLinked?.();
    } catch (err: unknown) {
      toast({ title: 'Error', description: getErrorMessage(err) || 'No se pudo desvincular', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular tarea</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={linkType} onValueChange={(v) => { setLinkType(v as 'job' | 'tour'); setSelectedId(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="job">Trabajo</SelectItem>
                <SelectItem value="tour">Gira</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{linkType === 'job' ? 'Trabajo' : 'Gira'}</Label>
            <Combobox
              items={linkType === 'job' ? (jobItems || []) : (tourItems || [])}
              value={selectedId}
              onValueChange={setSelectedId}
              placeholder="Seleccionar..."
              searchPlaceholder={linkType === 'job' ? 'Buscar trabajo...' : 'Buscar gira...'}
              emptyMessage="Sin resultados."
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {(currentJobId || currentTourId) && (
            <Button type="button" variant="destructive" onClick={handleUnlink} disabled={loading}>
              Desvincular
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={loading || !selectedId}>
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
