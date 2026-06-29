import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { ModuleShowcase } from "@/components/landing/ModuleShowcase";
import { FeatureHighlights } from "@/components/landing/FeatureHighlights";
import { TechnicalSpecs } from "@/components/landing/TechnicalSpecs";
import { CallToAction } from "@/components/landing/CallToAction";
import { BRAND, GRADIENT_BTN } from "@/components/landing/_shared";

/** Animated brand aurora + grid backdrop for the dark landing canvas. */
function Aurora() {
  const reduce = useReducedMotion();
  const float = (delay: number) =>
    reduce
      ? {}
      : {
          animate: { x: [0, 30, -20, 0], y: [0, -25, 20, 0], scale: [1, 1.08, 0.96, 1] },
          transition: { duration: 22, repeat: Infinity, ease: "easeInOut", delay },
        };

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#060A18]">
      <motion.div
        {...float(0)}
        className="absolute -left-32 -top-32 h-[36rem] w-[36rem] rounded-full bg-sky-600/20 blur-[120px]"
      />
      <motion.div
        {...float(4)}
        className="absolute -right-40 top-1/4 h-[34rem] w-[34rem] rounded-full bg-violet-600/20 blur-[120px]"
      />
      <motion.div
        {...float(8)}
        className="absolute bottom-0 left-1/3 h-[32rem] w-[32rem] rounded-full bg-cyan-500/15 blur-[120px]"
      />
      {/* grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
        }}
      />
    </div>
  );
}

const navLinks = [
  { label: "Módulos", href: "modulos" },
  { label: "Características", href: "caracteristicas" },
];

function Navbar() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-white/10 bg-[#060A18]/80 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/landing" className="flex items-center gap-2.5">
          <img src={BRAND.logo} alt={BRAND.name} className="h-7 w-auto brightness-0 invert" />
          <span className="hidden text-sm font-semibold tracking-tight text-white sm:block">
            {BRAND.name} <span className="text-slate-500">· {BRAND.tagline}</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <button
              key={l.href}
              onClick={() => document.getElementById(l.href)?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              {l.label}
            </button>
          ))}
        </div>

        <Button
          onClick={() => navigate("/auth")}
          className={`h-9 px-5 text-sm font-semibold text-white ${GRADIENT_BTN}`}
        >
          Entrar
        </Button>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-white/10 px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-2.5">
          <img src={BRAND.logo} alt={BRAND.name} className="h-6 w-auto opacity-70 brightness-0 invert" />
          <span className="text-sm font-medium text-slate-400">
            {BRAND.name} · {BRAND.tagline}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-500">
          <Link to="/privacy" className="hover:text-slate-300">
            Privacidad
          </Link>
          <a href={`mailto:${BRAND.email}`} className="hover:text-slate-300">
            Contacto
          </a>
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-6xl text-center text-xs text-slate-600 sm:text-left">
        Hecho para profesionales técnicos de directo, por profesionales técnicos de directo.
      </p>
    </footer>
  );
}

export default function Landing() {
  useEffect(() => {
    const prev = document.title;
    document.title = `${BRAND.name} · ${BRAND.tagline}`;
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="dark min-h-screen scroll-smooth bg-[#060A18] text-slate-100 antialiased">
      <Aurora />
      <Navbar />
      <main>
        <HeroSection />
        <StatsSection />
        <ModuleShowcase />
        <FeatureHighlights />
        <TechnicalSpecs />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
