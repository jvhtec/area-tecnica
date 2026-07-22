import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Grid3x3, Radio, Scale, Wand2 } from "lucide-react";
import { useState } from "react";
import { SectionHeading } from "./SectionHeading";
import { MatrixMock } from "./visuals/MatrixMock";
import { PesosMock } from "./visuals/PesosMock";
import { StaffingMock } from "./visuals/StaffingMock";
import { TimesheetMock } from "./visuals/TimesheetMock";
import { RfMock } from "./visuals/RfMock";

const tabs = [
  {
    id: "matriz",
    label: "Matriz",
    icon: Grid3x3,
    component: MatrixMock,
    title: "Asignación de crew",
    desc: "Técnicos × fechas en una sola vista, con estados en vivo, rankings y detección de dobles reservas.",
  },
  {
    id: "staffing",
    label: "Staffing",
    icon: Wand2,
    component: StaffingMock,
    title: "Motor de staffing",
    desc: "Campañas que rankean candidatos por distancia, fiabilidad y disponibilidad, e invitan automáticamente.",
  },
  {
    id: "pesos",
    label: "Pesos",
    icon: Scale,
    component: PesosMock,
    title: "Pesos y rigging",
    desc: "Cálculo de cargas por punto, motores y cable pick, con puntos de rigging y exportación a PDF.",
  },
  {
    id: "rf",
    label: "RF / IEM",
    icon: Radio,
    component: RfMock,
    title: "Coordinación de frecuencias",
    desc: "Plan de RF e IEM por banda con detección de solapamientos antes de que canten en el show.",
  },
  {
    id: "payouts",
    label: "Payouts",
    icon: CalendarClock,
    component: TimesheetMock,
    title: "Fichajes y nóminas",
    desc: "Horas extra, nocturnidad y festivos calculados en servidor, agrupados en payouts por quincena.",
    premium: true,
  },
];

export function ProductShowcase() {
  const [active, setActive] = useState(0);
  const Active = tabs[active].component;

  return (
    <section id="producto" className="relative px-6 py-24 scroll-mt-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Un vistazo al producto"
          title="No es una herramienta."
          highlight="Es el panel de control."
          lead="La misma plataforma para planificar el crew, calcular el rigging, coordinar la RF y cerrar las nóminas. Cambia de pantalla, no de app."
        />

        {/* tabs */}
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {tabs.map((t, i) => {
            const Icon = t.icon;
            const on = i === active;
            return (
              <button
                key={t.id}
                onClick={() => setActive(i)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  on
                    ? "border-sky-400/40 bg-sky-500/15 text-white"
                    : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {t.label}
                {t.premium && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Módulo premium" />}
              </button>
            );
          })}
        </div>

        {/* stage */}
        <div className="mt-10 grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`copy-${tabs[active].id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="order-2 lg:order-1"
            >
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-sky-300/90">
                {tabs[active].label}
                {tabs[active].premium && (
                  <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] tracking-wide text-amber-300">
                    Módulo premium
                  </span>
                )}
              </span>
              <h3 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{tabs[active].title}</h3>
              <p className="mt-4 text-pretty leading-relaxed text-slate-400">{tabs[active].desc}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {tabs.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => setActive(i)}
                    aria-label={t.label}
                    className={`h-1.5 rounded-full transition-all ${
                      i === active ? "w-8 bg-sky-400" : "w-3 bg-white/15 hover:bg-white/30"
                    }`}
                  />
                ))}
              </div>
            </motion.div>

            <motion.div
              key={`view-${tabs[active].id}`}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="relative order-1 lg:order-2"
            >
              <div className="absolute -inset-5 -z-10 rounded-3xl bg-gradient-to-tr from-sky-500/15 via-violet-500/10 to-cyan-400/10 blur-2xl" />
              <Active />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
