import React from 'react';
import { useGlobalTasks, GlobalTaskFilters } from '@/hooks/useGlobalTasks';
import { useGlobalTaskMutations } from '@/hooks/useGlobalTaskMutations';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { canEditTasks, canAssignTasks } from '@/utils/tasks';
import { CreateGlobalTaskDialog } from '@/components/tasks/CreateGlobalTaskDialog';
import { LinkJobDialog } from '@/components/tasks/LinkJobDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const DEPARTMENT_LABELS: Record<string, string> = {
  sound: 'Sonido',
  lights: 'Luces',
  video: 'Vídeo',
  production: 'Producción',
  logistics: 'Logística',
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

function useManagementUsers() {
  return useQuery({
    queryKey: ['management-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('role', ['management', 'admin', 'logistics']);
      if (error) throw error;
      return data || [];
    },
  });
}

export default function GlobalTasks() {
  const { userRole, userId } = useOptimizedAuth();
  const canEdit = canEditTasks(userRole);
  const canAssign = canAssignTasks(userRole);
  const { toast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = React.useState<string>('active');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>('all');
  const [showFilters, setShowFilters] = React.useState(false);

  // Dialogs
  const [showCreate, setShowCreate] = React.useState(false);
  const [linkTask, setLinkTask] = React.useState<any>(null);

  const filters: GlobalTaskFilters = {};
  if (statusFilter === 'active') {
    // We'll filter client-side for "active" (not_started + in_progress)
  } else if (statusFilter && statusFilter !== 'all') {
    filters.status = statusFilter as any;
  }
  if (departmentFilter && departmentFilter !== 'all') {
    filters.department = departmentFilter;
  }
  if (assigneeFilter && assigneeFilter !== 'all') {
    if (assigneeFilter === 'me') {
      filters.assignedTo = userId;
    } else if (assigneeFilter === 'unassigned') {
      // We'll filter client-side
    } else {
      filters.assignedTo = assigneeFilter;
    }
  }

  const { tasks, loading, refetch } = useGlobalTasks(
    Object.keys(filters).length > 0 ? filters : undefined,
  );
  const mutations = useGlobalTaskMutations();
  const { data: managementUsers } = useManagementUsers();

  // Client-side filter for "active" and "unassigned"
  const filteredTasks = React.useMemo(() => {
    let result = tasks;
    if (statusFilter === 'active') {
      result = result.filter((t: any) => t.status !== 'completed');
    }
    if (assigneeFilter === 'unassigned') {
      result = result.filter((t: any) => !t.assigned_to);
    }
    return result;
  }, [tasks, statusFilter, assigneeFilter]);

  // Stats
  const stats = React.useMemo(() => {
    const all = tasks;
    return {
      total: all.length,
      notStarted: all.filter((t: any) => t.status === 'not_started').length,
      inProgress: all.filter((t: any) => t.status === 'in_progress').length,
      completed: all.filter((t: any) => t.status === 'completed').length,
    };
  }, [tasks]);

  const onUpload = async (taskId: string, file?: File) => {
    if (!file) return;
    try {
      await mutations.uploadAttachment(taskId, file);
      toast({ title: 'Archivo subido' });
      await refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const onDeleteAttachment = async (docId: string, filePath: string) => {
    try {
      await mutations.deleteAttachment(docId, filePath);
      toast({ title: 'Archivo eliminado' });
      await refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const viewDoc = async (doc: { file_path: string }) => {
    const { data } = await supabase.storage.from('task_documents').createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener');
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tareas</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona tareas globales y vincúlalas a trabajos o giras
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
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

      {/* Stats Cards */}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <label className="text-xs font-medium text-muted-foreground">Departamento</label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sound">Sonido</SelectItem>
                    <SelectItem value="lights">Luces</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="production">Producción</SelectItem>
                    <SelectItem value="logistics">Logística</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Asignado a</label>
                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="me">Mis tareas</SelectItem>
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                    {managementUsers?.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              {filteredTasks.map((task: any) => {
                const priorityInfo = task.priority ? PRIORITY_LABELS[task.priority] : null;
                const assignee = task.assigned_to_profile;
                const job = task.job;
                const tour = task.tour;
                const docs = task.task_documents || [];
                const canUpdate = canEdit || (!!userId && task.assigned_to === userId);
                const isOverdue =
                  task.due_at &&
                  task.status !== 'completed' &&
                  new Date(task.due_at) < new Date();

                return (
                  <TableRow key={task.id} className={cn(task.status === 'completed' && 'opacity-60')}>
                    <TableCell className="px-2">
                      {STATUS_ICONS[task.status] || null}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{task.title}</div>
                        {task.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{task.description}</div>
                        )}
                        <div className="flex gap-1 mt-1">
                          {task.department && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {DEPARTMENT_LABELS[task.department] || task.department}
                            </Badge>
                          )}
                          {priorityInfo && (
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', priorityInfo.class)}>
                              {priorityInfo.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canAssign ? (
                        <Select
                          value={task.assigned_to || 'unassigned'}
                          onValueChange={(v) =>
                            mutations.assignUser(task.id, v === 'unassigned' ? null : v).then(() => refetch())
                          }
                        >
                          <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue placeholder="Asignar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Sin asignar</SelectItem>
                            {managementUsers?.map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.first_name} {u.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">
                          {assignee ? `${assignee.first_name} ${assignee.last_name}` : '-'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={task.status}
                        onValueChange={(v) =>
                          mutations.setStatus(task.id, v as any).then(() => refetch())
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
                          value={task.due_at ? new Date(task.due_at).toISOString().slice(0, 10) : ''}
                          onChange={(e) =>
                            mutations
                              .setDueDate(task.id, e.target.value ? new Date(e.target.value).toISOString() : null)
                              .then(() => refetch())
                          }
                          className={cn('w-[140px] h-8 text-xs', isOverdue && 'border-red-500 text-red-500')}
                        />
                      ) : (
                        <span className={cn('text-sm', isOverdue && 'text-red-500 font-medium')}>
                          {task.due_at ? new Date(task.due_at).toLocaleDateString('es-ES') : '-'}
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
                        {docs.map((doc: any) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between text-xs p-1 rounded hover:bg-accent/40"
                          >
                            <span className="truncate max-w-[100px]" title={doc.file_name}>
                              {doc.file_name}
                            </span>
                            <div className="flex gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => viewDoc(doc)}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => onDeleteAttachment(doc.id, doc.file_path)}
                                >
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
                            onChange={(e) => onUpload(task.id, e.target.files?.[0])}
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
                            onClick={() =>
                              mutations.deleteTask(task.id).then(() => refetch())
                            }
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
        onCreated={() => refetch()}
      />
      {linkTask && (
        <LinkJobDialog
          open={!!linkTask}
          onOpenChange={(open) => !open && setLinkTask(null)}
          taskId={linkTask.id}
          currentJobId={linkTask.job_id}
          currentTourId={linkTask.tour_id}
          onLinked={() => { setLinkTask(null); refetch(); }}
        />
      )}
    </div>
  );
}
