import React from "react";

import { cn } from "@/lib/utils";
import { getMobileAccent, type MobileAccentKey } from "./mobile-accents";

interface MobileScreenHeaderProps {
  /** Eyebrow text above the title (e.g. "Panel", "Departamento"). */
  kicker: string;
  title: string;
  subtitle?: string;
  accent?: MobileAccentKey;
  icon?: React.ElementType;
  /** Right-aligned slot, typically the user avatar. */
  right?: React.ReactNode;
  /** Optional extra content rendered below the title (chips, filters…). */
  children?: React.ReactNode;
}

/**
 * Large-title header for mobile hub screens, in the style of native mobile
 * apps: content sits directly on the page background, with the department
 * accent confined to the kicker and an optional soft icon chip.
 */
export const MobileScreenHeader: React.FC<MobileScreenHeaderProps> = ({
  kicker,
  title,
  subtitle,
  accent = "default",
  icon: Icon,
  right,
  children,
}) => {
  const a = getMobileAccent(accent);

  return (
    <header className="pt-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span
              className={cn(
                "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                a.chipBg,
              )}
            >
              <Icon className={cn("h-5 w-5", a.chipText)} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <div
              className={cn(
                "text-xs font-bold uppercase tracking-[0.12em]",
                a.kicker,
              )}
            >
              {kicker}
            </div>
            <h2 className="line-clamp-2 break-words text-2xl font-bold leading-tight tracking-tight text-foreground">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>

      {children && <div className="mt-3">{children}</div>}
    </header>
  );
};
