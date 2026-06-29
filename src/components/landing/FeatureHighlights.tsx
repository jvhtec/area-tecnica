import { motion } from "framer-motion";
import { CheckCircle2, RefreshCw, ShieldCheck, Smartphone, Sparkles, Zap } from "lucide-react";
import { GLASS, GRADIENT_TEXT, useRevealVariants } from "./_shared";
import { SectionHeading } from "./SectionHeading";
import { StaffingMock } from "./visuals/StaffingMock";
import { PesosMock } from "./visuals/PesosMock";

const showcase = [
  {
    visual: PesosMock,
    eyebrow: "Herramientas técnicas",
    title: "Cálculos de ingeniería, no estimaciones",
    points: [
      "Pesos y rigging con puntos de carga y motores",
      "Consumos de potencia por fase con reequilibrado",
      "Tablas de RF / IEM sin solapamientos",
      "Todo exportable a informe firmable en PDF",
    ],
  },
  {
    visual: StaffingMock,
    eyebrow: "Staffing",
    title: "El crew correcto, propuesto en segundos",
    points: [
      "Rankeo por distancia, fiabilidad y disponibilidad",
      "Invitaciones automáticas y respuesta con un clic",
      "Tarifas personalizadas por técnico, gira o trabajo",
      "Detección de dobles reservas en la matriz",
    ],
    reverse: true,
  },
];

const capabilities = [
  {
    icon: RefreshCw,
    title: "Tiempo real multi-pestaña",
    description: "Elección de líder y sincronización entre pestañas: sin llamadas duplicadas ni datos obsoletos.",
  },
  {
    icon: Smartphone,
    title: "PWA móvil + push",
    description: "Instálala como app en iOS y Android (Capacitor) con notificaciones push nativas y web.",
  },
  {
    icon: ShieldCheck,
    title: "Seguridad por defecto",
    description: "Row Level Security, roles por departamento, rate limiting y validación de subidas.",
  },
  {
    icon: Zap,
    title: "Rápida de verdad",
    description: "Code-splitting, vistas materializadas y scroll virtual para datasets enormes.",
  },
  {
    icon: Sparkles,
    title: "Pensada para Madrid",
    description: "Zona horaria Europe/Madrid y festivos aplicados a las nóminas automáticamente.",
  },
  {
    icon: CheckCircle2,
    title: "Motor de PDF propio",
    description: "Más de 50 documentos: memorias, riders, day sheets, informes de incidencias y payouts.",
  },
];

export const FeatureHighlights = () => {
  const { container, item } = useRevealVariants();

  return (
    <section id="caracteristicas" className="relative px-6 py-24 scroll-mt-20">
      <div className="mx-auto max-w-6xl space-y-24">
        {showcase.map((row) => (
          <div
            key={row.title}
            className={`grid items-center gap-10 lg:grid-cols-2 ${row.reverse ? "lg:[&>*:first-child]:order-2" : ""}`}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-sky-500/20 via-violet-500/15 to-cyan-400/15 blur-2xl" />
              <row.visual />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-sky-300/90">
                {row.eyebrow}
              </span>
              <h3 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{row.title}</h3>
              <ul className="mt-6 space-y-3">
                {row.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        ))}

        <div>
          <SectionHeading
            eyebrow="Construida para producción"
            title="No solo bonita."
            highlight="Sólida."
            lead="Las decisiones de arquitectura están al servicio de quien está a pie de escenario con el reloj en contra."
          />
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {capabilities.map(({ icon: Icon, title, description }) => (
              <motion.div key={title} variants={item} className={`${GLASS} p-6`}>
                <Icon className="h-6 w-6 text-sky-400" />
                <h4 className="mt-4 font-semibold text-white">{title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
              </motion.div>
            ))}
          </motion.div>
          <p className="mt-10 text-center text-sm text-slate-500">
            Stack: React 18 · TypeScript · Supabase · TanStack Query ·{" "}
            <span className={GRADIENT_TEXT}>Cloudflare</span>
          </p>
        </div>
      </div>
    </section>
  );
};

export default FeatureHighlights;
