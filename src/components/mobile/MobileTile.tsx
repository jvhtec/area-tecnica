import React from "react";

import { cn } from "@/lib/utils";
import { getMobileAccent, type MobileAccentKey } from "./mobile-accents";

interface MobileTileProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  accent?: MobileAccentKey;
  /** Overrides the accent icon color (legacy tool definitions pass a text-* class). */
  iconClassName?: string;
  className?: string;
}

/**
 * Quick-action tile: a soft colored icon chip over a card surface with a bold
 * label. Sized for thumbs (≥88px square) with a press-scale affordance.
 */
export const MobileTile: React.FC<MobileTileProps> = ({
  icon: Icon,
  label,
  onClick,
  accent = "default",
  iconClassName,
  className,
}) => {
  const a = getMobileAccent(accent);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[96px] min-w-[104px] max-w-[140px] snap-start flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card p-2.5 shadow-sm transition-all hover:shadow-md active:scale-95",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          a.chipBg,
        )}
      >
        <Icon className={cn("h-5 w-5", iconClassName || a.chipText)} aria-hidden="true" />
      </span>
      <span className="line-clamp-2 max-w-full text-center text-xs font-bold leading-tight text-foreground">
        {label}
      </span>
    </button>
  );
};
