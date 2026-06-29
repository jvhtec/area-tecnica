import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { AppWindow } from "./AppWindow";

const phases = [
  { name: "L1", amps: 58, pct: 92 },
  { name: "L2", amps: 47, pct: 75 },
  { name: "L3", amps: 51, pct: 81 },
];

const lines = [
  { label: "PA · L-Acoustics K2", kw: 18.4 },
  { label: "Backline + monitores", kw: 9.7 },
  { label: "Luces · cabezas móviles", kw: 12.1 },
  { label: "Vídeo · LED + control", kw: 6.3 },
];

export function PowerMock() {
  return (
    <AppWindow url="sector-pro.work/herramientas/consumos" title="Consumos de potencia">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Escenario Principal</p>
          <p className="text-[11px] text-slate-500">Trifásico · 400 V</p>
        </div>
        <div className="text-right">
          <p className="flex items-center gap-1 text-lg font-bold text-white">
            <Zap className="h-4 w-4 text-amber-400" /> 46,5 kW
          </p>
          <p className="text-[11px] text-slate-500">pico estimado</p>
        </div>
      </div>

      {/* phase balance bars */}
      <div className="space-y-2.5">
        {phases.map((p, i) => (
          <div key={p.name} className="flex items-center gap-3">
            <span className="w-6 text-[11px] font-semibold text-slate-400">{p.name}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${p.pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: 0.1 * i, ease: [0.22, 1, 0.36, 1] }}
                className={`h-full rounded-full ${
                  p.pct > 90
                    ? "bg-gradient-to-r from-amber-400 to-rose-400"
                    : "bg-gradient-to-r from-sky-400 to-emerald-400"
                }`}
              />
            </div>
            <span className="w-12 text-right text-[11px] tabular-nums text-slate-300">{p.amps} A</span>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-amber-300/90">⚠ L1 al 92 % — reequilibra fases antes del show</p>

      {/* breakdown */}
      <div className="mt-4 space-y-1.5 border-t border-white/5 pt-3">
        {lines.map((l) => (
          <div key={l.label} className="flex items-center justify-between text-[12px]">
            <span className="truncate text-slate-400">{l.label}</span>
            <span className="tabular-nums text-slate-300">{l.kw.toLocaleString("es-ES")} kW</span>
          </div>
        ))}
      </div>
    </AppWindow>
  );
}
