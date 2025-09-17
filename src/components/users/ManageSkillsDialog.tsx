import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProfileSkillsEditor } from '@/components/profile/ProfileSkillsEditor';

interface ManageSkillsDialogProps {
  profileId: string | null;
  fullName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ManageSkillsDialog: React.FC<ManageSkillsDialogProps> = ({ profileId, fullName, open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Skills{fullName ? ` — ${fullName}` : ''}</DialogTitle>
        </DialogHeader>
        {profileId && (
          <ProfileSkillsEditor profileId={profileId} />
        )}
      </DialogContent>
    </Dialog>
  );
};

