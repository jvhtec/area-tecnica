import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { JobExtrasManagement } from './JobExtrasManagement';

interface JobExtrasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  isManager?: boolean;
}

export const JobExtrasDialog = ({ 
  open, 
  onOpenChange, 
  jobId, 
  jobTitle, 
  isManager = false 
}: JobExtrasDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Job Extras - {jobTitle}</DialogTitle>
        </DialogHeader>
        
        <JobExtrasManagement jobId={jobId} isManager={isManager} />
      </DialogContent>
    </Dialog>
  );
};