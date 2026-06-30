import { motion } from "framer-motion";
import { AppWindow } from "./AppWindow";

// Reflects the RF / IEM frequency-coordination table: channel, frequency,
// band and a clash check across wireless mics and in-ear monitors.
const channels = [
  { ch: "Vocal 1", mhz: "606.400", band: "38", kind: "MIC", ok: true },
  { ch: "Vocal 2", mhz: "608.150", band: "38", kind: "MIC", ok: true },
  { ch: "IEM Batería", mhz: "614.900", band: "38", kind: "IEM", ok: true },
  { ch: "IEM Bajo", mhz: "615.050", band: "38", kind: "IEM", ok: false },
  { ch: "Guitarra", mhz: "623.700", band: "39", kind: "MIC", ok: true },
];

export function RfMock() {
  return (
    <AppWindow url="sector-pro.work/rf-iem" title="Plan de frecuencias">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">UHF · Banda 38–39</p>
          <p className="text-[11px] text-slate-500">Mics inalámbricos + IEM</p>
        </div>
        <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 font-mono text-[11px] text-rose-300">
          1 conflicto
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10">
        <div className="grid grid-cols-[1.5fr_1fr_0.6fr_0.7fr] bg-white/[0.04] px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400">
          <span>Canal</span>
          <span className="text-right">MHz</span>
          <span className="text-center">Banda</span>
          <span className="text-right">Estado</span>
        </div>
        {channels.map((c, i) => (
          <motion.div
            key={c.ch}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            className={`grid grid-cols-[1.5fr_1fr_0.6fr_0.7fr] items-center border-t border-white/5 px-3 py-2 text-[12px] ${
              !c.ok ? "bg-rose-500/[0.07]" : ""
            }`}
          >
            <span className="flex items-center gap-1.5 text-slate-200">
              <span
                className={`rounded px-1 py-0.5 font-mono text-[9px] ${
                  c.kind === "IEM" ? "bg-violet-500/15 text-violet-300" : "bg-sky-500/15 text-sky-300"
                }`}
              >
                {c.kind}
              </span>
              {c.ch}
            </span>
            <span className="text-right font-mono text-slate-300">{c.mhz}</span>
            <span className="text-center font-mono text-slate-500">{c.band}</span>
            <span className={`text-right font-mono ${c.ok ? "text-emerald-300" : "text-rose-300"}`}>
              {c.ok ? "OK" : "✕ clash"}
            </span>
          </motion.div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-amber-300/90">
        ⚠ IEM Bajo a 150 kHz de IEM Batería — sube a 615.350 MHz
      </p>
    </AppWindow>
  );
}
