import { motion } from "framer-motion";
import { AppWindow } from "./AppWindow";

// Mirrors the real Pesos (rigging weights) tool table:
// columns Quantity · Component · Weight (per unit) · Total Weight,
// a bold Total Weight footer row, plus the Rigging Points line.
const rows = [
  { qty: 12, name: "L-Acoustics K2", unit: 56, total: 672 },
  { qty: 4, name: "K2 Bumper", unit: 70, total: 280 },
  { qty: 8, name: "KS28 Sub", unit: 79, total: 632 },
  { qty: 1, name: "Motor 2T + cadena", unit: 95, total: 95 },
];
const totalWeight = rows.reduce((a, r) => a + r.total, 0) + 48; // + cable pick
const kg = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PesosMock() {
  return (
    <AppWindow url="sector-pro.work/herramientas/pesos" title="Pesos y rigging">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Main Hang · L/R</p>
          <p className="text-[11px] text-slate-500">Cable Pick (48 kg) · 2 motores</p>
        </div>
        <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 font-mono text-[11px] text-sky-300">
          PA · Sonido
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-left">
          <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Component</th>
              <th className="px-3 py-2 text-right font-medium">Weight</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="text-[12px]">
            {rows.map((r, i) => (
              <motion.tr
                key={r.name}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className="border-t border-white/5"
              >
                <td className="px-3 py-2 font-mono text-slate-400">{r.qty}</td>
                <td className="px-3 py-2 text-slate-200">{r.name}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">{r.unit} kg</td>
                <td className="px-3 py-2 text-right font-mono text-slate-200">{kg(r.total)} kg</td>
              </motion.tr>
            ))}
            <tr className="border-t border-white/10 bg-white/[0.04] font-semibold">
              <td colSpan={3} className="px-3 py-2 text-right text-slate-300">
                Total Weight:
              </td>
              <td className="px-3 py-2 text-right font-mono text-white">{kg(totalWeight)} kg</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-md border border-sky-500/20 bg-sky-500/[0.07] px-3 py-2 text-[11px] text-sky-300">
        <strong className="font-semibold">Rigging Points:</strong> 2 × motor 2T · carga equilibrada L/R
      </div>
    </AppWindow>
  );
}
