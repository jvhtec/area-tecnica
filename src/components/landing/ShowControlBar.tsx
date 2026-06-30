import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * A thin "show-control" status strip pinned above the nav — the kind of header
 * a playback / show-control app shows. Runs a live PAL (25 fps) timecode in
 * Europe/Madrid, which is the timezone the whole app operates in. Sets the
 * "this is real production software" tone for the entire page.
 */
export function ShowControlBar() {
  const tcRef = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const parts = new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    let raf = 0;
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const now = new Date();
      const [{ value: hh }, , { value: mm }, , { value: ss }] = parts.formatToParts(now);
      const ff = pad(Math.floor((now.getMilliseconds() / 1000) * 25));
      if (tcRef.current) tcRef.current.textContent = `${hh}:${mm}:${ss}:${ff}`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="sticky top-0 z-[60] border-b border-white/[0.06] bg-black/60 backdrop-blur-md">
      <div className="mx-auto flex h-8 max-w-[100rem] items-center gap-4 px-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 font-medium text-rose-300">
          <span className="relative flex h-2 w-2">
            {!reduce && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          EN DIRECTO
        </span>

        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="text-slate-600">SHOW</span>
          <span className="text-slate-300">Festival Sonorama · Día 2</span>
        </span>

        <span ref={tcRef} className="ml-auto font-mono tabular-nums tracking-tight text-slate-200">
          00:00:00:00
        </span>
        <span className="hidden font-mono text-slate-600 md:inline">25 fps</span>
        <span className="hidden text-slate-600 md:inline">Europe/Madrid</span>

        {/* live VU meter */}
        <span className="flex items-end gap-0.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className="w-0.5 rounded-full bg-emerald-400/80"
              initial={{ height: 4 }}
              animate={reduce ? { height: 6 } : { height: [3, 11, 5, 9, 4] }}
              transition={reduce ? undefined : { duration: 0.9 + i * 0.15, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </span>
        <span className="hidden items-center gap-1.5 text-emerald-300 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          señal
        </span>
      </div>
    </div>
  );
}
