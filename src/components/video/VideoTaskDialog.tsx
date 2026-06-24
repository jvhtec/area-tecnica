import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import createFolderIcon from "@/assets/icons/icon.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, Trash2, Table } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { TASK_TYPES } from "@/constants/taskTypes";
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


import { queryKeys } from "@/lib/react-query";
import type { Database } from "@/integrations/supabase/types";
import {
  DOCUMENT_UPLOAD_ACCEPT,
  getDocumentUploadValidationError,
} from "@/utils/documentUploadValidation";
interface VideoTaskDialogProps {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TaskStatus = Database["public"]["Enums"]["task_status"];
type TaskDocumentInsert = Database["public"]["Tables"]["task_documents"]["Insert"];

type TaskDocumentRow = {
  id: string;
  file_name: string;
  file_path: string;
};

type AssignedUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type TaskRow = Database["public"]["Tables"]["video_job_tasks"]["Row"] & {
  assigned_to: AssignedUser | null;
  task_documents: TaskDocumentRow[] | null;
};

export const VideoTaskDialog = ({ jobId, open, onOpenChange }: VideoTaskDialogProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: managementUsers } = useQuery({
    queryKey: queryKeys.scope('management-users'),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('profiles')
        .select('id, first_name, last_name')
        .in('role', ['management', 'admin']);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: tasks, refetch: refetchTasks } = useQuery({
    queryKey: queryKeys.scope('video-tasks', jobId),
    queryFn: async () => {
      if (!jobId) return null;
      
      const { data, error } = await dataLayerClient.from('video_job_tasks')
        .select(`
          *,
          assigned_to:profiles!video_job_tasks_assigned_to_fkey (
            id,
            first_name,
            last_name
          ),
          task_documents (*)
        `)
        .eq('job_id', jobId);
      
      if (error) throw error;
      return data as unknown as TaskRow[];
    },
    enabled: !!jobId
  });

  const { data: personnel } = useQuery({
    queryKey: queryKeys.scope('video-personnel', jobId),
    queryFn: async () => {
      if (!jobId) return null;

      const { data: existingData, error: fetchError } = await dataLayerClient.from('video_job_personnel')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();
      
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (!existingData) {
        const { data: newData, error: insertError } = await dataLayerClient.from('video_job_personnel')
          .insert({
            job_id: jobId,
            video_directors: 0,
            camera_ops: 0,
            playback_techs: 0,
            video_techs: 0
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newData;
      }

      return existingData;
    },
    enabled: !!jobId
  });

  const handleFileUpload = async (taskId: string, files: File[]) => {
    if (files.length === 0) return;

    const validationError = getDocumentUploadValidationError(files);
    if (validationError) {
      toast({
        title: "Archivo no permitido",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    const uploadedPaths: string[] = [];
    const insertedIds: string[] = [];
    try {
      setUploading(true);
      for (const file of files) {
        const filePath = `${taskId}/${crypto.randomUUID()}-${file.name}`;
        
        const { error: uploadError } = await dataLayerClient.storage
          .from('task_documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        uploadedPaths.push(filePath);

        const taskDocument: TaskDocumentInsert = {
            video_task_id: taskId,
            file_name: file.name,
            file_path: filePath,
          };

        const { data: insertedDocument, error: dbError } = await dataLayerClient.from('task_documents')
          .insert(taskDocument)
          .select('id')
          .single();

        if (dbError) throw dbError;
        if (insertedDocument?.id) {
          insertedIds.push(insertedDocument.id);
        }
      }

      const { error: taskUpdateError } = await dataLayerClient.from('video_job_tasks')
        .update({ 
          status: 'completed',
          progress: 100 
        })
        .eq('id', taskId);
      if (taskUpdateError) throw taskUpdateError;

      toast({
        title: files.length === 1 ? "Archivo subido correctamente" : "Archivos subidos correctamente",
        description:
          files.length === 1
            ? "El documento se ha subido y la tarea se ha marcado como completada."
            : `${files.length} documentos se han subido y la tarea se ha marcado como completada.`,
      });

      refetchTasks();
    } catch (error: any) {
      try {
        if (insertedIds.length > 0) {
          await dataLayerClient.from('task_documents').delete().in('id', insertedIds);
        }
        if (uploadedPaths.length > 0) {
          await dataLayerClient.storage.from('task_documents').remove(uploadedPaths);
        }
      } catch (cleanupError) {
        console.error("Error rolling back video task document upload batch:", cleanupError);
      }
      toast({
        title: "Error al subir",
        description: error.message || "No se pudo completar la subida. Se ha revertido la tanda.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await dataLayerClient.storage
        .from('task_documents')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteFile = async (taskId: string, documentId: string, filePath: string) => {
    try {
      const { error: storageError } = await dataLayerClient.storage
        .from('task_documents')
        .remove([filePath]);
  
      if (storageError) {
        throw new Error(`Failed to delete file from storage: ${storageError.message}`);
      }
  
      const { error: dbError } = await dataLayerClient.from('task_documents')
        .delete()
        .eq('id', documentId);
  
      if (dbError) {
        throw new Error(`Failed to delete file record: ${dbError.message}`);
      }
  
      const { error: taskError } = await dataLayerClient.from('video_job_tasks')
        .update({ 
          status: 'in_progress',
          progress: 50 
        })
        .eq('id', taskId);
  
      if (taskError) {
        throw new Error(`Failed to update task status: ${taskError.message}`);
      }
  
      toast({
        title: "File deleted",
        description: "The document has been removed from the task.",
      });
  
      refetchTasks();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    try {
      const progress = status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0;
      
      const { error } = await dataLayerClient.from('video_job_tasks')
        .update({ 
          status,
          progress,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;
      refetchTasks();
      
      toast({
        title: "Task updated",
        description: "Task status has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateTotalProgress = () => {
    if (!tasks?.length) return 0;
    const totalProgress = tasks.reduce((acc, task) => acc + (task.progress || 0), 0);
    return Math.round(totalProgress / tasks.length);
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'in_progress':
        return 'bg-blue-500';
      default:
        return 'bg-gray-300';
    }
  };

  if (!jobId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-4 w-[95vw] max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table className="h-5 w-5" />
            <span>Video Department Tasks</span>
            <img
              src={createFolderIcon}
              alt="Create Flex Folders"
              width={24}
              height={24}
              loading="lazy"
              decoding="async"
              className="h-6 w-6 ml-2 cursor-pointer"
              title="Create Flex Folders"
            />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Video Directors Required</Label>
              <Input
                type="number"
                min="0"
                value={personnel?.video_directors || 0}
                onChange={async (e) => {
                  const { error } = await dataLayerClient.from('video_job_personnel')
                    .update({ video_directors: parseInt(e.target.value) })
                    .eq('id', personnel?.id);
                  
                  if (error) {
                    toast({
                      title: "Update failed",
                      description: error.message,
                      variant: "destructive",
                    });
                  }
                  queryClient.invalidateQueries({ queryKey: queryKeys.scope('video-personnel', jobId) });
                }}
              />
            </div>
            <div>
              <Label>Camera Operators Required</Label>
              <Input
                type="number"
                min="0"
                value={personnel?.camera_ops || 0}
                onChange={async (e) => {
                  const { error } = await dataLayerClient.from('video_job_personnel')
                    .update({ camera_ops: parseInt(e.target.value) })
                    .eq('id', personnel?.id);
                  
                  if (error) {
                    toast({
                      title: "Update failed",
                      description: error.message,
                      variant: "destructive",
                    });
                  }
                  queryClient.invalidateQueries({ queryKey: queryKeys.scope('video-personnel', jobId) });
                }}
              />
            </div>
            <div>
              <Label>Playback Techs Required</Label>
              <Input
                type="number"
                min="0"
                value={personnel?.playback_techs || 0}
                onChange={async (e) => {
                  const { error } = await dataLayerClient.from('video_job_personnel')
                    .update({ playback_techs: parseInt(e.target.value) })
                    .eq('id', personnel?.id);
                  
                  if (error) {
                    toast({
                      title: "Update failed",
                      description: error.message,
                      variant: "destructive",
                    });
                  }
                  queryClient.invalidateQueries({ queryKey: queryKeys.scope('video-personnel', jobId) });
                }}
              />
            </div>
            <div>
              <Label>Video Techs Required</Label>
              <Input
                type="number"
                min="0"
                value={personnel?.video_techs || 0}
                onChange={async (e) => {
                  const { error } = await dataLayerClient.from('video_job_personnel')
                    .update({ video_techs: parseInt(e.target.value) })
                    .eq('id', personnel?.id);
                  
                  if (error) {
                    toast({
                      title: "Update failed",
                      description: error.message,
                      variant: "destructive",
                    });
                  }
                  queryClient.invalidateQueries({ queryKey: queryKeys.scope('video-personnel', jobId) });
                }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-medium">Total Progress:</span>
              <div className="flex-1">
                <Progress 
                  value={calculateTotalProgress()} 
                  className="h-2"
                />
              </div>
              <span className="text-sm">{calculateTotalProgress()}%</span>
            </div>

            <div className="w-full overflow-x-auto">
              <UITable className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[15%]">Task</TableHead>
                    <TableHead className="w-[20%]">Assigned To</TableHead>
                    <TableHead className="w-[15%]">Status</TableHead>
                    <TableHead className="w-[15%]">Progress</TableHead>
                    <TableHead className="w-[20%]">Documents</TableHead>
                    <TableHead className="w-[15%]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TASK_TYPES.video.map((taskType) => {
                    const task = tasks?.find(t => t.task_type === taskType);
                    return (
                      <TableRow key={taskType}>
                        <TableCell className="font-medium truncate max-w-[100px]">
                          {taskType}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={task?.assigned_to?.id || ""}
                            onValueChange={async (value) => {
                              if (!task) {
                                const { error } = await dataLayerClient.from('video_job_tasks')
                                  .insert({
                                    job_id: jobId,
                                    task_type: taskType,
                                    assigned_to: value,
                                  });
                                if (error) throw error;
                              } else {
                                const { error } = await dataLayerClient.from('video_job_tasks')
                                  .update({ assigned_to: value })
                                  .eq('id', task.id);
                                if (error) throw error;
                              }
                              refetchTasks();
                            }}
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue placeholder="Assign to..." />
                            </SelectTrigger>
                            <SelectContent>
                              {managementUsers?.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.first_name} {user.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {task && (
                            <Select
                              value={task.status ?? 'not_started'}
                              onValueChange={(value) => updateTaskStatus(task.id, value as TaskStatus)}
                            >
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not_started">Not Started</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          {task && (
                            <div className="flex items-center gap-1">
                              <Progress 
                                value={task.progress || 0}
                                className={`h-2 ${getProgressColor(task.status || 'not_started')}`}
                              />
                              <span className="text-xs w-7">{task.progress || 0}%</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-h-[60px] overflow-y-auto">
                            {task?.task_documents?.map((doc: TaskDocumentRow) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-1 text-xs"
                              >
                                <span className="truncate max-w-[100px]" title={doc.file_name}>
                                  {doc.file_name}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => handleDownload(doc.file_path, doc.file_name)}
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => handleDeleteFile(task.id, doc.id, doc.file_path)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {task && (
                            <div className="relative">
                              <input
                                type="file"
                                multiple
                                accept={DOCUMENT_UPLOAD_ACCEPT}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files ?? []);
                                  e.target.value = "";
                                  if (files.length > 0) handleFileUpload(task.id, files);
                                }}
                                disabled={uploading}
                              />
                              <Button 
                                variant="outline" 
                                size="sm" 
                                disabled={uploading}
                                className="w-[100px]"
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Subir
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </UITable>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
