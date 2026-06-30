import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CalendarRange, FileText, LayoutGrid, Radio } from "lucide-react";
import { GRADIENT_TEXT } from "./_shared";

const stats = [
  {
    icon: LayoutGrid,
    value: 12,
    suffix: "+",
    label: "Módulos especializados",
    description: "De festivales a giras, de sonido a logística",
  },
  {
    icon: Radio,
    value: 24,
    suffix: "/7",
    label: "Sincronización en tiempo real",
    description: "Colaboración en vivo entre departamentos",
  },
  {
    icon: FileText,
    value: 50,
    suffix: "+",
    label: "Informes PDF profesionales",
    description: "Memorias técnicas, riders, hojas de ruta y más",
  },
  {
    icon: CalendarRange,
    value: 6,
    suffix: "",
    label: "Departamentos integrados",
    description: "Sonido, luces, vídeo, logística, producción y admin",
  },
];

function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setValue(to);
      return;
    }
    const duration = 1200;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, reduce]);

  return (
    <span ref={ref} className={`text-4xl font-extrabold tracking-tight sm:text-5xl ${GRADIENT_TEXT}`}>
      {value}
      {suffix}
    </span>
  );
}

export const StatsSection = () => {
  return (
    <section className="relative px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(({ icon: Icon, value, suffix, label, description }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center backdrop-blur-sm transition-colors hover:border-white/20"
            >
              <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 text-sky-300">
                <Icon className="h-5 w-5" />
              </span>
              <Counter to={value} suffix={suffix} />
              <p className="mt-2 text-sm font-semibold text-white">{label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
