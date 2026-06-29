import { motion } from "framer-motion";
import { ArrowRight, CalendarCheck, Clock, ReceiptText, Users } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const flow = [
  {
    icon: Users,
    title: "Asignas el crew",
    description: "Desde la matriz o el motor de staffing, por trabajo o por gira completa.",
  },
  {
    icon: CalendarCheck,
    title: "Se crean los trabajos",
    description: "La asignación a gira cascadea a cada fecha y genera los partes automáticamente.",
  },
  {
    icon: Clock,
    title: "Se fichan las horas",
    description: "Horas extra, nocturnidad y festivos se calculan en servidor, con tus tarifas.",
  },
  {
    icon: ReceiptText,
    title: "Sale la nómina",
    description: "Payouts por quincena listos para revisar y exportar, sin recalcular a mano.",
  },
];

export const TechnicalSpecs = () => {
  return (
    <section className="relative px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Un único hilo de datos"
          title="Lo introduces una vez."
          highlight="Fluye solo."
          lead="El problema nunca fue tener herramientas, sino que no se hablaban entre ellas. Aquí cada paso alimenta al siguiente."
        />

        <div className="mt-16 flex flex-col gap-4 lg:flex-row lg:items-stretch">
          {flow.map(({ icon: Icon, title, description }, i) => (
            <div key={title} className="flex flex-col gap-4 lg:flex-1 lg:flex-row lg:items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative flex flex-1 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm"
              >
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 text-sky-300">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-slate-500">Paso {i + 1}</span>
                <h3 className="mt-1 text-base font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
              </motion.div>
              {i < flow.length - 1 && (
                <ArrowRight className="mx-auto h-5 w-5 shrink-0 rotate-90 text-slate-600 lg:rotate-0" aria-hidden />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TechnicalSpecs;
