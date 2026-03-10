import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { ModuleShowcase } from "@/components/landing/ModuleShowcase";
import { FeatureHighlights } from "@/components/landing/FeatureHighlights";
import { TechnicalSpecs } from "@/components/landing/TechnicalSpecs";
import { CallToAction } from "@/components/landing/CallToAction";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <StatsSection />
      <ModuleShowcase />
      <FeatureHighlights />
      <TechnicalSpecs />
      <CallToAction />
    </div>
  );
}