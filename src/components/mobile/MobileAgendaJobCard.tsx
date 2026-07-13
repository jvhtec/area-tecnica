import React from "react";
import { MapPin, Truck, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getMobileAccent,
  getStatusChipClass,
  type MobileAccentKey,
} from "./mobile-accents";

interface MobileAgendaJobCardProps {
  title: string;
  locationName: string;
  status?: string | null;
  /** The job's calendar color; tints the time rail. */
  jobColor?: string | null;
  startLabel: string;
  endLabel: string;
  departments?: string[];
  assignedCount?: number;
  neededCount?: number;
  trucksCount?: number;
  accent?: MobileAccentKey;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Slot for the edit/delete dropdown trigger. */
  menu?: React.ReactNode;
}

/**
 * Bold agenda job card shared by the mobile hubs: a color-tinted time rail on
 * the left, title + venue + chips in the body, a staffing meter, and
 * full-height labeled CTAs. Purely presentational — parents format labels.
 */
export const MobileAgendaJobCard: React.FC<MobileAgendaJobCardProps> = ({
  title,
  locationName,
  status,
  jobColor,
  startLabel,
  endLabel,
  departments = [],
  assignedCount,
  neededCount,
  trucksCount,
  accent = "default",
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  menu,
}) => {
  const a = getMobileAccent(accent);
  const railColor = jobColor || "#6366f1";
  const showMeter = typeof assignedCount === "number" && (neededCount ?? 0) > 0;
  const meterPct = showMeter
    ? Math.min(100, Math.round(((assignedCount as number) / (neededCount as number)) * 100))
    : 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-stretch">
        {/* Time rail */}
        <div
          className="flex w-[76px] shrink-0 flex-col items-center justify-center gap-0.5 border-r border-border/50 px-2 py-4"
          style={{ backgroundColor: `${railColor}1a` }}
        >
          <span className="text-lg font-extrabold leading-none tracking-tight text-foreground">
            {startLabel}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">{endLabel}</span>
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 text-base font-bold leading-snug text-foreground">
              {title}
            </h3>
            {menu}
          </div>

          <div className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{locationName}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {status && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
                  getStatusChipClass(status),
                )}
              >
                {status}
              </span>
            )}
            {departments.map((dept) => (
              <span
                key={dept}
                className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                {dept}
              </span>
            ))}
          </div>

          {(showMeter || typeof trucksCount === "number") && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                {typeof assignedCount === "number" && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {assignedCount}
                    {neededCount ? `/${neededCount}` : ""} técnicos
                  </span>
                )}
                {typeof trucksCount === "number" && (
                  <span className="flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                    {trucksCount} camiones
                  </span>
                )}
              </div>
              {showMeter && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", a.meter)}
                    style={{ width: `${meterPct}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {(onPrimary || onSecondary) && (
        <div className="flex gap-2 border-t border-border/50 p-2.5">
          {onSecondary && secondaryLabel && (
            <button
              type="button"
              onClick={onSecondary}
              className="h-11 flex-1 rounded-xl border border-border bg-background text-sm font-bold text-foreground transition-all hover:bg-accent active:scale-[0.98]"
            >
              {secondaryLabel}
            </button>
          )}
          {onPrimary && primaryLabel && (
            <button
              type="button"
              onClick={onPrimary}
              className={cn(
                "h-11 flex-1 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-[0.98]",
                a.fill,
              )}
            >
              {primaryLabel}
            </button>
          )}
        </div>
      )}
    </article>
  );
};
