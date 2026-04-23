import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAchievements, useManuallyAwardAchievement } from '@/hooks/useAchievements';
import { useToast } from '@/hooks/use-toast';
import type { AchievementWithStatus } from '@/types/achievements';

interface ManualAwardDialogProps {
  targetUserId: string;
  targetUserName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualAwardDialog({
  targetUserId,
  targetUserName,
  open,
  onOpenChange,
}: ManualAwardDialogProps) {
  const [selectedAchievementId, setSelectedAchievementId] = useState<string>('');
  const { data: achievements, isLoading } = useAchievements(targetUserId);
  const awardMutation = useManuallyAwardAchievement();
  const { toast } = useToast();

  // Filter out already unlocked achievements
  const availableAchievements = achievements?.filter((a) => !a.unlocked) || [];

  const selectedAchievement = availableAchievements.find(
    (a) => a.id === selectedAchievementId
  );

  // Intercept dialog close to clear selection
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedAchievementId('');
    }
    onOpenChange(newOpen);
  };

  const handleAward = async () => {
    if (!selectedAchievementId) return;

    // Capture title before async call to avoid stale reference after query invalidation
    const achievementTitle = selectedAchievement?.title;

    try {
      await awardMutation.mutateAsync({
        userId: targetUserId,
        achievementId: selectedAchievementId,
      });

      toast({
        title: 'Logro otorgado',
        description: `El logro "${achievementTitle}" ha sido otorgado a ${targetUserName}.`,
      });

      handleOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'No se pudo otorgar el logro',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Otorgar logro</DialogTitle>
          <DialogDescription>
            Selecciona un logro para otorgar manualmente a {targetUserName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Logro</label>
            <Select
              value={selectedAchievementId}
              onValueChange={setSelectedAchievementId}
              disabled={isLoading || availableAchievements.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un logro..." />
              </SelectTrigger>
              <SelectContent>
                {availableAchievements.map((achievement) => (
                  <SelectItem key={achievement.id} value={achievement.id}>
                    <div className="flex items-center gap-2">
                      <span>{achievement.icon}</span>
                      <span>{achievement.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedAchievement && (
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedAchievement.icon}</span>
                <h4 className="font-semibold">{selectedAchievement.title}</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedAchievement.description}
              </p>
            </div>
          )}

          {availableAchievements.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Este usuario ya ha desbloqueado todos los logros disponibles.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAward}
            disabled={
              !selectedAchievementId ||
              awardMutation.isPending ||
              availableAchievements.length === 0
            }
          >
            {awardMutation.isPending ? 'Otorgando...' : 'Otorgar logro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
