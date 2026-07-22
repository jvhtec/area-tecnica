import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { GRADIENT_TEXT } from "./_shared";
import { LogisticsMock } from "./visuals/LogisticsMock";
import { PesosMock } from "./visuals/PesosMock";
import { RfMock } from "./visuals/RfMock";
import { MatrixMock } from "./visuals/MatrixMock";
import { WallboardMock } from "./visuals/WallboardMock";
import { TimesheetMock } from "./visuals/TimesheetMock";

const phases = [
  { tc: "08:00", label: "Montaje", sub: "Load-in y tiempos de almacén", dept: "Logística", dot: "bg-emerald-400", Comp: LogisticsMock, premium: true },
  { tc: "13:30", label: "Rigging", sub: "Pesos, motores y puntos de carga", dept: "Estructuras", dot: "bg-lime-400", Comp: PesosMock, premium: false },
  { tc: "16:00", label: "Prueba de sonido", sub: "Plan de RF, IEM y consumos", dept: "Sonido", dot: "bg-sky-400", Comp: RfMock, premium: false },
  { tc: "18:30", label: "Entra el crew", sub: "Matriz, fichajes y conflictos", dept: "Crew", dot: "bg-violet-400", Comp: MatrixMock, premium: false },
  { tc: "21:00", label: "Show", sub: "Wallboard y turnos en vivo", dept: "Producción", dot: "bg-rose-400", Comp: WallboardMock, premium: false },
  { tc: "01:30", label: "Cierre", sub: "Payouts, festivos y PDF", dept: "Administración", dot: "bg-amber-400", Comp: TimesheetMock, premium: true },
];

export function ShowDayTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  const lineScale = useTransform(scrollYProgress, [0, 1], [0.08, 1]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(phases.length - 1, Math.max(0, Math.floor(v * phases.length + 0.0001)));
    setActive(idx);
  });

  const Active = phases[active].Comp;

  return (
    <section ref={ref} className="relative" style={{ height: `${phases.length * 62}vh` }}>
      <div className="sticky top-8 flex min-h-[calc(100vh-2rem)] items-center px-6 py-16">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-10 text-center lg:mb-14">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-sky-300/90">
              Un día · una plataforma
            </span>
            <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Del load-in al último{" "}
              <span className={GRADIENT_TEXT}>payout</span>
            </h2>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,20rem)_1fr]">
            {/* timeline rail */}
            <div className="relative pl-8">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
              <motion.div
                className="absolute left-[7px] top-2 w-px origin-top bg-gradient-to-b from-sky-400 to-violet-400"
                style={{ height: "calc(100% - 1rem)", scaleY: lineScale }}
              />
              <ul className="space-y-4">
                {phases.map((p, i) => {
                  const on = i === active;
                  const done = i < active;
                  return (
                    <li key={p.tc} className="relative">
                      <span
                        className={`absolute -left-8 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-[#070910] transition-colors ${
                          on ? p.dot : done ? "bg-slate-400" : "bg-slate-700"
                        }`}
                      />
                      <button
                        onClick={() =>
                          ref.current?.scrollIntoView
                            ? window.scrollTo({
                                top:
                                  (ref.current.offsetTop || 0) +
                                  (ref.current.offsetHeight - window.innerHeight) * (i / phases.length),
                                behavior: "smooth",
                              })
                            : undefined
                        }
                        className={`block text-left transition-opacity ${on ? "opacity-100" : "opacity-45 hover:opacity-80"}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-sm text-slate-400">{p.tc}</span>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-600">{p.dept}</span>
                          {p.premium && (
                            <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1 py-0.5 font-mono text-[9px] uppercase text-amber-300">
                              Módulo
                            </span>
                          )}
                        </span>
                        <span className="block text-lg font-semibold text-white">{p.label}</span>
                        <span className="block text-sm text-slate-400">{p.sub}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* synced panel */}
            <div className="relative">
              <div className="absolute -inset-5 -z-10 rounded-3xl bg-gradient-to-tr from-sky-500/10 via-violet-500/[0.08] to-transparent blur-2xl" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.99 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Active />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
