import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AchievementsGrid } from '@/components/achievements/AchievementsGrid';

interface ViewAchievementsDialogProps {
  profileId: string | null;
  fullName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ViewAchievementsDialog: React.FC<ViewAchievementsDialogProps> = ({ profileId, fullName, open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Logros{fullName ? ` — ${fullName}` : ''}</DialogTitle>
        </DialogHeader>
        {profileId && <AchievementsGrid targetUserId={profileId} />}
      </DialogContent>
    </Dialog>
  );
};
