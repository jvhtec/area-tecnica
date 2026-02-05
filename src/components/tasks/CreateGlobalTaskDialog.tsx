import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGlobalTaskMutations } from '@/hooks/useGlobalTaskMutations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

type Dept = 'sound' | 'lights' | 'video';

const TASK_TYPES: Record<Dept, string[]> = {
  sound: ['QT', 'Rigging Plot', 'Prediccion', 'Pesos', 'Consumos', 'PS'],
  lights: ['QT', 'Rigging Plot', 'Pesos', 'Consumos', 'PS'],
  video: ['QT', 'Prediccion', 'Pesos', 'Consumos', 'PS'],
};

interface CreateGlobalTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Dept;
  userDepartment: string | null;
  onCreated?: () => void;
}

export const CreateGlobalTaskDialog: React.FC<CreateGlobalTaskDialogProps> = ({
  open,
  onOpenChange,
  department,
  userDepartment,
  onCreated,
}) => {
  const { toast } = useToast();
  const { createTask } = useGlobalTaskMutations(department);
  const [loading, setLoading] = React.useState(false);
  const [taskType, setTaskType] = React.useState<string>('');
  const [customType, setCustomType] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [assignedTo, setAssignedTo] = React.useState<string>('');
  const [dueAt, setDueAt] = React.useState('');
  const [priority, setPriority] = React.useState<string>('');
  const [jobId, setJobId] = React.useState<string>('');
  const [tourId, setTourId] = React.useState<string>('');

  // Assignable users: restricted to the assigner's department
  const { data: users } = useQuery({
    queryKey: ['assignable-users-dept', userDepartment],
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('id, first_name, last_name, role, department')
        .in('role', ['management', 'admin', 'logistics', 'house_tech'])
        .order('first_name');

      if (userDepartment) {
        q = q.eq('department', userDepartment);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

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

  const types = TASK_TYPES[department] || TASK_TYPES.sound;
  const isCustom = taskType === '__custom__';
  const resolvedType = isCustom ? customType.trim() : taskType;

  const resetForm = () => {
    setTaskType('');
    setCustomType('');
    setDescription('');
    setAssignedTo('');
    setDueAt('');
    setPriority('');
    setJobId('');
    setTourId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedType) return;

    setLoading(true);
    try {
      const clean = (v: string) => (v && v !== 'none' ? v : null);
      await createTask({
        task_type: resolvedType,
        description: description.trim() || null,
        assigned_to: clean(assignedTo),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        priority: priority ? parseInt(priority, 10) : null,
        job_id: clean(jobId),
        tour_id: clean(tourId),
      });
      toast({ title: 'Tarea creada', description: 'La tarea se ha creado correctamente' });
      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'No se pudo crear la tarea', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de tarea *</Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
                <SelectItem value="__custom__">Otro (personalizado)</SelectItem>
              </SelectContent>
            </Select>
            {isCustom && (
              <Input
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Nombre de la tarea"
                autoFocus
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="gt-desc">Descripción</Label>
            <Textarea
              id="gt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles adicionales (opcional)"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Asignar a</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.first_name} {u.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue placeholder="Normal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Alta</SelectItem>
                  <SelectItem value="2">Media</SelectItem>
                  <SelectItem value="3">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gt-due">Fecha límite</Label>
            <Input
              id="gt-due"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vincular a trabajo</Label>
              <Select value={jobId} onValueChange={(v) => { setJobId(v); if (v && v !== 'none') setTourId('none'); }}>
                <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {jobs?.map((j) => (
                    <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vincular a gira</Label>
              <Select value={tourId} onValueChange={(v) => { setTourId(v); if (v && v !== 'none') setJobId('none'); }}>
                <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
                  {tours?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !resolvedType}>
              {loading ? 'Creando...' : 'Crear tarea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
