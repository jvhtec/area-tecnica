import React, { useEffect, useState } from "react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { getMobileAccent, type MobileAccentKey } from "./mobile-accents";

interface MobileNowDividerProps {
  accent?: MobileAccentKey;
}

/**
 * "Ahora · HH:MM" divider for today's agenda list: an accent-colored rule with
 * a pulsing dot, placed by the parent between the jobs that have started and
 * the ones still to come. Re-renders itself once a minute to stay current.
 */
export const MobileNowDivider: React.FC<MobileNowDividerProps> = ({
  accent = "default",
}) => {
  const a = getMobileAccent(accent);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 py-0.5" role="separator" aria-label={`Ahora, ${format(now, "HH:mm")}`}>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
            a.meter,
          )}
        />
        <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", a.meter)} />
      </span>
      <span className={cn("text-xs font-bold uppercase tracking-wide tabular-nums", a.kicker)}>
        Ahora · {format(now, "HH:mm")}
      </span>
      <span className={cn("h-px flex-1 opacity-40", a.meter)} />
    </div>
  );
};
