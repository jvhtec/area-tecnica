import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskList } from "@/components/tasks/TaskList";
import { canAssignTasks, canEditTasks, isTechRole } from "@/utils/tasks";

interface TaskManagerDialogProps {
  jobId?: string;
  tourId?: string;
  userRole?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Phase A: Wrapper that presents a unified entry point and opens
// the existing department dialogs from each tab. Read-only parity.
export const TaskManagerDialog: React.FC<TaskManagerDialogProps> = ({ jobId, tourId, userRole, open, onOpenChange }) => {
  const [activeTab, setActiveTab] = React.useState<'sound' | 'lights' | 'video'>('sound');
  const canEdit = canEditTasks(userRole);
  const canAssign = canAssignTasks(userRole);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Task Manager</DialogTitle>
        </DialogHeader>
        <div className="mt-2 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sound">Sound</TabsTrigger>
              <TabsTrigger value="lights">Lights</TabsTrigger>
              <TabsTrigger value="video">Video</TabsTrigger>
            </TabsList>
            <TabsContent value="sound" className="pt-4">
              <TaskList jobId={jobId} tourId={tourId} department="sound" canEdit={canEdit} canAssign={canAssign} canUpdateOwn={true} />
            </TabsContent>
            <TabsContent value="lights" className="pt-4">
              <TaskList jobId={jobId} tourId={tourId} department="lights" canEdit={canEdit} canAssign={canAssign} canUpdateOwn={true} />
            </TabsContent>
            <TabsContent value="video" className="pt-4">
              <TaskList jobId={jobId} tourId={tourId} department="video" canEdit={canEdit} canAssign={canAssign} canUpdateOwn={true} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskManagerDialog;
