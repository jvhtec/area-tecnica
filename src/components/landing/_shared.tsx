import { useReducedMotion, type Variants } from "framer-motion";

/**
 * Shared design language for the marketing landing page.
 *
 * The landing is a self-contained cinematic surface that does not follow the
 * in-app light/dark theme — it is always rendered on a dark canvas so the brand
 * gradient (sky -> violet -> cyan) reads consistently regardless of the user's
 * app theme preference.
 */

export const BRAND = {
  name: "Sector Pro",
  tagline: "Área Técnica",
  logo: "/sector%20pro%20logo.png",
  email: "hola@sector-pro.work",
  domain: "sector-pro.work",
} as const;

/** sky -> violet -> cyan gradient text. */
export const GRADIENT_TEXT =
  "bg-gradient-to-r from-sky-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent";

/** Primary brand button background. */
export const GRADIENT_BTN =
  "bg-gradient-to-r from-sky-500 to-violet-600 hover:from-sky-400 hover:to-violet-500";

/** Glass card surface used across sections. */
export const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm";

/** Scroll-reveal container that staggers its children. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

/** Scroll-reveal item: fade + rise. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

/** Respect prefers-reduced-motion: collapse transforms to a simple fade. */
export function useRevealVariants() {
  const reduce = useReducedMotion();
  if (!reduce) return { container: staggerContainer, item: fadeUp };
  const item: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.3 } },
  };
  return { container: staggerContainer, item };
}
