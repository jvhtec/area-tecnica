import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import { useMemo } from 'react';

type StarRatingSize = 'sm' | 'md' | 'lg';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: StarRatingSize;
  className?: string;
  label?: string;
}

const sizeMap: Record<StarRatingSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export const StarRating = ({
  value,
  onChange,
  readOnly = false,
  size = 'md',
  className,
  label,
}: StarRatingProps) => {
  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  const handleClick = (starValue: number) => {
    if (readOnly || !onChange) return;
    onChange(starValue);
  };

  return (
    <div className={cn('flex items-center gap-1', className)} aria-label={label ?? 'Valoración'}>
      {stars.map((star) => {
        const active = value >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => handleClick(star)}
            className={cn(
              'transition-colors disabled:cursor-default',
              readOnly ? 'cursor-default' : 'cursor-pointer'
            )}
          >
            <Star
              className={cn(sizeMap[size], active ? 'fill-yellow-400 text-yellow-500' : 'text-muted-foreground')}
              aria-hidden="true"
            />
            <span className="sr-only">{`${star} estrella${star > 1 ? 's' : ''}`}</span>
          </button>
        );
      })}
    </div>
  );
};
