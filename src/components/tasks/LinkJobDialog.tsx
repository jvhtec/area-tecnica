import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useGlobalTaskMutations } from '@/hooks/useGlobalTaskMutations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

type Dept = 'sound' | 'lights' | 'video';

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
  const { linkToJob, linkToTour } = useGlobalTaskMutations(department);
  const [linkType, setLinkType] = React.useState<'job' | 'tour'>(currentTourId ? 'tour' : 'job');
  const [selectedId, setSelectedId] = React.useState<string>(currentJobId || currentTourId || '');
  const [loading, setLoading] = React.useState(false);

  const { data: jobs } = useQuery({
    queryKey: ['jobs-for-linking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title')
        .in('status', ['Tentativa', 'Confirmado'])
        .order('start_time', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tours } = useQuery({
    queryKey: ['tours-for-linking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tours')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      if (linkType === 'job') {
        await linkToJob(taskId, selectedId || null);
        await linkToTour(taskId, null);
      } else {
        await linkToTour(taskId, selectedId || null);
        await linkToJob(taskId, null);
      }
      toast({ title: 'Vinculación actualizada' });
      onOpenChange(false);
      onLinked?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'No se pudo vincular', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setLoading(true);
    try {
      await linkToJob(taskId, null);
      await linkToTour(taskId, null);
      toast({ title: 'Vinculación eliminada' });
      setSelectedId('');
      onOpenChange(false);
      onLinked?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'No se pudo desvincular', variant: 'destructive' });
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
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {linkType === 'job'
                  ? jobs?.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                    ))
                  : tours?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
              </SelectContent>
            </Select>
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
