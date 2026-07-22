import { motion } from "framer-motion";
import { ArrowRight, Mail, MapPin, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BRAND, GRADIENT_BTN, GRADIENT_TEXT } from "./_shared";

export const CallToAction = () => {
  const navigate = useNavigate();

  return (
    <section className="relative px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-8 py-16 text-center backdrop-blur-sm sm:px-16"
        >
          {/* glow */}
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-sky-500/30 via-violet-500/25 to-cyan-400/25 blur-3xl" />

          <span className="relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-sky-300" />
            Validada por profesionales en activo
          </span>

          <h2 className="relative mt-6 text-balance text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Profesionaliza tu <span className={GRADIENT_TEXT}>operación técnica</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-pretty text-lg text-slate-400">
            Deja atrás la dispersión de hojas de cálculo, correos y mensajes. Centraliza
            planificación, comunicación y ejecución en una sola plataforma.
          </p>

          <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className={`group h-12 px-8 text-base font-semibold text-white shadow-lg shadow-violet-600/25 ${GRADIENT_BTN}`}
            >
              Entrar a la plataforma
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/15 bg-white/5 px-8 text-base font-semibold text-white hover:bg-white/10 hover:text-white"
            >
              <a href={`mailto:${BRAND.email}`}>
                <Mail className="mr-2 h-4 w-4" />
                Solicitar acceso
              </a>
            </Button>
          </div>

          <div className="relative mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-400">
            <a href={`mailto:${BRAND.email}`} className="inline-flex items-center gap-2 hover:text-white">
              <Mail className="h-4 w-4 text-sky-400" />
              {BRAND.email}
            </a>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-sky-400" />
              Madrid, España
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CallToAction;
