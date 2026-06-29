import { motion } from "framer-motion";
import {
  Boxes,
  CalendarDays,
  FileText,
  Gauge,
  Grid3x3,
  MapPinned,
  Megaphone,
  Music,
  Plug,
  Truck,
  UsersRound,
  Wand2,
} from "lucide-react";
import { useRevealVariants } from "./_shared";
import { SectionHeading } from "./SectionHeading";

type Module = {
  icon: typeof Music;
  title: string;
  description: string;
  span?: string;
  accent: string;
};

const modules: Module[] = [
  {
    icon: Music,
    title: "Festivales",
    description:
      "Artistas, riders técnicos, configuración de escenarios y detección de colisiones. Formulario público para que el artista envíe sus necesidades sin cuenta.",
    span: "lg:col-span-2",
    accent: "from-fuchsia-500/20 to-violet-500/10 text-fuchsia-300",
  },
  {
    icon: CalendarDays,
    title: "Giras",
    description:
      "Fechas, itinerarios, hoteles, travel y asignación de crew por show con cascada automática a cada fecha.",
    accent: "from-sky-500/20 to-cyan-500/10 text-sky-300",
  },
  {
    icon: Grid3x3,
    title: "Matriz de asignación",
    description:
      "Técnicos × trabajos en una vista multi-departamento, con detección de dobles reservas y operaciones por lotes.",
    accent: "from-emerald-500/20 to-teal-500/10 text-emerald-300",
  },
  {
    icon: Wand2,
    title: "Motor de Staffing",
    description:
      "Campañas que rankean candidatos por distancia, fiabilidad y disponibilidad, lanzan invitaciones y procesan respuestas automáticamente.",
    span: "lg:col-span-2",
    accent: "from-amber-500/20 to-orange-500/10 text-amber-300",
  },
  {
    icon: FileText,
    title: "Fichajes y nóminas",
    description:
      "Partes de horas con horas extra, nocturnidad y festivos calculados en servidor. Tarifas personalizadas por técnico, gira o trabajo.",
    accent: "from-indigo-500/20 to-blue-500/10 text-indigo-300",
  },
  {
    icon: Truck,
    title: "Logística y almacén",
    description:
      "Load-in / load-out, control de tiempos, movimientos de stock y solicitudes de subalquiler.",
    accent: "from-rose-500/20 to-red-500/10 text-rose-300",
  },
  {
    icon: MapPinned,
    title: "Hoja de ruta",
    description:
      "Constructor de hojas de ruta con paradas, imágenes y plantillas reutilizables, exportables a PDF corporativo.",
    accent: "from-cyan-500/20 to-sky-500/10 text-cyan-300",
  },
  {
    icon: Gauge,
    title: "Herramientas técnicas",
    description:
      "Cálculo de consumos de potencia, pesos/rigging y tablas de RF/IEM, con exportación a informe.",
    accent: "from-lime-500/20 to-green-500/10 text-lime-300",
  },
  {
    icon: Plug,
    title: "Integración Flex",
    description:
      "Sincronización nativa con Flex Rental Solutions: jerarquía de carpetas, work orders y crew calls.",
    accent: "from-violet-500/20 to-purple-500/10 text-violet-300",
  },
  {
    icon: Boxes,
    title: "Equipos e inventario",
    description: "Catálogo unificado, presets de paquetes y disponibilidad calculada con asignaciones.",
    accent: "from-teal-500/20 to-emerald-500/10 text-teal-300",
  },
  {
    icon: Megaphone,
    title: "Wallboard",
    description: "Pantallas en tiempo real para crew y anuncios, con acceso público por token.",
    accent: "from-orange-500/20 to-amber-500/10 text-orange-300",
  },
  {
    icon: UsersRound,
    title: "Mensajería y actividad",
    description: "Mensajes internos, anuncios y feed de auditoría con notificaciones push.",
    accent: "from-blue-500/20 to-indigo-500/10 text-blue-300",
  },
];

export const ModuleShowcase = () => {
  const { container, item } = useRevealVariants();

  return (
    <section id="modulos" className="relative px-6 py-24 scroll-mt-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Una plataforma, todos los flujos"
          title="Doce módulos que sustituyen"
          highlight="diez herramientas sueltas"
          lead="Cada equipo trabaja en su módulo y todo queda conectado: la asignación alimenta los fichajes, los fichajes alimentan las nóminas, y todo se sincroniza en tiempo real."
        />

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-14 grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {modules.map(({ icon: Icon, title, description, span, accent }) => (
            <motion.article
              key={title}
              variants={item}
              className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06] ${span ?? ""}`}
            >
              <div
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-white/10 to-transparent opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default ModuleShowcase;
