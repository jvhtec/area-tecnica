import { Button } from '@/components/ui/button';
import { type AchievementCategory, CATEGORY_LABELS, CATEGORY_ORDER } from '@/types/achievements';

interface AchievementsFiltersProps {
  selected: AchievementCategory | 'all';
  onChange: (category: AchievementCategory | 'all') => void;
  counts: Record<string, { total: number; unlocked: number }>;
}

export function AchievementsFilters({ selected, onChange, counts }: AchievementsFiltersProps) {
  const allTotal = Object.values(counts).reduce((s, c) => s + c.total, 0);
  const allUnlocked = Object.values(counts).reduce((s, c) => s + c.unlocked, 0);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={selected === 'all' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('all')}
      >
        Todos ({allUnlocked}/{allTotal})
      </Button>
      {CATEGORY_ORDER.map((cat) => {
        const c = counts[cat];
        if (!c || c.total === 0) return null;
        return (
          <Button
            key={cat}
            variant={selected === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(cat)}
          >
            {CATEGORY_LABELS[cat]} ({c.unlocked}/{c.total})
          </Button>
        );
      })}
    </div>
  );
}
