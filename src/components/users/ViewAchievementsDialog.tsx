import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Award } from 'lucide-react';
import { AchievementsGrid } from '@/components/achievements/AchievementsGrid';
import { ManualAwardDialog } from '@/components/achievements/ManualAwardDialog';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';

interface ViewAchievementsDialogProps {
  profileId: string | null;
  fullName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ViewAchievementsDialog: React.FC<ViewAchievementsDialogProps> = ({ profileId, fullName, open, onOpenChange }) => {
  const { userRole } = useOptimizedAuth();
  const [showAwardDialog, setShowAwardDialog] = useState(false);
  const canAwardAchievements = userRole === 'admin' || userRole === 'management';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Logros{fullName ? ` — ${fullName}` : ''}</DialogTitle>
              {canAwardAchievements && profileId && fullName && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAwardDialog(true)}
                >
                  <Award className="h-4 w-4 mr-2" />
                  Otorgar logro
                </Button>
              )}
            </div>
          </DialogHeader>
          {profileId && <AchievementsGrid targetUserId={profileId} />}
        </DialogContent>
      </Dialog>

      {profileId && fullName && (
        <ManualAwardDialog
          targetUserId={profileId}
          targetUserName={fullName}
          open={showAwardDialog}
          onOpenChange={setShowAwardDialog}
        />
      )}
    </>
  );
};
