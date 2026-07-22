import { motion } from "framer-motion";
import { CheckCircle2, RefreshCw, ShieldCheck, Smartphone, Sparkles, Zap } from "lucide-react";
import { GLASS, GRADIENT_TEXT, useRevealVariants } from "./_shared";
import { SectionHeading } from "./SectionHeading";

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
      <div className="mx-auto max-w-6xl">
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
    </section>
  );
};

export default FeatureHighlights;
