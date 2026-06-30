import { motion, useReducedMotion } from "framer-motion";

// Real documents the PDF engine produces — a kinetic reminder of the breadth.
const docs = [
  "Memoria técnica · Sonido",
  "Memoria técnica · Luces",
  "Memoria técnica · Vídeo",
  "Rider técnico",
  "Hoja de ruta",
  "Day sheet",
  "Tour book",
  "Plan de RF / IEM",
  "Lista de pesos",
  "Stage plot",
  "Informe de incidencias",
  "Informe logístico",
  "Carta de porte",
  "Payout · quincena",
  "Crew call",
  "Patch list",
];

function Row({ items, reverse, duration }: { items: string[]; reverse?: boolean; duration: number }) {
  const reduce = useReducedMotion();
  const doubled = [...items, ...items];
  return (
    <div className="flex overflow-hidden">
      <motion.div
        className="flex shrink-0 gap-3 pr-3"
        animate={reduce ? undefined : { x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={reduce ? undefined : { duration, repeat: Infinity, ease: "linear" }}
      >
        {doubled.map((d, i) => (
          <span
            key={`${d}-${i}`}
            className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 font-mono text-[12px] text-slate-400"
          >
            {d}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export function DocTicker() {
  const half = Math.ceil(docs.length / 2);
  return (
    <section className="relative overflow-hidden py-12">
      <div className="mx-auto mb-6 max-w-6xl px-6">
        <p className="text-center font-mono text-[11px] uppercase tracking-widest text-slate-500">
          Un motor de PDF · 50+ documentos firmables
        </p>
      </div>
      <div
        className="space-y-3"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <Row items={docs.slice(0, half)} duration={36} />
        <Row items={docs.slice(half)} duration={42} reverse />
      </div>
    </section>
  );
}
