import { useState, useMemo } from 'react';
import { Loader2, Trophy } from 'lucide-react';
import { useAchievements } from '@/hooks/useAchievements';
import { AchievementCard } from './AchievementCard';
import { AchievementsFilters } from './AchievementsFilters';
import type { AchievementCategory, AchievementWithStatus } from '@/types/achievements';

interface AchievementsGridProps {
  targetUserId?: string;
}

export function AchievementsGrid({ targetUserId }: AchievementsGridProps) {
  const { data: achievements, isLoading } = useAchievements(targetUserId);
  const [filter, setFilter] = useState<AchievementCategory | 'all'>('all');

  const counts = useMemo(() => {
    if (!achievements) return {};
    const result: Record<string, { total: number; unlocked: number }> = {};
    for (const a of achievements) {
      if (!result[a.category]) result[a.category] = { total: 0, unlocked: 0 };
      result[a.category].total++;
      if (a.unlocked) result[a.category].unlocked++;
    }
    return result;
  }, [achievements]);

  const filtered = useMemo(() => {
    if (!achievements) return [];
    let list: AchievementWithStatus[] =
      filter === 'all' ? achievements : achievements.filter((a) => a.category === filter);

    // Only show unlocked achievements — locked ones stay hidden until earned
    return list.filter((a) => a.unlocked).sort((a, b) => {
      if (!a.unlocked_at || !b.unlocked_at) return 0;
      return new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime();
    });
  }, [achievements, filter]);

  const totalUnlocked = achievements?.filter((a) => a.unlocked).length ?? 0;
  const totalCount = achievements?.length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const lockedCount = achievements?.filter((a) => !a.unlocked).length ?? 0;

  if (!achievements || achievements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Trophy className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">No hay logros disponibles todavía.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <Trophy className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">
          {totalUnlocked} de {totalCount} logros desbloqueados
        </span>
      </div>

      {/* Filters */}
      <AchievementsFilters selected={filter} onChange={setFilter} counts={counts} />

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Trophy className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">Aún no has desbloqueado logros en esta categoría.</p>
          <p className="text-xs mt-1">¡Sigue trabajando para descubrirlos!</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <AchievementCard key={a.id} achievement={a} />
          ))}
        </div>
      )}

      {/* Hidden hint */}
      {lockedCount > 0 && (
        <p className="text-center text-xs text-muted-foreground pt-2">
          {lockedCount} {lockedCount === 1 ? 'logro por descubrir' : 'logros por descubrir'}
        </p>
      )}
    </div>
  );
}
