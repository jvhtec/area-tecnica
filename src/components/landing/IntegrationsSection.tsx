import { motion } from "framer-motion";
import {
  CalendarClock,
  FileSpreadsheet,
  Folder,
  Map,
  MapPin,
  MessageCircle,
  Navigation,
  Database,
  Bell,
  Smartphone,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { useRevealVariants } from "./_shared";

const featured = {
  name: "Flex Rental Solutions",
  tag: "ERP",
  icon: Folder,
  description:
    "Integración nativa: jerarquía de carpetas, work orders y crew calls sincronizados automáticamente con cada trabajo, fecha y departamento.",
};

const integrations = [
  { name: "Google Maps", tag: "Geocoding", icon: Navigation, color: "text-emerald-300" },
  { name: "Google Places", tag: "Hoteles · Restaurantes", icon: MapPin, color: "text-rose-300" },
  { name: "Mapbox", tag: "Mapas interactivos", icon: Map, color: "text-sky-300" },
  { name: "WhatsApp", tag: "Grupos de producción", icon: MessageCircle, color: "text-green-300" },
  { name: "Supabase", tag: "DB · Auth · Realtime", icon: Database, color: "text-emerald-300" },
  { name: "Web Push / APNs", tag: "Notificaciones", icon: Bell, color: "text-amber-300" },
  { name: "iOS · Android", tag: "Capacitor", icon: Smartphone, color: "text-violet-300" },
  { name: "Calendar (ICS)", tag: "Sincronización", icon: CalendarClock, color: "text-cyan-300" },
  { name: "Excel · PDF", tag: "Exportación", icon: FileSpreadsheet, color: "text-indigo-300" },
];

export function IntegrationsSection() {
  const { container, item } = useRevealVariants();

  return (
    <section id="integraciones" className="relative px-6 py-24 scroll-mt-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Conectada a tu stack"
          title="Habla con las herramientas que"
          highlight="ya usas"
          lead="Sector Pro no es una isla. Se integra con tu ERP, tus mapas, tu mensajería y tus calendarios para que los datos fluyan sin copiar y pegar."
        />

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-14 grid gap-4 lg:grid-cols-3"
        >
          {/* Featured: Flex */}
          <motion.div
            variants={item}
            className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-b from-sky-500/[0.08] to-transparent p-6 lg:row-span-2"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
              <featured.icon className="h-5 w-5" />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{featured.name}</h3>
              <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-sky-300">
                {featured.tag}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{featured.description}</p>
            <div className="mt-6 space-y-2">
              {["Carpetas Tour → Fecha → Depto", "Work orders automáticas", "Crew calls sincronizadas"].map((l) => (
                <div key={l} className="flex items-center gap-2 text-[12px] text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  {l}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Grid of the rest */}
          {integrations.map(({ name, tag, icon: Icon, color }) => (
            <motion.div
              key={name}
              variants={item}
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ${color}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{name}</p>
                <p className="truncate font-mono text-[10px] uppercase tracking-wide text-slate-500">{tag}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
