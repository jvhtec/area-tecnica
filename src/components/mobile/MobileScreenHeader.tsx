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
  /** Optional extra content rendered inside the hero (chips, filters…). */
  children?: React.ReactNode;
}

/**
 * Dark hero header for mobile hub screens: a deep slate panel with two
 * accent-colored glow blobs behind the title. Identical in light and dark
 * themes (the panel is intentionally always dark, like stage lighting).
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
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-lg dark:border dark:border-slate-800">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full blur-3xl",
          a.glowA,
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full blur-3xl",
          a.glowB,
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em]",
              a.kicker,
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            <span className="truncate">{kicker}</span>
          </div>
          <h2 className="mt-1 line-clamp-2 break-words text-3xl font-extrabold leading-tight tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 truncate text-sm font-medium text-white/60">{subtitle}</p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>

      {children && <div className="relative mt-4">{children}</div>}
    </header>
  );
};
