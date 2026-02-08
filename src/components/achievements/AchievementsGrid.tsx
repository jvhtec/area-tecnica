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

    // Unlocked first, then by sort_order
    return list.sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return a.sort_order - b.sort_order;
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
          <AchievementCard key={a.id} achievement={a} />
        ))}
      </div>
    </div>
  );
}
