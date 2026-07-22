import { motion, useReducedMotion } from "framer-motion";
import { AppWindow } from "./AppWindow";

const onDuty = [
  { name: "Javier Ruiz", role: "FOH", dept: "bg-sky-400" },
  { name: "Marta León", role: "Monitores", dept: "bg-sky-400" },
  { name: "Carlos Vidal", role: "LD", dept: "bg-amber-400" },
  { name: "Diego Marín", role: "Realización", dept: "bg-violet-400" },
];

export function WallboardMock() {
  const reduce = useReducedMotion();
  return (
    <AppWindow url="sector-pro.work/wallboard" title="Wallboard en vivo">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-500">Ahora en escenario</p>
          <p className="text-2xl font-bold text-white">Cabecera de cartel</p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 text-[11px] font-medium text-rose-300">
            <span className="relative flex h-2 w-2">
              {!reduce && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
            EN VIVO
          </p>
          <p className="mt-1 font-mono text-lg text-white">21:00</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {onDuty.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${p.dept}`} />
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-medium text-slate-100">{p.name}</span>
              <span className="block text-[10px] text-slate-500">{p.role}</span>
            </span>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-200">
        📣 Cambio de turno de monitores a las 22:30 · pase por control
      </div>
    </AppWindow>
  );
}
