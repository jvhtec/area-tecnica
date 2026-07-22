import type { ReactNode } from "react";

/**
 * Browser/app chrome frame used to present the in-DOM product mockups on the
 * landing page. These are not stock images — they are faithful, live
 * recreations of the real Sector Pro screens built with the app's own design
 * language and real domain data (departments, roles, assignment statuses).
 */
export function AppWindow({
  url,
  title,
  badge,
  children,
  className = "",
}: {
  url: string;
  title?: string;
  /** Optional label (e.g. "Módulo") shown as a pill in the chrome header. */
  badge?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-black/50 ring-1 ring-white/5 backdrop-blur ${className}`}
    >
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/[0.03] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400/70" />
        <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
        <span className="h-3 w-3 rounded-full bg-green-400/70" />
        <span className="ml-3 truncate text-xs text-slate-500">{url}</span>
        <span className="ml-auto flex items-center gap-2">
          {badge ? (
            <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-amber-300">
              {badge}
            </span>
          ) : null}
          {title ? (
            <span className="hidden truncate text-xs font-medium text-slate-400 sm:block">{title}</span>
          ) : null}
        </span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
