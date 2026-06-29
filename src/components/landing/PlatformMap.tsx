import { motion } from "framer-motion";
import {
  Boxes,
  CalendarDays,
  FileText,
  Megaphone,
  Music,
  Receipt,
  Settings2,
  UsersRound,
  Wrench,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { useRevealVariants } from "./_shared";

const domains = [
  {
    icon: Music,
    title: "Festivales",
    color: "text-fuchsia-300",
    items: [
      "Artistas y riders técnicos",
      "Gear multi-escenario con validación",
      "Stage plots e input lists",
      "Detección de colisiones de agenda",
      "Formulario público de artista",
    ],
  },
  {
    icon: CalendarDays,
    title: "Giras",
    color: "text-sky-300",
    items: [
      "Fechas, itinerarios y day sheets",
      "Hoteles, travel y logística",
      "Crew por show con cascada",
      "Tour defaults (potencia/peso)",
      "Tour book y tour-ops hub",
    ],
  },
  {
    icon: UsersRound,
    title: "Crew & Staffing",
    color: "text-emerald-300",
    items: [
      "Matriz de asignación",
      "Motor de staffing por campañas",
      "Disponibilidad y no-disponibilidad",
      "Rankings, logros y súper-app del técnico",
      "Conflictos de doble reserva",
    ],
  },
  {
    icon: Receipt,
    title: "Económico",
    color: "text-indigo-300",
    items: [
      "Fichajes: extra, nocturnidad, festivos",
      "Festivos de Madrid automáticos",
      "Tarifas personalizadas y centro de tarifas",
      "Payouts por quincena",
      "Gastos y aprobaciones",
    ],
  },
  {
    icon: Boxes,
    title: "Equipos & Logística",
    color: "text-teal-300",
    items: [
      "Catálogo e inventario unificado",
      "Presets de paquetes",
      "Movimientos de stock",
      "Subalquiler",
      "Load-in / load-out y almacén",
    ],
  },
  {
    icon: Wrench,
    title: "Herramientas técnicas",
    color: "text-lime-300",
    items: [
      "Consumos de potencia",
      "Pesos y rigging",
      "RF / IEM y coordinación de frecuencias",
      "SysCalc y SoundVision",
      "Por dpto: sonido · luces · vídeo",
    ],
  },
  {
    icon: FileText,
    title: "Documentación",
    color: "text-amber-300",
    items: [
      "Memorias técnicas (sonido/luces/vídeo)",
      "Riders y hojas de ruta",
      "Informes de incidencias",
      "Informes logísticos",
      "Motor de PDF · 50+ documentos",
    ],
  },
  {
    icon: Megaphone,
    title: "Comunicación",
    color: "text-rose-300",
    items: [
      "Mensajería interna y directa",
      "Anuncios y tareas globales",
      "Feed de actividad / auditoría",
      "Notificaciones push (web + nativas)",
      "Grupos de WhatsApp de producción",
    ],
  },
  {
    icon: Settings2,
    title: "Visualización & Sistema",
    color: "text-violet-300",
    items: [
      "Wallboard / señalización",
      "Stream Deck + atajos de teclado",
      "PWA iOS / Android",
      "Tiempo real multi-pestaña",
      "Roles, departamentos y RLS",
    ],
  },
];

export function PlatformMap() {
  const { container, item } = useRevealVariants();
  const totalItems = domains.reduce((a, d) => a + d.items.length, 0);

  return (
    <section id="modulos" className="relative px-6 py-24 scroll-mt-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="La plataforma completa"
          title="Una sola plataforma para"
          highlight="toda la operación"
          lead={`Nueve áreas, ${totalItems}+ capacidades conectadas. Lo que antes vivía en correos, hojas de cálculo y media docena de apps, aquí es un único sistema.`}
        />

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {domains.map(({ icon: Icon, title, color, items }) => (
            <motion.div
              key={title}
              variants={item}
              className="group rounded-xl border border-white/[0.08] bg-white/[0.015] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-5 w-5 ${color}`} strokeWidth={1.6} />
                <h3 className="text-[15px] font-semibold text-white">{title}</h3>
              </div>
              <ul className="mt-4 space-y-2">
                {items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-[13px] leading-snug text-slate-400">
                    <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current ${color}`} />
                    {it}
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
