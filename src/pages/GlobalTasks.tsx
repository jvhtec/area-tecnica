import React from 'react';
import { useGlobalTasks, GlobalTaskFilters, GlobalTask } from '@/hooks/useGlobalTasks';
import { useGlobalTaskMutations } from '@/hooks/useGlobalTaskMutations';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { canAssignTasks, canCreateTasks, canEditTasks } from '@/utils/tasks';
import { CreateGlobalTaskDialog } from '@/components/tasks/CreateGlobalTaskDialog';
import { LinkJobDialog } from '@/components/tasks/LinkJobDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, ComboboxGroup, ComboboxItem } from '@/components/ui/combobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus,
  Upload,
  Download,
  Trash2,
  Link2,
  Filter,
  CheckCircle2,
  Clock,
  CircleDashed,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { resolveTaskDocBucket } from '@/hooks/useGlobalTaskMutations';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { isPast, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  formatInJobTimezone,
  utcToLocalInput,
  localInputToUTC,
} from '@/utils/timezoneUtils';

type Dept = 'sound' | 'lights' | 'video' | 'production' | 'administrative';

interface DeptUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

const DEPARTMENT_LABELS: Record<string, string> = {
  sound: 'Sonido',
  lights: 'Luces',
  video: 'Vídeo',
  production: 'Producción',
  administrative: 'Administración',
};
const DEPARTMENT_OPTIONS: Dept[] = ['sound', 'lights', 'video', 'production', 'administrative'];

const PRIORITY_LABELS: Record<number, { label: string; class: string }> = {
  1: { label: 'Alta', class: 'bg-red-500/10 text-red-600 border-red-500/20' },
  2: { label: 'Media', class: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  3: { label: 'Baja', class: 'bg-green-500/10 text-green-600 border-green-500/20' },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  not_started: <CircleDashed className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Sin empezar',
  in_progress: 'En progreso',
  completed: 'Completada',
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}

function useAllEligibleUsers(userDepartment: string | null) {
  return useQuery<{ flat: DeptUser[]; groups: ComboboxGroup[]; items: ComboboxItem[] }>({
    queryKey: ['all-eligible-users', userDepartment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, department')
        .in('role', ['management', 'admin', 'logistics', 'house_tech', 'oscar'])
        .order('first_name');
      if (error) throw error;
      const all = (data || []) as (DeptUser & { department: string | null })[];
      const mine: ComboboxGroup = { heading: 'Tu departamento', items: [] };
      const others: ComboboxGroup = { heading: 'Otros departamentos', items: [] };
      const flat: DeptUser[] = [];
      const items: ComboboxItem[] = [];
      for (const u of all) {
        const label = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.id;
        flat.push(u);
        items.push({ value: u.id, label });
        if (userDepartment && u.department === userDepartment) {
          mine.items.push({ value: u.id, label });
        } else {
          others.items.push({ value: u.id, label });
        }
      }
      const groups: ComboboxGroup[] = [];
      if (mine.items.length > 0) groups.push(mine);
      if (others.items.length > 0) groups.push(others);
      return { flat, groups, items };
    },
  });
}

function normalizeDept(raw: string | null): Dept {
  const lower = raw?.toLowerCase() ?? '';
  if (lower === 'lights' || lower === 'luces') return 'lights';
  if (lower === 'video' || lower === 'vídeo') return 'video';
  if (lower === 'production' || lower === 'produccion' || lower === 'producción') return 'production';
  if (lower === 'administrative' || lower === 'administracion' || lower === 'administración') return 'administrative';
  return 'sound';
}

const MADRID_TZ = 'Europe/Madrid';

function formatDateMadrid(isoDate: string): string {
  return formatInJobTimezone(isoDate, 'dd/MM/yyyy', MADRID_TZ);
}

function formatDateTimeMadrid(isoDate: string): string {
  return formatInJobTimezone(isoDate, 'dd/MM/yyyy HH:mm', MADRID_TZ);
}

function dateInputValue(isoDate: string): string {
  // utcToLocalInput returns 'yyyy-MM-ddTHH:mm', we only need the date part
  return utcToLocalInput(isoDate, MADRID_TZ).slice(0, 10);
}

function isOverdueMadrid(isoDate: string): boolean {
  // Compare both dates in Madrid timezone to get correct overdue status
  const madridNow = toZonedTime(new Date(), MADRID_TZ);
  const madridDue = toZonedTime(parseISO(isoDate), MADRID_TZ);
  return madridDue < madridNow;
}

export default function GlobalTasks() {
  const { userRole, userId, userDepartment } = useOptimizedAuth();
  const defaultDept = React.useMemo(() => normalizeDept(userDepartment), [userDepartment]);
  const canChooseDepartment = userRole === 'oscar';
  const [selectedDept, setSelectedDept] = React.useState<Dept>(defaultDept);
  const dept = canChooseDepartment ? selectedDept : defaultDept;
  React.useEffect(() => {
    if (!canChooseDepartment) {
      setSelectedDept(defaultDept);
    }
  }, [canChooseDepartment, defaultDept]);

  const canEdit = canEditTasks(userRole);
  const canCreate = canCreateTasks(userRole);
  const canAssign = canAssignTasks(userRole);
  const { toast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = React.useState<string>('active');
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>('all');
  const [showFilters, setShowFilters] = React.useState(false);
  const [bulkDeleteType, setBulkDeleteType] = React.useState<string>('');
  const [bulkDeleteScope, setBulkDeleteScope] = React.useState<'all' | 'unassigned'>('all');
  const [editingDescriptionTaskId, setEditingDescriptionTaskId] = React.useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = React.useState('');
  const [isSavingDescription, setIsSavingDescription] = React.useState(false);

  // Dialogs
  const [showCreate, setShowCreate] = React.useState(false);
  const [linkTask, setLinkTask] = React.useState<GlobalTask | null>(null);

  const filters: GlobalTaskFilters = {};
  // Status filtering is handled entirely client-side so that the `tasks`
  // array always contains every task and the stats cards stay accurate.
  if (assigneeFilter && assigneeFilter !== 'all') {
    if (assigneeFilter === 'me') {
      filters.assignedTo = userId;
    } else if (assigneeFilter !== 'unassigned') {
      // assigneeFilter is an explicit user id
      filters.assignedTo = assigneeFilter;
    }
  }

  const { tasks, loading, refetch } = useGlobalTasks(dept, Object.keys(filters).length > 0 ? filters : undefined);
  const mutations = useGlobalTaskMutations(dept);
  const { data: usersData } = useAllEligibleUsers(userDepartment);
  const userGroups = usersData?.groups || [];
  const allUsers = usersData?.flat || [];
  const allUserItems = usersData?.items || [];

  // Client-side filter
  const filteredTasks = React.useMemo(() => {
    let result = tasks;
    if (statusFilter === 'active') {
      result = result.filter((t) => t.status !== 'completed');
    } else if (statusFilter && statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (assigneeFilter === 'unassigned') {
      result = result.filter((t) => !t.assigned_to);
    } else if (
      assigneeFilter &&
      assigneeFilter !== 'all' &&
      assigneeFilter !== 'me'
    ) {
      // assigneeFilter is an explicit user id
      result = result.filter((t) => t.assigned_to === assigneeFilter);
    }
    return result;
  }, [tasks, statusFilter, assigneeFilter]);

  const taskTypeOptions = React.useMemo(
    () => Array.from(new Set(tasks.map((t) => t.task_type).filter((t): t is string => Boolean(t)))).sort(),
    [tasks]
  );

  React.useEffect(() => {
    if (!taskTypeOptions.length) {
      setBulkDeleteType('');
      return;
    }
    if (!bulkDeleteType || !taskTypeOptions.includes(bulkDeleteType)) {
      setBulkDeleteType(taskTypeOptions[0]);
    }
  }, [taskTypeOptions, bulkDeleteType]);

  // Stats
  const stats = React.useMemo(() => ({
    total: tasks.length,
    notStarted: tasks.filter((t) => t.status === 'not_started').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  }), [tasks]);

  const onUpload = async (task: GlobalTask, file?: File) => {
    if (!file) return;
    try {
      await mutations.uploadAttachment(task.id, file, {
        jobId: task.job_id,
        tourId: task.tour_id,
      });
      toast({ title: 'Archivo subido' });
      await refetch();
    } catch (err: unknown) {
      toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
    }
  };

  const onDeleteAttachment = async (task: GlobalTask, docId: string, filePath: string) => {
    try {
      await mutations.deleteAttachment(docId, filePath, {
        taskId: task.id,
        jobId: task.job_id,
        tourId: task.tour_id,
      });
      toast({ title: 'Archivo eliminado' });
      await refetch();
    } catch (err: unknown) {
      toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
    }
  };

  const viewDoc = async (doc: { file_path: string }) => {
    try {
      const bucket = resolveTaskDocBucket(doc.file_path);
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(doc.file_path, 3600);
      if (error) {
        console.error('[GlobalTasks] createSignedUrl error:', error);
        toast({ title: 'Error', description: 'No se pudo abrir el archivo', variant: 'destructive' });
        return;
      }
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener');
      } else {
        toast({ title: 'Error', description: 'No se pudo generar la URL del archivo', variant: 'destructive' });
      }
    } catch (err: unknown) {
      console.error('[GlobalTasks] viewDoc error:', err);
      toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
    }
  };

  const bulkDeleteTasks = async () => {
    if (!bulkDeleteType) return;
    const candidates = filteredTasks.filter((task) => {
      if (task.task_type !== bulkDeleteType) return false;
      if (bulkDeleteScope === 'all') return true;
      return !task.assigned_to;
    });

    if (!candidates.length) {
      toast({
        title: 'Sin tareas para borrar',
        description:
          bulkDeleteScope === 'unassigned'
            ? `No hay tareas sin asignar de tipo ${bulkDeleteType} con los filtros actuales.`
            : `No hay tareas de tipo ${bulkDeleteType} con los filtros actuales.`,
      });
      return;
    }

    const scopeLabel = bulkDeleteScope === 'unassigned' ? 'sin asignar' : 'todas';
    const confirmed = window.confirm(
      `Vas a borrar ${candidates.length} tarea(s) ${scopeLabel} de tipo "${bulkDeleteType}". Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    const results = await Promise.allSettled(candidates.map((task) => mutations.deleteTask(task.id)));
    const deleted = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - deleted;

    if (failed === 0) {
      toast({ title: 'Borrado masivo completado', description: `Se borraron ${deleted} tarea(s).` });
    } else {
      toast({
        title: 'Borrado masivo parcial',
        description: `Se borraron ${deleted} tarea(s) y fallaron ${failed}.`,
        variant: 'destructive',
      });
    }
    await refetch();
  };

  const startDescriptionEdit = (task: GlobalTask) => {
    setEditingDescriptionTaskId(task.id);
    setDescriptionDraft(task.description ?? '');
  };

  const cancelDescriptionEdit = () => {
    setEditingDescriptionTaskId(null);
    setDescriptionDraft('');
  };

  const saveDescription = async (task: GlobalTask) => {
    if (!editingDescriptionTaskId || editingDescriptionTaskId !== task.id) return;
    setIsSavingDescription(true);
    try {
      const nextDescription = descriptionDraft.trim();
      await mutations.updateTask(task.id, { description: nextDescription || null });
      toast({ title: 'Descripción actualizada' });
      cancelDescriptionEdit();
      await refetch();
    } catch (err: unknown) {
      toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setIsSavingDescription(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tareas</h1>
          <p className="text-muted-foreground text-sm">
            {DEPARTMENT_LABELS[dept] || dept} — tareas de departamento y tareas globales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-1" />
            Filtros
          </Button>
          {canChooseDepartment && (
            <Select value={dept} onValueChange={(value) => setSelectedDept(value as Dept)}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {DEPARTMENT_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nueva tarea
            </Button>
          )}
        </div>
      </div>

      {canEdit && taskTypeOptions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="text-xs font-medium text-muted-foreground min-w-[110px]">Borrado masivo</div>
              <Select value={bulkDeleteType} onValueChange={setBulkDeleteType}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Tipo de tarea" />
                </SelectTrigger>
                <SelectContent>
                  {taskTypeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={bulkDeleteScope} onValueChange={(v) => setBulkDeleteScope(v as 'all' | 'unassigned')}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas por tipo (filtro actual)</SelectItem>
                  <SelectItem value="unassigned">Solo sin asignar (filtro actual)</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="destructive" onClick={bulkDeleteTasks} disabled={!bulkDeleteType}>
                <Trash2 className="h-4 w-4 mr-1" />
                Borrar en lote
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setStatusFilter('all')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setStatusFilter('not_started')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-muted-foreground">{stats.notStarted}</div>
            <div className="text-xs text-muted-foreground">Sin empezar</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setStatusFilter('in_progress')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
            <div className="text-xs text-muted-foreground">En progreso</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setStatusFilter('completed')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
            <div className="text-xs text-muted-foreground">Completadas</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activas</SelectItem>
                    <SelectItem value="not_started">Sin empezar</SelectItem>
                    <SelectItem value="in_progress">En progreso</SelectItem>
                    <SelectItem value="completed">Completadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Asignado a</label>
                <Combobox
                  groups={[
                    { heading: 'Filtros', items: [
                      { value: 'all', label: 'Todos' },
                      { value: 'me', label: 'Mis tareas' },
                      { value: 'unassigned', label: 'Sin asignar' },
                    ]},
                    ...userGroups,
                  ]}
                  value={assigneeFilter}
                  onValueChange={(v) => setAssigneeFilter(v || 'all')}
                  placeholder="Todos"
                  searchPlaceholder="Buscar persona..."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[24px]"></TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead>Asignado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Fecha límite</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Adjuntos</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => {
                const priorityInfo = task.priority ? PRIORITY_LABELS[task.priority] : null;
                const assignee = task.assigned_to_profile;
                const job = task.job;
                const tour = task.tour;
                const docs = task.task_documents || [];
                const canUpdate = canEdit || (!!userId && (task.assigned_to === userId || task.created_by === userId));
                const isOverdue =
                  task.due_at &&
                  task.status !== 'completed' &&
                  isOverdueMadrid(task.due_at);
                const isPendingTask = task.status !== 'completed';
                const isEditingDescription = editingDescriptionTaskId === task.id;
                const assigneeLabel = assignee
                  ? `${assignee.first_name || ''} ${assignee.last_name || ''}`.trim()
                  : 'Sin asignar';
                const creatorLabel = task.created_by_profile
                  ? `${task.created_by_profile.first_name || ''} ${task.created_by_profile.last_name || ''}`.trim()
                  : 'Desconocido';
                const linkedContext = job ? job.title : tour ? tour.name : 'Sin vínculo';

                return (
                  <TableRow key={task.id} className={cn(task.status === 'completed' && 'opacity-60')}>
                    <TableCell className="px-2">
                      {STATUS_ICONS[task.status || ''] || null}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <HoverCard openDelay={120}>
                            <HoverCardTrigger asChild>
                              <button
                                type="button"
                                className="text-left min-w-0"
                                aria-label={`Ver metadata de la tarea ${task.task_type}`}
                              >
                                <div className="font-medium text-sm">{task.task_type}</div>
                                {!isEditingDescription && (
                                  <div className="text-xs text-muted-foreground line-clamp-2">
                                    {task.description || 'Sin descripción'}
                                  </div>
                                )}
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-[360px] space-y-3">
                              <div>
                                <div className="text-sm font-semibold">{task.task_type}</div>
                                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                  {task.description || 'Sin descripción'}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                <span className="text-muted-foreground">Estado</span>
                                <span>{STATUS_LABELS[task.status || ''] || task.status || '-'}</span>
                                <span className="text-muted-foreground">Progreso</span>
                                <span>{task.progress || 0}%</span>
                                <span className="text-muted-foreground">Prioridad</span>
                                <span>{priorityInfo?.label || '-'}</span>
                                <span className="text-muted-foreground">Asignado</span>
                                <span>{assigneeLabel || 'Sin asignar'}</span>
                                <span className="text-muted-foreground">Creada por</span>
                                <span>{creatorLabel || 'Desconocido'}</span>
                                <span className="text-muted-foreground">Vínculo</span>
                                <span>{linkedContext}</span>
                                <span className="text-muted-foreground">Creada</span>
                                <span>{task.created_at ? formatDateTimeMadrid(task.created_at) : '-'}</span>
                                <span className="text-muted-foreground">Actualizada</span>
                                <span>{task.updated_at ? formatDateTimeMadrid(task.updated_at) : '-'}</span>
                                <span className="text-muted-foreground">Fecha límite</span>
                                <span>{task.due_at ? formatDateMadrid(task.due_at) : '-'}</span>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                          {canUpdate && isPendingTask && !isEditingDescription && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => startDescriptionEdit(task)}
                              aria-label={`Editar descripción de ${task.task_type}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        {isEditingDescription ? (
                          <div className="space-y-2 pt-1">
                            <Textarea
                              rows={3}
                              value={descriptionDraft}
                              onChange={(e) => setDescriptionDraft(e.target.value)}
                              placeholder="Añade una descripción"
                              className="text-xs"
                            />
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => saveDescription(task)}
                                disabled={isSavingDescription}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Guardar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={cancelDescriptionEdit}
                                disabled={isSavingDescription}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          isPendingTask && (
                            <div className="text-[11px] text-muted-foreground">
                              Pendiente: pasa el cursor para ver metadata completa.
                            </div>
                          )
                        )}
                        {priorityInfo && (
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 mt-1', priorityInfo.class)}>
                            {priorityInfo.label}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {canAssign ? (
                        <Combobox
                          groups={userGroups}
                          value={task.assigned_to || ''}
                          onValueChange={(v) =>
                            mutations
                              .assignUser(task.id, v || null)
                              .then(() => refetch())
                              .catch((err: unknown) =>
                                toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' })
                              )
                          }
                          placeholder="Sin asignar"
                          searchPlaceholder="Buscar..."
                          triggerClassName="w-[160px] h-8 text-xs"
                        />
                      ) : (
                        <span className="text-sm">
                          {assignee ? `${assignee.first_name} ${assignee.last_name}` : '-'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={task.status || 'not_started'}
                        onValueChange={(v) =>
                          mutations
                            .setStatus(task.id, v as 'not_started' | 'in_progress' | 'completed')
                            .then(() => refetch())
                            .catch((err: unknown) =>
                              toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' })
                            )
                        }
                      >
                        <SelectTrigger className="w-[130px] h-8 text-xs" disabled={!canUpdate}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Sin empezar</SelectItem>
                          <SelectItem value="in_progress">En progreso</SelectItem>
                          <SelectItem value="completed">Completada</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="w-[120px]">
                      <div className="flex items-center gap-2">
                        <Progress value={task.progress || 0} className="h-2" />
                        <span className="text-xs w-8">{task.progress || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Input
                          type="date"
                          value={task.due_at ? dateInputValue(task.due_at) : ''}
                          onChange={(e) =>
                            mutations
                              .setDueDate(
                                task.id,
                                e.target.value
                                  ? localInputToUTC(e.target.value + 'T00:00', MADRID_TZ).toISOString()
                                  : null
                              )
                              .then(() => refetch())
                              .catch((err: unknown) =>
                                toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' })
                              )
                          }
                          className={cn('w-[140px] h-8 text-xs', isOverdue && 'border-red-500 text-red-500')}
                        />
                      ) : (
                        <span className={cn('text-sm', isOverdue && 'text-red-500 font-medium')}>
                          {task.due_at ? formatDateMadrid(task.due_at) : '-'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setLinkTask(task)}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        {job ? job.title : tour ? tour.name : 'Vincular'}
                      </Button>
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <div className="max-h-20 overflow-auto space-y-1">
                        {docs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between text-xs p-1 rounded hover:bg-accent/40"
                          >
                            <span className="truncate max-w-[100px]" title={doc.file_name}>
                              {doc.file_name}
                            </span>
                            <div className="flex gap-0.5">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => viewDoc(doc)}>
                                <Download className="h-3 w-3" />
                              </Button>
                              {canEdit && (
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onDeleteAttachment(task, doc.id, doc.file_path)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <div className="relative inline-block">
                          <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = ''; // Clear so same file can be re-selected
                              onUpload(task, file);
                            }}
                          />
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <Upload className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (window.confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.')) {
                                mutations
                                  .deleteTask(task.id)
                                  .then(() => {
                                    toast({ title: 'Tarea eliminada' });
                                    refetch();
                                  })
                                  .catch((err: unknown) =>
                                    toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' })
                                  );
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && filteredTasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {tasks.length === 0
                      ? 'No hay tareas todavía. Crea la primera.'
                      : 'No hay tareas que coincidan con los filtros seleccionados.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Dialogs */}
      <CreateGlobalTaskDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        department={dept}
        userDepartment={userDepartment}
        onCreated={() => refetch()}
      />
      {linkTask && (
        <LinkJobDialog
          open={!!linkTask}
          onOpenChange={(open) => !open && setLinkTask(null)}
          taskId={linkTask.id}
          department={dept}
          currentJobId={linkTask.job_id}
          currentTourId={linkTask.tour_id}
          onLinked={() => { setLinkTask(null); refetch(); }}
        />
      )}
    </div>
  );
}
