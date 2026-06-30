import { motion } from "framer-motion";
import { Truck } from "lucide-react";
import { AppWindow } from "./AppWindow";

const trucks = [
  { id: "Trailer 01", dept: "Sonido", pct: 100, done: true },
  { id: "Trailer 02", dept: "Luces", pct: 100, done: true },
  { id: "Rígido 03", dept: "Estructuras", pct: 64, done: false },
  { id: "Furgón 04", dept: "Vídeo", pct: 20, done: false },
];

export function LogisticsMock() {
  return (
    <AppWindow url="sector-pro.work/logistica" title="Load-in · almacén">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Montaje · Escenario Principal</p>
          <p className="text-[11px] text-slate-500">Entrada 08:00 · 4 vehículos</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[11px] text-emerald-300">
          <Truck className="h-3.5 w-3.5" /> 2/4 descargados
        </span>
      </div>

      <div className="space-y-3">
        {trucks.map((t, i) => (
          <div key={t.id} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-[12px] text-slate-300">{t.id}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${t.pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className={`h-full rounded-full ${t.done ? "bg-emerald-400" : "bg-sky-400"}`}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-[11px] text-slate-500">{t.dept}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 border-t border-white/5 pt-3 text-[11px] text-slate-500">
        Tiempos de almacén registrados · listos para informe logístico
      </p>
    </AppWindow>
  );
}
