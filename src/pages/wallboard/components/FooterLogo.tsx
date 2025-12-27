import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const FooterLogo: React.FC<{ onToggle?: () => void; onMeasure?: (h: number) => void; theme?: 'light' | 'dark' }> =
  ({ onToggle, onMeasure, theme = 'light' }) => {
    const { data } = supabase.storage.from('public logos').getPublicUrl('sectorpro.png');
    const primary = data?.publicUrl;
    const fallbacks = ['/sector pro logo.png', '/icon.png'];
    const [idx, setIdx] = useState(0);
    const sources = primary ? [primary, ...fallbacks] : fallbacks;
    const src = sources[Math.min(idx, sources.length - 1)];
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const report = () => onMeasure && onMeasure(el.offsetHeight);
      report();
      const ro = new ResizeObserver(report);
      ro.observe(el);
      window.addEventListener('resize', report);
      return () => {
        ro.disconnect();
        window.removeEventListener('resize', report);
      };
    }, [onMeasure]);

    return (
      <div
        ref={containerRef}
        className={`fixed bottom-0 left-0 right-0 py-3 border-t flex items-center justify-center z-50 ${
          theme === 'light' ? 'bg-white/70 border-zinc-200' : 'bg-black/70 border-zinc-800'
        }`}
      >
        <img
          src={src}
          alt="Logo de la Empresa"
          className="h-12 w-auto opacity-90 cursor-pointer select-none"
          onError={() => setIdx((i) => i + 1)}
          onClick={() => onToggle && onToggle()}
        />
      </div>
    );
  };

