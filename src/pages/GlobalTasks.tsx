import React from 'react';
import { useGlobalTasks, GlobalTaskFilters, GlobalTask } from '@/hooks/useGlobalTasks';
import { useGlobalTaskMutations } from '@/hooks/useGlobalTaskMutations';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { canEditTasks, canAssignTasks } from '@/utils/tasks';
import { CreateGlobalTaskDialog } from '@/components/tasks/CreateGlobalTaskDialog';
import { LinkJobDialog } from '@/components/tasks/LinkJobDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, ComboboxGroup, ComboboxItem } from '@/components/ui/combobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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

type Dept = 'sound' | 'lights' | 'video';

interface DeptUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

const DEPARTMENT_LABELS: Record<string, string> = {
  sound: 'Sonido',
  lights: 'Luces',
  video: 'Vídeo',
};

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
        .in('role', ['management', 'admin', 'logistics', 'house_tech'])
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
  return 'sound';
}

const MADRID_TZ = 'Europe/Madrid';

function formatDateMadrid(isoDate: string): string {
  return formatInJobTimezone(isoDate, 'dd/MM/yyyy', MADRID_TZ);
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
  const dept = normalizeDept(userDepartment);
  const canEdit = canEditTasks(userRole);
  const canAssign = canAssignTasks(userRole);
  const { toast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = React.useState<string>('active');
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>('all');
  const [showFilters, setShowFilters] = React.useState(false);

  // Dialogs
  const [showCreate, setShowCreate] = React.useState(false);
  const [linkTask, setLinkTask] = React.useState<GlobalTask | null>(null);

  const filters: GlobalTaskFilters = {};
  if (statusFilter && statusFilter !== 'all' && statusFilter !== 'active') {
    filters.status = statusFilter as GlobalTaskFilters['status'];
  }
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
    const bucket = resolveTaskDocBucket(doc.file_path);
    const { data } = await supabase.storage.from(bucket).createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
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
          {canEdit && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nueva tarea
            </Button>
          )}
        </div>
      </div>

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

                return (
                  <TableRow key={task.id} className={cn(task.status === 'completed' && 'opacity-60')}>
                    <TableCell className="px-2">
                      {STATUS_ICONS[task.status || ''] || null}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{task.task_type}</div>
                        {task.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{task.description}</div>
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
                            onChange={(e) => onUpload(task, e.target.files?.[0])}
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
