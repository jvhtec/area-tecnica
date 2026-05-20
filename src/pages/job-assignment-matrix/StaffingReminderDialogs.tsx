import { StaffingOrchestratorPanel } from '@/components/matrix/StaffingOrchestratorPanel';
import { Button } from '@/components/ui/button';
import {
  CARLOS_AGENT_DESCRIPTION,
  CARLOS_AGENT_NAME,
} from '@/features/staffing/carlos';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DEPARTMENT_LABELS,
  formatLabel,
  type OutstandingJobInfo,
} from '@/pages/job-assignment-matrix/utils';

type StaffingOrchestratorTarget = null | {
  jobId: string;
  department: string;
  jobTitle: string;
};

type StaffingReminderDialogsProps = {
  showStaffingReminder: boolean;
  handleReminderOpenChange: (open: boolean) => void;
  outstandingJobs: OutstandingJobInfo[];
  handleDismissReminder: () => void;
  staffingOrchestratorTarget: StaffingOrchestratorTarget;
  setStaffingOrchestratorTarget: (value: StaffingOrchestratorTarget) => void;
  setShowStaffingReminder: (value: boolean) => void;
};

export const StaffingReminderDialogs = ({
  showStaffingReminder,
  handleReminderOpenChange,
  outstandingJobs,
  handleDismissReminder,
  staffingOrchestratorTarget,
  setStaffingOrchestratorTarget,
  setShowStaffingReminder,
}: StaffingReminderDialogsProps) => (
  <>
    <Dialog open={showStaffingReminder} onOpenChange={handleReminderOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Hay {outstandingJobs.length} trabajos con personal por completar
          </DialogTitle>
          <DialogDescription>
            Revisa los roles pendientes para completar la dotación de cada equipo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {outstandingJobs.map((job) => (
            <div key={job.jobId} className="rounded-md border p-3">
              <div className="text-sm font-semibold">{job.jobTitle}</div>
              <div className="mt-2 space-y-2">
                {job.departments.map((dept) => (
                  <div key={`${job.jobId}-${dept.department}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{dept.displayName}</div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setStaffingOrchestratorTarget({
                            jobId: job.jobId,
                            department: dept.department,
                            jobTitle: job.jobTitle,
                          });
                          setShowStaffingReminder(false);
                        }}
                      >
                        {CARLOS_AGENT_NAME}
                      </Button>
                    </div>
                    <ul className="ml-4 mt-1 list-disc space-y-1 text-sm text-muted-foreground">
                      {dept.roles.map((role) => (
                        <li key={`${job.jobId}-${dept.department}-${role.roleCode}`}>
                          {role.outstanding} × {formatLabel(role.roleCode)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleDismissReminder} variant="default">
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      open={Boolean(staffingOrchestratorTarget)}
      onOpenChange={(open) => {
        if (!open) setStaffingOrchestratorTarget(null);
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {CARLOS_AGENT_NAME}
            {staffingOrchestratorTarget?.jobTitle ? ` - ${staffingOrchestratorTarget.jobTitle}` : ''}
          </DialogTitle>
          <DialogDescription>
            {CARLOS_AGENT_DESCRIPTION}
            {staffingOrchestratorTarget?.department
              ? ` - Departamento: ${DEPARTMENT_LABELS[staffingOrchestratorTarget.department] || formatLabel(staffingOrchestratorTarget.department)}`
              : null}
          </DialogDescription>
        </DialogHeader>

        {staffingOrchestratorTarget && (
          <StaffingOrchestratorPanel
            jobId={staffingOrchestratorTarget.jobId}
            department={staffingOrchestratorTarget.department}
            jobTitle={staffingOrchestratorTarget.jobTitle}
            onClose={() => setStaffingOrchestratorTarget(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  </>
);
