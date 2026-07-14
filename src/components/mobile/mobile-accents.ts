/**
 * Accent tokens for the mobile visual language.
 *
 * Every department (and the cross-department dashboard) gets a hue that marks
 * its hub — kicker text, icon chip, selected day, primary CTA, staffing meter —
 * so each screen is recognizable at a glance. The accent is used sparingly:
 * solid single hues on the app's normal surfaces, no gradients or glow.
 * Tailwind cannot build class names dynamically, so each accent enumerates
 * complete class strings.
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
  /** Kicker/eyebrow text color. */
  kicker: string;
  /** Solid filled surface (selected day, primary CTA). */
  fill: string;
  /** Ring/halo used to mark "today" in the week strip. */
  todayRing: string;
  /** Icon chip background inside tiles and headers. */
  chipBg: string;
  /** Icon color inside tiles and headers. */
  chipText: string;
  /** Thin progress bar fill (staffing meter). */
  meter: string;
  /** Focus/emphasis ring for the live (in-progress) agenda card. */
  ring: string;
}

const ACCENTS: Record<MobileAccentKey, MobileAccentTokens> = {
  sound: {
    kicker: "text-sky-600 dark:text-sky-400",
    fill: "bg-sky-600 text-white hover:bg-sky-600/90",
    todayRing: "ring-sky-500/70 text-sky-600 dark:text-sky-400",
    chipBg: "bg-sky-500/15",
    chipText: "text-sky-600 dark:text-sky-400",
    meter: "bg-sky-500",
    ring: "ring-sky-500/50",
  },
  lights: {
    kicker: "text-amber-600 dark:text-amber-400",
    fill: "bg-amber-600 text-white hover:bg-amber-600/90",
    todayRing: "ring-amber-500/70 text-amber-600 dark:text-amber-400",
    chipBg: "bg-amber-500/15",
    chipText: "text-amber-600 dark:text-amber-400",
    meter: "bg-amber-500",
    ring: "ring-amber-500/50",
  },
  video: {
    kicker: "text-violet-600 dark:text-violet-400",
    fill: "bg-violet-600 text-white hover:bg-violet-600/90",
    todayRing: "ring-violet-500/70 text-violet-600 dark:text-violet-400",
    chipBg: "bg-violet-500/15",
    chipText: "text-violet-600 dark:text-violet-400",
    meter: "bg-violet-500",
    ring: "ring-violet-500/50",
  },
  production: {
    kicker: "text-emerald-600 dark:text-emerald-400",
    fill: "bg-emerald-600 text-white hover:bg-emerald-600/90",
    todayRing: "ring-emerald-500/70 text-emerald-600 dark:text-emerald-400",
    chipBg: "bg-emerald-500/15",
    chipText: "text-emerald-600 dark:text-emerald-400",
    meter: "bg-emerald-500",
    ring: "ring-emerald-500/50",
  },
  logistics: {
    kicker: "text-orange-600 dark:text-orange-400",
    fill: "bg-orange-600 text-white hover:bg-orange-600/90",
    todayRing: "ring-orange-500/70 text-orange-600 dark:text-orange-400",
    chipBg: "bg-orange-500/15",
    chipText: "text-orange-600 dark:text-orange-400",
    meter: "bg-orange-500",
    ring: "ring-orange-500/50",
  },
  administrative: {
    kicker: "text-slate-600 dark:text-slate-400",
    fill: "bg-slate-600 text-white hover:bg-slate-600/90",
    todayRing: "ring-slate-500/70 text-slate-600 dark:text-slate-400",
    chipBg: "bg-slate-500/15",
    chipText: "text-slate-600 dark:text-slate-400",
    meter: "bg-slate-500",
    ring: "ring-slate-500/50",
  },
  default: {
    kicker: "text-indigo-600 dark:text-indigo-400",
    fill: "bg-indigo-600 text-white hover:bg-indigo-600/90",
    todayRing: "ring-indigo-500/70 text-indigo-600 dark:text-indigo-400",
    chipBg: "bg-indigo-500/15",
    chipText: "text-indigo-600 dark:text-indigo-400",
    meter: "bg-indigo-500",
    ring: "ring-indigo-500/50",
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
