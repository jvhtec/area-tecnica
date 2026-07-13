/**
 * Accent tokens for the bold mobile visual language.
 *
 * Every department (and the cross-department dashboard) gets a hue that drives
 * the hero-header glow, week-strip selection, tool-tile icon chips and primary
 * CTAs, so each hub is recognizable at a glance. Tailwind cannot build class
 * names dynamically, so each accent enumerates complete class strings.
 */

export type MobileAccentKey =
  | "sound"
  | "lights"
  | "video"
  | "production"
  | "logistics"
  | "administrative"
  | "default";

export interface MobileAccentTokens {
  /** Kicker/eyebrow text over the dark hero. */
  kicker: string;
  /** Primary glow blob inside the hero header. */
  glowA: string;
  /** Secondary glow blob inside the hero header. */
  glowB: string;
  /** Filled gradient surface (selected day, primary CTA). */
  fill: string;
  /** Ring/halo used to mark "today" in the week strip. */
  todayRing: string;
  /** Icon chip background inside tiles. */
  chipBg: string;
  /** Icon color inside tiles. */
  chipText: string;
  /** Thin progress bar fill (staffing meter). */
  meter: string;
}

const ACCENTS: Record<MobileAccentKey, MobileAccentTokens> = {
  sound: {
    kicker: "text-sky-300",
    glowA: "bg-sky-500/40",
    glowB: "bg-blue-600/30",
    fill: "bg-gradient-to-br from-sky-500 to-blue-600 text-white",
    todayRing: "ring-sky-500/70 text-sky-600 dark:text-sky-400",
    chipBg: "bg-sky-500/15",
    chipText: "text-sky-600 dark:text-sky-400",
    meter: "bg-sky-500",
  },
  lights: {
    kicker: "text-amber-300",
    glowA: "bg-amber-500/40",
    glowB: "bg-orange-600/30",
    fill: "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
    todayRing: "ring-amber-500/70 text-amber-600 dark:text-amber-400",
    chipBg: "bg-amber-500/15",
    chipText: "text-amber-600 dark:text-amber-400",
    meter: "bg-amber-500",
  },
  video: {
    kicker: "text-violet-300",
    glowA: "bg-violet-500/40",
    glowB: "bg-fuchsia-600/30",
    fill: "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white",
    todayRing: "ring-violet-500/70 text-violet-600 dark:text-violet-400",
    chipBg: "bg-violet-500/15",
    chipText: "text-violet-600 dark:text-violet-400",
    meter: "bg-violet-500",
  },
  production: {
    kicker: "text-emerald-300",
    glowA: "bg-emerald-500/40",
    glowB: "bg-teal-600/30",
    fill: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
    todayRing: "ring-emerald-500/70 text-emerald-600 dark:text-emerald-400",
    chipBg: "bg-emerald-500/15",
    chipText: "text-emerald-600 dark:text-emerald-400",
    meter: "bg-emerald-500",
  },
  logistics: {
    kicker: "text-orange-300",
    glowA: "bg-orange-500/40",
    glowB: "bg-red-600/30",
    fill: "bg-gradient-to-br from-orange-500 to-red-600 text-white",
    todayRing: "ring-orange-500/70 text-orange-600 dark:text-orange-400",
    chipBg: "bg-orange-500/15",
    chipText: "text-orange-600 dark:text-orange-400",
    meter: "bg-orange-500",
  },
  administrative: {
    kicker: "text-slate-300",
    glowA: "bg-slate-500/40",
    glowB: "bg-slate-600/30",
    fill: "bg-gradient-to-br from-slate-500 to-slate-700 text-white",
    todayRing: "ring-slate-500/70 text-slate-600 dark:text-slate-400",
    chipBg: "bg-slate-500/15",
    chipText: "text-slate-600 dark:text-slate-400",
    meter: "bg-slate-500",
  },
  default: {
    kicker: "text-indigo-300",
    glowA: "bg-indigo-500/40",
    glowB: "bg-purple-600/30",
    fill: "bg-gradient-to-br from-indigo-500 to-purple-600 text-white",
    todayRing: "ring-indigo-500/70 text-indigo-600 dark:text-indigo-400",
    chipBg: "bg-indigo-500/15",
    chipText: "text-indigo-600 dark:text-indigo-400",
    meter: "bg-indigo-500",
  },
};

export function getMobileAccent(key?: string | null): MobileAccentTokens {
  return ACCENTS[(key as MobileAccentKey) ?? "default"] ?? ACCENTS.default;
}

/** Status chip classes shared by mobile job cards. */
export function getStatusChipClass(status?: string | null): string {
  switch ((status || "").toLowerCase()) {
    case "confirmado":
      return "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400";
    case "tentativa":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
    case "completado":
      return "bg-purple-500/15 text-purple-600 dark:text-purple-400";
    case "cancelado":
      return "bg-red-500/15 text-red-600 dark:text-red-400";
    default:
      return "bg-slate-500/15 text-slate-600 dark:text-slate-400";
  }
}
