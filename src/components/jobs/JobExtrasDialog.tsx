import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog';
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
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-4xl max-h-[85vh] md:max-h-[90vh] overflow-y-auto w-[95vw] md:w-full">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-base md:text-lg">Job Extras - {jobTitle}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        
        <JobExtrasManagement jobId={jobId} isManager={isManager} />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};