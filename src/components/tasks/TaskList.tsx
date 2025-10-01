import React from 'react';
import { useJobTasks } from '@/hooks/useJobTasks';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import { Department } from '@/types/department';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Upload, Download, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const TASK_TYPES: Record<'sound'|'lights'|'video', string[]> = {
  sound: ["QT","Rigging Plot","Prediccion","Pesos","Consumos","PS"],
  lights: ["QT","Rigging Plot","Pesos","Consumos","PS"],
  video: ["QT","Prediccion","Pesos","Consumos","PS"],
};

type Dept = 'sound'|'lights'|'video';

interface TaskListProps {
  jobId: string;
  department: Dept;
  canEdit: boolean;
  canAssign: boolean;
  canUpdateOwn: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({ jobId, department, canEdit, canAssign }) => {
  const { tasks, loading, refetch } = useJobTasks(jobId, department);
  const { createTask, assignUser, setStatus, setDueDate, deleteTask, uploadAttachment, deleteAttachment } = useTaskMutations(jobId, department);
  const [newType, setNewType] = React.useState<string | undefined>(TASK_TYPES[department][0]);
  const [newAssignee, setNewAssignee] = React.useState<string | undefined>(undefined);
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id || null);
    })();
  }, []);

  const { data: managementUsers } = useManagementUsers();

  const addTask = async () => {
    if (!newType) return;
    try {
      await createTask(newType, newAssignee || null, null);
      setNewAssignee(undefined);
      await refetch();
    } catch (e: any) {
      toast({ title: 'Create failed', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const onUpload = async (taskId: string, file?: File) => {
    if (!file) return;
    try {
      await uploadAttachment(taskId, file);
      toast({ title: 'Uploaded', description: 'Attachment uploaded' });
      await refetch();
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const onDeleteAttachment = async (docId: string, filePath: string) => {
    try {
      await deleteAttachment(docId, filePath);
      toast({ title: 'Attachment deleted' });
      await refetch();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={newType} onValueChange={setNewType}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Task type" /></SelectTrigger>
          <SelectContent>
            {TASK_TYPES[department].map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canAssign && (
          <Select value={newAssignee} onValueChange={setNewAssignee}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Assign to" /></SelectTrigger>
            <SelectContent>
              {managementUsers?.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button size="sm" variant="outline" onClick={addTask} disabled={!canEdit && !canAssign}>
          <Plus className="h-4 w-4 mr-1" /> Add Task
        </Button>
      </div>

      <div className="border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Attachments</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tasks || []).map((task: any) => (
              <TableRow key={task.id}>
                <TableCell className="font-medium">{task.task_type}</TableCell>
                <TableCell>
                  {canAssign ? (
                    <Select value={task.assigned_to?.id || task.assigned_to || ''} onValueChange={(v) => assignUser(task.id, v || null).then(() => refetch())}>
                      <SelectTrigger className="w-[180px]"><SelectValue placeholder="Assign" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {managementUsers?.map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span>{task.assigned_to ? `${task.assigned_to.first_name} ${task.assigned_to.last_name}` : '-'}</span>
                  )}
                </TableCell>
                <TableCell>
                  {(() => {
                    const canUpdate = canEdit || (!!currentUserId && (task.assigned_to?.id === currentUserId || task.assigned_to === currentUserId));
                    return (
                      <Select value={task.status} onValueChange={(v) => setStatus(task.id, v as any).then(() => refetch())}>
                        <SelectTrigger className="w-[140px]" disabled={!canUpdate}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Not Started</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                  })()}
                </TableCell>
                <TableCell className="w-[160px]">
                  <div className="flex items-center gap-2">
                    <Progress value={task.progress || 0} className="h-2" />
                    <span className="text-xs w-8">{task.progress || 0}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  {(() => {
                    const canUpdate = canEdit;
                    return (
                      <Input
                        type="date"
                        value={task.due_at ? new Date(task.due_at).toISOString().slice(0,10) : ''}
                        onChange={(e) => setDueDate(task.id, e.target.value ? new Date(e.target.value).toISOString() : null).then(() => refetch())}
                        className="w-[160px]"
                        disabled={!canUpdate}
                      />
                    );
                  })()}
                </TableCell>
                <TableCell className="min-w-[220px]">
                  <div className="max-h-24 overflow-auto space-y-1">
                    {(task.task_documents || []).map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between text-xs p-1 rounded hover:bg-accent/40">
                        <span className="truncate max-w-[140px]" title={doc.file_name}>{doc.file_name}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => viewDoc(doc)}><Download className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDeleteAttachment(doc.id, doc.file_path)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="space-x-2">
                  <div className="relative inline-block">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => onUpload(task.id, e.target.files?.[0])} />
                    <Button size="sm" variant="outline"><Upload className="h-3 w-3 mr-1"/>Upload</Button>
                  </div>
                  {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => deleteTask(task.id).then(() => refetch())}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && (!tasks || tasks.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">No tasks yet</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

function useManagementUsers() {
  return useQuery({
    queryKey: ['management-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('role', ['management','admin','logistics']);
      if (error) throw error;
      return data || [];
    }
  });
}

async function viewDoc(doc: { file_path: string; file_name: string }) {
  const { data } = await supabase.storage.from('task_documents').createSignedUrl(doc.file_path, 3600);
  if (data?.signedUrl) {
    window.open(data.signedUrl, '_blank', 'noopener');
  }
}

export default TaskList;
