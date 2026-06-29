import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { useRevealVariants } from "./_shared";

// NOTE: placeholder, role-attributed quotes — replace with real customer
// testimonials before launch.
const testimonials = [
  {
    quote:
      "Dejé de perseguir confirmaciones por WhatsApp. La matriz me dice de un vistazo quién falta en cada fecha.",
    role: "Jefe de producción",
    context: "Festival · 3 escenarios",
    initials: "JP",
  },
  {
    quote:
      "Los pesos y el plan de RF salen calculados y firmados antes de cargar el camión. Cero sorpresas en el rig.",
    role: "Técnico de sistemas",
    context: "Gira nacional",
    initials: "TS",
  },
  {
    quote:
      "Las nóminas de la quincena se cierran solas, con extras y festivos ya aplicados. Antes era un día entero de Excel.",
    role: "Coordinación",
    context: "Empresa de servicios técnicos",
    initials: "CO",
  },
];

export function TestimonialsSection() {
  const { container, item } = useRevealVariants();

  return (
    <section id="testimonios" className="relative px-6 py-24 scroll-mt-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-sm font-medium text-slate-300">4,9 / 5</span>
          </div>
          <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Validada a pie de escenario
          </h2>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">
            Construida con —y para— profesionales técnicos en activo de festivales, giras y eventos.
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-14 grid gap-4 md:grid-cols-3"
        >
          {testimonials.map((t) => (
            <motion.figure
              key={t.initials}
              variants={item}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6"
            >
              <Quote className="h-6 w-6 text-sky-400/70" />
              <blockquote className="mt-4 flex-1 text-pretty leading-relaxed text-slate-200">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-white/5 pt-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-slate-300 ring-1 ring-white/10">
                  {t.initials}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">{t.role}</span>
                  <span className="block truncate text-[12px] text-slate-500">{t.context}</span>
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
