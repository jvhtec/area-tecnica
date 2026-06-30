import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, PlayCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GRADIENT_BTN, GRADIENT_TEXT } from "./_shared";
import { MatrixMock } from "./visuals/MatrixMock";

const trustBadges = [
  { icon: Zap, label: "Tiempo real" },
  { icon: ShieldCheck, label: "RLS + roles" },
  { icon: Sparkles, label: "PWA móvil" },
];

export const HeroSection = () => {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-12 sm:pt-20">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center lg:text-left"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
            </span>
            La plataforma técnica para producción de directo
          </span>

          <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Toda tu operación{" "}
            <span className={GRADIENT_TEXT}>técnica</span>, en un solo lugar.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-slate-400 lg:mx-0">
            Festivales, giras, staffing, logística y documentación técnica unificados en
            una PWA móvil. Menos hojas de cálculo y correos sueltos. Más show.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className={`group h-12 px-7 text-base font-semibold text-white shadow-lg shadow-violet-600/25 ${GRADIENT_BTN}`}
            >
              Entrar a la plataforma
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                document.getElementById("modulos")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="h-12 border-white/15 bg-white/5 px-7 text-base font-semibold text-white hover:bg-white/10 hover:text-white"
            >
              <PlayCircle className="mr-1 h-4 w-4" />
              Ver módulos
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
            {trustBadges.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-2 text-sm text-slate-400">
                <Icon className="h-4 w-4 text-sky-400" />
                {label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-xl"
        >
          {/* glow */}
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-sky-500/30 via-violet-500/20 to-cyan-400/20 blur-3xl" />
          <div style={reduce ? undefined : { transform: "perspective(1600px) rotateY(-6deg) rotateX(2deg)" }}>
            <MatrixMock live />
          </div>

          {/* floating chip */}
          {!reduce && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 shadow-xl backdrop-blur sm:flex"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <Zap className="h-5 w-5" />
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Sincronización en vivo</p>
                <p className="text-xs text-slate-400">multi-pestaña · multi-dispositivo</p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
