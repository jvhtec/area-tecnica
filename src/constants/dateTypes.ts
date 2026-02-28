import type { LucideIcon } from "lucide-react";
import { HardHat, Mic, Moon, Plane, Star, Wrench } from "lucide-react";

export type DateType = "travel" | "setup" | "rigging" | "show" | "off" | "rehearsal";

export interface DateTypeMeta {
  value: DateType;
  label: string;
  labelEs: string;
  emoji: string;
  shortLabel: string;
  icon: LucideIcon;
  iconClassName: string;
  badgeClassName: string;
  festivalBorderClassName: string;
  festivalBackgroundClassName: string;
  festivalBadgeColorClassName: string;
  isNonWorking: boolean;
  isSingleDay: boolean;
  isKeyFestivalDay: boolean;
  xlsBg: string;
  xlsText: string;
}

export const DATE_TYPE_ORDER: DateType[] = ["travel", "setup", "rigging", "show", "off", "rehearsal"];
export const TOUR_DATE_TYPE_ORDER: DateType[] = ["show", "rehearsal", "travel", "setup", "rigging", "off"];

export const DATE_TYPE_META: Record<DateType, DateTypeMeta> = {
  travel: {
    value: "travel",
    label: "Travel",
    labelEs: "Viaje",
    emoji: "✈️",
    shortLabel: "V",
    icon: Plane,
    iconClassName: "text-blue-500",
    badgeClassName: "bg-blue-100 text-blue-800 border-blue-200",
    festivalBorderClassName: "border-blue-500",
    festivalBackgroundClassName: "bg-blue-50",
    festivalBadgeColorClassName: "bg-blue-500",
    isNonWorking: true,
    isSingleDay: true,
    isKeyFestivalDay: false,
    xlsBg: "DBEAFE",
    xlsText: "2563EB",
  },
  setup: {
    value: "setup",
    label: "Setup",
    labelEs: "Montaje",
    emoji: "🔧",
    shortLabel: "M",
    icon: Wrench,
    iconClassName: "text-amber-500",
    badgeClassName: "bg-amber-100 text-amber-800 border-amber-200",
    festivalBorderClassName: "border-amber-500",
    festivalBackgroundClassName: "bg-amber-50",
    festivalBadgeColorClassName: "bg-amber-500",
    isNonWorking: false,
    isSingleDay: true,
    isKeyFestivalDay: true,
    xlsBg: "FEF9C3",
    xlsText: "A16207",
  },
  rigging: {
    value: "rigging",
    label: "Rigging",
    labelEs: "Rigging",
    emoji: "⛓️",
    shortLabel: "R",
    icon: HardHat,
    iconClassName: "text-orange-600",
    badgeClassName: "bg-orange-100 text-orange-800 border-orange-200",
    festivalBorderClassName: "border-orange-500",
    festivalBackgroundClassName: "bg-orange-50",
    festivalBadgeColorClassName: "bg-orange-500",
    isNonWorking: false,
    isSingleDay: true,
    isKeyFestivalDay: true,
    xlsBg: "FFEDD5",
    xlsText: "C2410C",
  },
  show: {
    value: "show",
    label: "Show",
    labelEs: "Concierto",
    emoji: "🎭",
    shortLabel: "S",
    icon: Star,
    iconClassName: "text-green-500",
    badgeClassName: "bg-green-100 text-green-800 border-green-200",
    festivalBorderClassName: "border-green-500",
    festivalBackgroundClassName: "bg-green-50",
    festivalBadgeColorClassName: "bg-green-500",
    isNonWorking: false,
    isSingleDay: true,
    isKeyFestivalDay: true,
    xlsBg: "DCFCE7",
    xlsText: "16A34A",
  },
  off: {
    value: "off",
    label: "Off",
    labelEs: "Día libre",
    emoji: "😴",
    shortLabel: "O",
    icon: Moon,
    iconClassName: "text-gray-500",
    badgeClassName: "bg-gray-100 text-gray-800 border-gray-200",
    festivalBorderClassName: "border-gray-500",
    festivalBackgroundClassName: "bg-gray-50",
    festivalBadgeColorClassName: "bg-gray-500",
    isNonWorking: true,
    isSingleDay: true,
    isKeyFestivalDay: false,
    xlsBg: "F3F4F6",
    xlsText: "6B7280",
  },
  rehearsal: {
    value: "rehearsal",
    label: "Rehearsal",
    labelEs: "Ensayo",
    emoji: "🎵",
    shortLabel: "E",
    icon: Mic,
    iconClassName: "text-violet-500",
    badgeClassName: "bg-violet-100 text-violet-800 border-violet-200",
    festivalBorderClassName: "border-violet-500",
    festivalBackgroundClassName: "bg-violet-50",
    festivalBadgeColorClassName: "bg-violet-500",
    isNonWorking: false,
    isSingleDay: false,
    isKeyFestivalDay: true,
    xlsBg: "EDE9FE",
    xlsText: "7C3AED",
  },
};

export function isDateType(value: string): value is DateType {
  return value in DATE_TYPE_META;
}

export function getDateTypeMeta(value?: string | null): DateTypeMeta | null {
  if (!value || !isDateType(value)) return null;
  return DATE_TYPE_META[value];
}

export function isNonWorkingDateType(value?: string | null): boolean {
  return getDateTypeMeta(value)?.isNonWorking ?? false;
}

export function isSingleDayDateType(value?: string | null): boolean {
  return getDateTypeMeta(value)?.isSingleDay ?? false;
}

export function isKeyFestivalDateType(value?: string | null): boolean {
  return getDateTypeMeta(value)?.isKeyFestivalDay ?? false;
}

export const DATE_TYPE_OPTIONS = DATE_TYPE_ORDER.map((type) => DATE_TYPE_META[type]);
export const TOUR_DATE_TYPE_OPTIONS = TOUR_DATE_TYPE_ORDER.map((type) => DATE_TYPE_META[type]);
