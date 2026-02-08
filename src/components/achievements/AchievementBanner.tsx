import { useNavigate } from 'react-router-dom';
import { X, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUnseenAchievements, useMarkAchievementSeen } from '@/hooks/useAchievements';

export function AchievementBanner() {
  const navigate = useNavigate();
  const { data: unseen } = useUnseenAchievements();
  const markSeen = useMarkAchievementSeen();

  const current = unseen?.[0];
  if (!current) return null;

  const handleDismiss = () => {
    markSeen.mutate(current.unlockId);
  };

  const handleView = () => {
    markSeen.mutate(current.unlockId);
    navigate('/achievements');
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md animate-in slide-in-from-top-4 fade-in duration-500">
        <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-card shadow-lg">
          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-4">
            {/* Header */}
            <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
              <Trophy className="h-4 w-4" />
              Logro desbloqueado
            </div>

            {/* Achievement info */}
            <div className="flex items-start gap-3">
              <span className="text-3xl">
                {current.achievement.icon || '🏆'}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-foreground">
                  {current.achievement.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {current.achievement.description}
                </p>
              </div>
            </div>

            {/* Action */}
            <Button
              size="sm"
              className="mt-3 w-full"
              onClick={handleView}
            >
              Ver mis logros
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
