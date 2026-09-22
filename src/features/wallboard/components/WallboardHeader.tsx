import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { formatAgo, formatMadridTime } from '../format';

const LOGO_FALLBACKS = ['/sector pro logo.png', '/icon.png'];

type Props = {
  title: string;
  subtitle?: string | null;
  panelCount: number;
  panelIndex: number;
  lastUpdatedAt: number | null;
  staleAfterMs: number;
};

/**
 * Slim header shared by every panel: identity, what is on screen, where the
 * rotation is, how fresh the data is, and the Madrid time.
 */
export const WallboardHeader = ({
  title,
  subtitle,
  panelCount,
  panelIndex,
  lastUpdatedAt,
  staleAfterMs,
}: Props) => {
  const [now, setNow] = useState(() => Date.now());
  const [logoIndex, setLogoIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);

  const { data } = supabase.storage.from('public logos').getPublicUrl('sectorpro.png');
  const sources = data?.publicUrl ? [data.publicUrl, ...LOGO_FALLBACKS] : LOGO_FALLBACKS;
  const logo = sources[Math.min(logoIndex, sources.length - 1)];

  const isStale = lastUpdatedAt !== null && now - lastUpdatedAt > staleAfterMs;
  const freshness = lastUpdatedAt === null ? 'Conectando…' : `Actualizado ${formatAgo(lastUpdatedAt, now)}`;

  return (
    <header className="wb-header">
      <img
        src={logo}
        alt="Sector-Pro"
        className="wb-brand"
        decoding="async"
        onError={() => setLogoIndex((index) => index + 1)}
      />
      <span className="wb-title">{title}</span>
      {subtitle ? <span className="wb-subtitle">{subtitle}</span> : null}
      <div className="wb-dots" aria-hidden="true">
        {Array.from({ length: panelCount }, (_, index) => (
          <i key={index} className={index === panelIndex ? 'is-on' : undefined} />
        ))}
      </div>
      <span className={`wb-fresh${isStale ? ' is-stale' : ''}`} role="status">
        {freshness}
      </span>
      <span className="wb-clock">{formatMadridTime(new Date(now))}</span>
    </header>
  );
};
