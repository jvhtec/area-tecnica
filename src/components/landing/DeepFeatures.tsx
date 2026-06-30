import { motion } from "framer-motion";
import {
  Bell,
  FolderSync,
  GitCompareArrows,
  Music,
  Route,
  Share2,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { useRevealVariants } from "./_shared";

const highlights = [
  {
    icon: Bell,
    title: "Notificaciones push",
    description:
      "Avisos en tiempo real en iOS, Android y web — asignaciones, cambios de turno, documentos nuevos y mensajes — sin tener que abrir la app.",
  },
  {
    icon: Share2,
    title: "Documentos de trabajo",
    description:
      "Sube y comparte documentos por trabajo: internos para el equipo o directos al crew asignado. Riders, planos, permisos y hojas de ruta, siempre donde toca.",
  },
];

const deep = [
  {
    icon: FolderSync,
    title: "Integración Flex",
    color: "text-violet-300",
    points: [
      "Jerarquía de carpetas Tour → Fecha → Depto automática",
      "Work orders y elementos de trabajo",
      "Crew calls sincronizadas con las asignaciones",
      "Cambios de estado y archivado a Flex",
    ],
  },
  {
    icon: Music,
    title: "Festivales",
    color: "text-fuchsia-300",
    points: [
      "Artistas, riders y formulario público sin cuenta",
      "Configuración de gear multi-escenario",
      "Comparación de gear en tiempo real: pedido vs disponible",
      "Stage plots, input lists y memorias técnicas",
    ],
    badgeIcon: GitCompareArrows,
    badge: "Gear comparison",
  },
  {
    icon: Route,
    title: "Hoja de ruta & Tour OPS",
    color: "text-sky-300",
    points: [
      "Constructor de hojas de ruta: paradas, hoteles y travel",
      "Plantillas reutilizables y export a PDF",
      "Tour-ops hub: scheduling, day sheets y tour book",
      "Logística de gira de principio a fin",
    ],
  },
];

export function DeepFeatures() {
  const { container, item } = useRevealVariants();

  return (
    <section id="profundidad" className="relative px-6 py-24 scroll-mt-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="En profundidad"
          title="Donde otras apps se quedan"
          highlight="en la superficie"
          lead="No es solo planificar. Es comunicar, documentar y ejecutar — con la profundidad que pide una producción de verdad."
        />

        {/* top highlights */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-14 grid gap-4 md:grid-cols-2"
        >
          {highlights.map(({ icon: Icon, title, description }) => (
            <motion.div
              key={title}
              variants={item}
              className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 text-sky-300">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* deep blocks */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-4 grid gap-4 lg:grid-cols-3"
        >
          {deep.map(({ icon: Icon, title, color, points, badge, badgeIcon: BadgeIcon }) => (
            <motion.div
              key={title}
              variants={item}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5">
                  <Icon className={`h-5 w-5 ${color}`} strokeWidth={1.7} />
                  <h3 className="text-[15px] font-semibold text-white">{title}</h3>
                </span>
                {badge && BadgeIcon && (
                  <span className="flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-emerald-300">
                    <BadgeIcon className="h-3 w-3" />
                    {badge}
                  </span>
                )}
              </div>
              <ul className="mt-4 space-y-2.5">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[13px] leading-snug text-slate-300">
                    <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current ${color}`} />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
