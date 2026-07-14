import React from "react";

import { cn } from "@/lib/utils";
import { getMobileAccent, type MobileAccentKey } from "./mobile-accents";

export type MobileTimelineState = "past" | "live" | "upcoming" | "none";

interface MobileTimelineItemProps {
  accent?: MobileAccentKey;
  /** Temporal state relative to now; "none" (non-today views) renders a neutral node. */
  state?: MobileTimelineState;
  isFirst?: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}

/**
 * One row of the agenda timeline: a narrow gutter with a continuous rail and a
 * state node, next to the job card. Finished jobs dim, the running job gets a
 * pulsing accent node, upcoming jobs show a hollow node.
 */
export const MobileTimelineItem: React.FC<MobileTimelineItemProps> = ({
  accent = "default",
  state = "none",
  isFirst = false,
  isLast = false,
  children,
}) => {
  const a = getMobileAccent(accent);

  return (
    <div className="flex gap-2.5">
      <div className="relative flex w-5 shrink-0 justify-center" aria-hidden="true">
        <div
          className={cn(
            "absolute w-px bg-border",
            isFirst ? "top-7" : "top-0",
            isLast ? "h-7" : "bottom-0",
          )}
        />
        <span className="absolute top-6 flex h-3 w-3 items-center justify-center">
          {state === "live" && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                a.meter,
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex h-3 w-3 rounded-full",
              state === "live" && a.meter,
              state === "past" && "bg-muted-foreground/40",
              (state === "upcoming" || state === "none") &&
                "border-2 border-muted-foreground/50 bg-background",
            )}
          />
        </span>
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 pb-3",
          state === "past" && "opacity-70 saturate-50",
        )}
      >
        {children}
      </div>
    </div>
  );
};
