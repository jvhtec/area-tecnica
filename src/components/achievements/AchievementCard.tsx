import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Lock } from 'lucide-react';
import type { AchievementWithStatus } from '@/types/achievements';

interface AchievementCardProps {
  achievement: AchievementWithStatus;
}

export function AchievementCard({ achievement }: AchievementCardProps) {
  const isLocked = !achievement.unlocked;
  const isHidden = achievement.is_hidden && isLocked;

  const progress = achievement.threshold > 0
    ? Math.min(achievement.current_value / achievement.threshold, 1)
    : 0;

  return (
    <div
      className={`relative rounded-xl border p-4 transition-all ${
        isLocked
          ? 'border-border/50 bg-muted/30 opacity-60'
          : 'border-primary/20 bg-card shadow-sm'
      }`}
    >
      {/* Icon */}
      <div className="flex items-start gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl ${
            isLocked ? 'bg-muted grayscale' : 'bg-primary/10'
          }`}
        >
          {isHidden ? (
            <Lock className="h-5 w-5 text-muted-foreground" />
          ) : (
            achievement.icon || '🏆'
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Title */}
          <h3
            className={`font-semibold leading-tight ${
              isLocked ? 'text-muted-foreground' : 'text-foreground'
            }`}
          >
            {isHidden ? '???' : achievement.title}
          </h3>

          {/* Description */}
          <p className="mt-1 text-sm text-muted-foreground leading-snug">
            {isHidden
              ? achievement.hint || 'Logro oculto. Sigue trabajando para desbloquearlo.'
              : isLocked
                ? achievement.hint || achievement.description
                : achievement.description}
          </p>

          {/* Unlock date */}
          {achievement.unlocked && achievement.unlocked_at && (
            <p className="mt-2 text-xs text-muted-foreground">
              Desbloqueado el{' '}
              {format(new Date(achievement.unlocked_at), "d 'de' MMMM yyyy", { locale: es })}
            </p>
          )}

          {/* Progress bar for locked achievements */}
          {isLocked && !isHidden && achievement.threshold > 1 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {achievement.current_value} / {achievement.threshold}
                </span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/50 transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
