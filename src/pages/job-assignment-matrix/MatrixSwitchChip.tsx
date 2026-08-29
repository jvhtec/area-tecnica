import type { ReactNode } from 'react';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * One labelled toggle in the matrix toolbar.
 *
 * Kept as a Switch (not a pressed-state button) on purpose: the e2e suite and
 * assistive tech both address these by `role=switch` plus their aria-label, and
 * the label text is what tells a coordinator which mode they are turning on.
 */
export const MatrixSwitchChip = ({
  label,
  ariaLabel,
  checked,
  onCheckedChange,
  icon,
  trailing,
  className,
  block = false,
}: {
  label: string;
  ariaLabel: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  icon?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  /** Full-width row layout for the mobile filter panel. */
  block?: boolean;
}) => (
  <div
    className={cn(
      'flex items-center gap-2',
      block
        ? 'w-full justify-between rounded-lg border bg-card px-2.5 py-2'
        : 'rounded-lg border bg-background/60 px-2 py-1',
      checked && !block && 'border-primary/40 bg-primary/10',
      className,
    )}
  >
    <span className="flex min-w-0 items-center gap-1.5">
      {icon}
      <span className={cn('truncate font-medium', block ? 'text-sm' : 'text-xs')}>{label}</span>
    </span>
    <span className="flex shrink-0 items-center gap-1.5">
      {trailing}
      <Switch checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} aria-label={ariaLabel} />
    </span>
  </div>
);
