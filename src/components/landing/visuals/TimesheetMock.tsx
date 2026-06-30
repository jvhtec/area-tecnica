import { motion } from "framer-motion";
import { AppWindow } from "./AppWindow";

// Reflects the real payouts-by-fortnight view: per-technician hours with
// overtime / night / holiday breakdown computed server-side, and a euro total.
const rows = [
  { name: "Javier Ruiz", h: 38, ot: 6, status: "ok", eur: 1240 },
  { name: "Marta León", h: 32, ot: 2, status: "ok", eur: 980 },
  { name: "Carlos Vidal", h: 41, ot: 9, status: "pend", eur: 1410 },
  { name: "Ana Soto", h: 28, ot: 0, status: "ok", eur: 760 },
];
const total = rows.reduce((a, r) => a + r.eur, 0);
const eur = (n: number) => n.toLocaleString("es-ES");

export function TimesheetMock() {
  return (
    <AppWindow url="sector-pro.work/payouts" title="Payouts · quincena" badge="Módulo">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">2ª quincena · Junio</p>
          <p className="text-[11px] text-slate-500">Horas extra · nocturnidad · festivos Madrid</p>
        </div>
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[11px] text-emerald-300">
          {eur(total)} €
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10">
        <div className="grid grid-cols-[1.6fr_repeat(3,1fr)] bg-white/[0.04] px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400">
          <span>Técnico</span>
          <span className="text-right">Horas</span>
          <span className="text-right">Extra</span>
          <span className="text-right">Importe</span>
        </div>
        {rows.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            className="grid grid-cols-[1.6fr_repeat(3,1fr)] items-center border-t border-white/5 px-3 py-2 text-[12px]"
          >
            <span className="flex items-center gap-2 text-slate-200">
              {r.name}
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                  r.status === "ok"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-amber-500/15 text-amber-300"
                }`}
              >
                {r.status === "ok" ? "Aprobado" : "Pendiente"}
              </span>
            </span>
            <span className="text-right font-mono text-slate-400">{r.h} h</span>
            <span className="text-right font-mono text-amber-300/90">+{r.ot} h</span>
            <span className="text-right font-mono text-slate-200">{eur(r.eur)} €</span>
          </motion.div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        Calculado por <span className="font-mono text-slate-400">compute_timesheet_hours()</span> · listo para exportar
      </p>
    </AppWindow>
  );
}
