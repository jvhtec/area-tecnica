export type AnnouncementLevel = 'info' | 'warn' | 'critical';

export const tickerLevelStyles: Record<AnnouncementLevel, string> = {
  info: 'bg-sky-500/25 text-sky-50 border border-sky-400/50',
  warn: 'bg-amber-500/25 text-amber-50 border border-amber-400/50',
  critical: 'bg-red-500/25 text-red-50 border border-red-400/50',
};

export const tickerLevelDotStyles: Record<AnnouncementLevel, string> = {
  info: 'bg-sky-400',
  warn: 'bg-amber-400',
  critical: 'bg-red-400',
};

export interface TickerMessageChunk {
  message: string;
  level: AnnouncementLevel;
}
