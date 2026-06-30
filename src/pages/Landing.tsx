import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShowControlBar } from "@/components/landing/ShowControlBar";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { ShowDayTimeline } from "@/components/landing/ShowDayTimeline";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { DocTicker } from "@/components/landing/DocTicker";
import { PlatformMap } from "@/components/landing/PlatformMap";
import { FeatureHighlights } from "@/components/landing/FeatureHighlights";
import { IntegrationsSection } from "@/components/landing/IntegrationsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { CallToAction } from "@/components/landing/CallToAction";
import { BRAND, GRADIENT_BTN } from "@/components/landing/_shared";

/**
 * Flat, disciplined technical backdrop: a near-black surface with a single fine
 * engineering grid masked toward the top and a faint neutral highlight. No
 * colored blur blobs — deliberately avoids the "aurora" look.
 */
function TechBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#070910]">
      {/* faint neutral top highlight (no color cast) */}
      <div
        className="absolute inset-x-0 top-0 h-[40rem]"
        style={{
          background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(255,255,255,0.035), transparent 70%)",
        }}
      />
      {/* fine engineering grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 85% 60% at 50% -5%, black 25%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 85% 60% at 50% -5%, black 25%, transparent 70%)",
        }}
      />
    </div>
  );
}

const navLinks = [
  { label: "Producto", href: "producto" },
  { label: "Plataforma", href: "modulos" },
  { label: "Integraciones", href: "integraciones" },
  { label: "Precios", href: "precios" },
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
      className={`sticky top-8 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-white/10 bg-[#070910]/80 backdrop-blur-xl" : "border-b border-transparent"
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
    <div className="dark min-h-screen scroll-smooth bg-[#070910] text-slate-100 antialiased">
      <TechBackground />
      <ShowControlBar />
      <Navbar />
      <main>
        <HeroSection />
        <StatsSection />
        <ShowDayTimeline />
        <ProductShowcase />
        <DocTicker />
        <PlatformMap />
        <IntegrationsSection />
        <PricingSection />
        <FeatureHighlights />
        <TestimonialsSection />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
