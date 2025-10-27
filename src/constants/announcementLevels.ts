export type AnnouncementLevel = 'info' | 'warn' | 'critical';

interface AnnouncementLevelStyles {
  text: string;
  badge: string;
  dot: string;
}

export const ANNOUNCEMENT_LEVEL_STYLES: Record<AnnouncementLevel, AnnouncementLevelStyles> = {
  info: {
    text: 'text-sky-300',
    badge: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
    dot: 'bg-sky-400',
  },
  warn: {
    text: 'text-amber-300 font-semibold',
    badge: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    dot: 'bg-amber-300',
  },
  critical: {
    text: 'text-red-300 font-bold',
    badge: 'border-red-500/50 bg-red-500/15 text-red-200',
    dot: 'bg-red-400',
  },
};
