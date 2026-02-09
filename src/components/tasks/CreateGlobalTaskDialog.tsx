import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, ComboboxGroup } from '@/components/ui/combobox';
import { useGlobalTaskMutations } from '@/hooks/useGlobalTaskMutations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { fromZonedTime } from 'date-fns-tz';

type Dept = 'sound' | 'lights' | 'video' | 'production' | 'administrative';
const ASSIGN_ALL_DEPARTMENT = '__all_department__';
const ASSIGN_ALL_DEPARTMENT_HOUSE_TECH = '__all_department_house_tech__';
const ASSIGN_SELECTED_DEPARTMENTS = '__selected_departments__';
const ASSIGN_SELECTED_USERS = '__selected_users__';
const TECHNICIAN_LEVEL_ROLES = new Set(['technician', 'house_tech']);
const DEPARTMENT_NAME: Record<Dept, string> = {
  sound: 'sonido',
  lights: 'luces',
  video: 'video',
  production: 'producción',
  administrative: 'administración',
};

const TASK_TYPES: Record<Dept, string[]> = {
  sound: ['QT', 'Rigging Plot', 'Prediccion', 'Pesos', 'Consumos', 'PS'],
  lights: ['QT', 'Rigging Plot', 'Pesos', 'Consumos', 'PS'],
  video: ['QT', 'Prediccion', 'Pesos', 'Consumos', 'PS'],
  production: ['QT', 'Rigging Plot', 'Prediccion', 'Pesos', 'Consumos', 'PS'],
  administrative: ['QT', 'Prediccion', 'Pesos', 'Consumos', 'PS'],
};

function normalizeDept(value: string | null | undefined): Dept | null {
  const lower = (value || '').toLowerCase();
  if (lower === 'sound' || lower === 'sonido') return 'sound';
  if (lower === 'lights' || lower === 'luces') return 'lights';
  if (lower === 'video' || lower === 'vídeo') return 'video';
  if (lower === 'production' || lower === 'produccion' || lower === 'producción') return 'production';
  if (lower === 'administrative' || lower === 'administracion' || lower === 'administración') return 'administrative';
  return null;
}

interface CreateGlobalTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Dept;
  userDepartment: string | null;
  onCreated?: () => void;
}

interface EligibleUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  department: string | null;
}

export const CreateGlobalTaskDialog: React.FC<CreateGlobalTaskDialogProps> = ({
  open,
  onOpenChange,
  department,
  userDepartment,
  onCreated,
}) => {
  const { toast } = useToast();
  const { createTask, createTasksForUsers } = useGlobalTaskMutations(department);
  const [loading, setLoading] = React.useState(false);
  const [taskType, setTaskType] = React.useState<string>('');
  const [customType, setCustomType] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [assignedTo, setAssignedTo] = React.useState<string>('');
  const [dueAt, setDueAt] = React.useState('');
  const [priority, setPriority] = React.useState<string>('');
  const [jobId, setJobId] = React.useState<string>('');
  const [tourId, setTourId] = React.useState<string>('');
  const [selectedDepartments, setSelectedDepartments] = React.useState<Dept[]>([department]);
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);

  // All eligible users, grouped by department-first vs others
  const { data: usersData } = useQuery<{ groups: ComboboxGroup[]; users: EligibleUser[] }>({
    queryKey: ['assignable-users-grouped', userDepartment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, department')
        .in('role', ['management', 'admin', 'logistics', 'house_tech', 'oscar'])
        .order('first_name');
      if (error) throw error;
      const all = data || [];
      const mine: ComboboxGroup = { heading: 'Tu departamento', items: [] };
      const others: ComboboxGroup = { heading: 'Otros departamentos', items: [] };
      for (const u of all) {
        const item = { value: u.id, label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.id };
        if (userDepartment && u.department === userDepartment) {
          mine.items.push(item);
        } else {
          others.items.push(item);
        }
      }
      const groups: ComboboxGroup[] = [];
      if (mine.items.length > 0) groups.push(mine);
      if (others.items.length > 0) groups.push(others);
      return { groups, users: all as EligibleUser[] };
    },
  });
  const userGroups = usersData?.groups || [];
  const eligibleUsers = usersData?.users || [];

  const { data: departmentUsers } = useQuery<Array<{ id: string; role: string | null }>>({
    queryKey: ['department-users-global-task', department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('department', department);
      if (error) throw error;
      return data || [];
    },
  });

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

  const types = TASK_TYPES[department] || TASK_TYPES.sound;
  const deptName = DEPARTMENT_NAME[department];
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
    setSelectedDepartments([department]);
    setSelectedUserIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedType) return;

    setLoading(true);
    try {
      const dueAtIso = dueAt
        ? fromZonedTime(dueAt + 'T00:00:00', 'Europe/Madrid').toISOString()
        : null;
      const payload = {
        task_type: resolvedType,
        description: description.trim() || null,
        due_at: dueAtIso,
        priority: priority ? parseInt(priority, 10) : null,
        job_id: jobId || null,
        tour_id: tourId || null,
      };

      if (assignedTo === ASSIGN_ALL_DEPARTMENT) {
        const assigneeIds = Array.from(
          new Set(
            (departmentUsers || [])
              .filter((u) => !TECHNICIAN_LEVEL_ROLES.has(String(u.role || '')))
              .map((u) => (typeof u.id === 'string' ? u.id.trim() : ''))
              .filter((id): id is string => id.length > 0)
          )
        );
        if (!assigneeIds.length) {
          toast({
            title: 'No se encontraron usuarios',
            description: 'No hay usuarios disponibles en este departamento (excluyendo technician y house_tech).',
            variant: 'destructive',
          });
          return;
        }

        const { created, skippedAssigneeIds } = await createTasksForUsers(payload, assigneeIds);
        const skippedText =
          skippedAssigneeIds.length > 0
            ? ` IDs omitidos por duplicado: ${skippedAssigneeIds.join(', ')}.`
            : '';
        toast({
          title: 'Asignación de departamento completada',
          description: `Creadas ${created.length} tarea(s), omitidas ${skippedAssigneeIds.length} por duplicado.${skippedText}`,
        });
      } else if (assignedTo === ASSIGN_ALL_DEPARTMENT_HOUSE_TECH) {
        const assigneeIds = Array.from(
          new Set(
            (departmentUsers || [])
              .filter((u) => u.role === 'house_tech')
              .map((u) => (typeof u.id === 'string' ? u.id.trim() : ''))
              .filter((id): id is string => id.length > 0)
          )
        );
        if (!assigneeIds.length) {
          toast({
            title: 'No se encontraron house techs',
            description: 'No hay house techs disponibles en este departamento.',
            variant: 'destructive',
          });
          return;
        }

        const { created, skippedAssigneeIds } = await createTasksForUsers(payload, assigneeIds);
        const skippedText =
          skippedAssigneeIds.length > 0
            ? ` IDs omitidos por duplicado: ${skippedAssigneeIds.join(', ')}.`
            : '';
        toast({
          title: 'Asignación de house techs completada',
          description: `Creadas ${created.length} tarea(s), omitidas ${skippedAssigneeIds.length} por duplicado.${skippedText}`,
        });
      } else if (assignedTo === ASSIGN_SELECTED_DEPARTMENTS) {
        const assigneeIds = Array.from(
          new Set(
            eligibleUsers
              .filter((u) => {
                const normalized = normalizeDept(u.department);
                return normalized ? selectedDepartments.includes(normalized) : false;
              })
              .filter((u) => !TECHNICIAN_LEVEL_ROLES.has(String(u.role || '')))
              .map((u) => (typeof u.id === 'string' ? u.id.trim() : ''))
              .filter((id): id is string => id.length > 0)
          )
        );
        if (!assigneeIds.length) {
          toast({
            title: 'Sin usuarios válidos',
            description: 'No hay usuarios válidos en los departamentos seleccionados (se excluyen technician y house_tech).',
            variant: 'destructive',
          });
          return;
        }

        const { created, skippedAssigneeIds } = await createTasksForUsers(payload, assigneeIds);
        toast({
          title: 'Asignación por departamentos completada',
          description: `Creadas ${created.length} tarea(s), omitidas ${skippedAssigneeIds.length} por duplicado.`,
        });
      } else if (assignedTo === ASSIGN_SELECTED_USERS) {
        const assigneeIds = Array.from(
          new Set(
            selectedUserIds
              .map((id) => (typeof id === 'string' ? id.trim() : ''))
              .filter((id): id is string => id.length > 0)
          )
        );
        if (!assigneeIds.length) {
          toast({
            title: 'Sin usuarios seleccionados',
            description: 'Selecciona al menos un usuario para asignación masiva.',
            variant: 'destructive',
          });
          return;
        }

        const { created, skippedAssigneeIds } = await createTasksForUsers(payload, assigneeIds);
        toast({
          title: 'Asignación por usuarios completada',
          description: `Creadas ${created.length} tarea(s), omitidas ${skippedAssigneeIds.length} por duplicado.`,
        });
      } else {
        await createTask({
          ...payload,
          assigned_to: assignedTo || null,
        });
        toast({ title: 'Tarea creada', description: 'La tarea se ha creado correctamente' });
      }

      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : String(err);
      toast({ title: 'Error', description: msg || 'No se pudo crear la tarea', variant: 'destructive' });
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
              <Combobox
                groups={[
                  {
                    heading: 'Opciones',
                    items: [
                      { value: ASSIGN_ALL_DEPARTMENT, label: `Oficina ${deptName}` },
                      { value: ASSIGN_ALL_DEPARTMENT_HOUSE_TECH, label: `Almacen ${deptName}` },
                      { value: ASSIGN_SELECTED_DEPARTMENTS, label: 'Departamentos seleccionados (masivo)' },
                      { value: ASSIGN_SELECTED_USERS, label: 'Usuarios seleccionados (masivo)' },
                    ],
                  },
                  ...userGroups,
                ]}
                value={assignedTo}
                onValueChange={setAssignedTo}
                placeholder="Sin asignar"
                searchPlaceholder="Buscar persona..."
                emptyMessage="Sin resultados."
              />
              {assignedTo === ASSIGN_SELECTED_DEPARTMENTS && (
                <div className="mt-2 rounded-md border p-2 space-y-2">
                  <p className="text-xs text-muted-foreground">Selecciona departamentos para asignación masiva</p>
                  <div className="grid grid-cols-1 gap-1 text-sm">
                    {(['sound', 'lights', 'video', 'production', 'administrative'] as Dept[]).map((dep) => (
                      <label key={dep} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedDepartments.includes(dep)}
                          onChange={(e) =>
                            setSelectedDepartments((prev) =>
                              e.target.checked ? Array.from(new Set([...prev, dep])) : prev.filter((d) => d !== dep)
                            )
                          }
                        />
                        <span>{DEPARTMENT_NAME[dep]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {assignedTo === ASSIGN_SELECTED_USERS && (
                <div className="mt-2 rounded-md border p-2 space-y-2 max-h-40 overflow-auto">
                  <p className="text-xs text-muted-foreground">Selecciona usuarios para asignación masiva</p>
                  {eligibleUsers.map((u) => {
                    const label = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.id;
                    return (
                      <label key={u.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={(e) =>
                            setSelectedUserIds((prev) =>
                              e.target.checked ? Array.from(new Set([...prev, u.id])) : prev.filter((id) => id !== u.id)
                            )
                          }
                        />
                        <span>{label}</span>
                        <span className="text-xs text-muted-foreground">({u.department || 'sin dept'})</span>
                      </label>
                    );
                  })}
                </div>
              )}
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
              <Combobox
                items={jobItems || []}
                value={jobId}
                onValueChange={(v) => { setJobId(v); if (v) setTourId(''); }}
                placeholder="Ninguno"
                searchPlaceholder="Buscar trabajo..."
                emptyMessage="Sin trabajos disponibles."
              />
            </div>
            <div className="space-y-2">
              <Label>Vincular a gira</Label>
              <Combobox
                items={tourItems || []}
                value={tourId}
                onValueChange={(v) => { setTourId(v); if (v) setJobId(''); }}
                placeholder="Ninguna"
                searchPlaceholder="Buscar gira..."
                emptyMessage="Sin giras disponibles."
              />
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
