import React, { useEffect, useState } from "react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { getMobileAccent, type MobileAccentKey } from "./mobile-accents";

interface MobileNowDividerProps {
  accent?: MobileAccentKey;
  /** Render inside the agenda timeline: the pulsing dot moves into the rail gutter. */
  inTimeline?: boolean;
}

/**
 * "Ahora · HH:MM" divider for today's agenda list: an accent-colored rule with
 * a pulsing dot, placed by the parent between the jobs that have started and
 * the ones still to come. Re-renders itself once a minute to stay current.
 */
export const MobileNowDivider: React.FC<MobileNowDividerProps> = ({
  accent = "default",
  inTimeline = false,
}) => {
  const a = getMobileAccent(accent);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const dot = (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
          a.meter,
        )}
      />
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", a.meter)} />
    </span>
  );

  const label = (
    <>
      <span className={cn("text-xs font-bold uppercase tracking-wide tabular-nums", a.kicker)}>
        Ahora · {format(now, "HH:mm")}
      </span>
      <span className={cn("h-px flex-1 opacity-40", a.meter)} />
    </>
  );

  if (inTimeline) {
    return (
      <div
        className="flex gap-2.5"
        role="separator"
        aria-label={`Ahora, ${format(now, "HH:mm")}`}
      >
        <div className="relative flex w-5 shrink-0 justify-center" aria-hidden="true">
          <div className="absolute inset-y-0 w-px bg-border" />
          <span className="absolute top-1/2 -translate-y-1/2">{dot}</span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 pb-3">{label}</div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 py-0.5"
      role="separator"
      aria-label={`Ahora, ${format(now, "HH:mm")}`}
    >
      {dot}
      {label}
    </div>
  );
};
