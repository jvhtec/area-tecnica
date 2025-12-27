import React, { useEffect, useRef, useState } from 'react';
import { ANNOUNCEMENT_LEVEL_STYLES } from '@/constants/announcementLevels';
import type { TickerMessage } from '../types';

export const Ticker: React.FC<{
  messages: TickerMessage[];
  bottomOffset?: number;
  theme?: 'light' | 'dark';
  onMeasureHeight?: (h: number) => void;
}> = ({ messages, bottomOffset = 0, theme = 'light', onMeasureHeight }) => {
  const [posX, setPosX] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const gap = 64;
  const contentKey = (messages || []).map((m) => `${m.level}:${m.message}`).join('|');

  const hasMessages = messages.length > 0;

  const renderCopy = (options?: { ref?: (node: HTMLSpanElement | null) => void; paddingLeft?: number }) => (
    <span
      ref={options?.ref}
      className="inline-flex items-center text-30"
      style={options?.paddingLeft ? { paddingLeft: options.paddingLeft } : undefined}
    >
      {messages.map((msg, idx) => (
        <React.Fragment key={`${idx}-${msg.message}`}>
          <span className={`px-2 whitespace-nowrap ${ANNOUNCEMENT_LEVEL_STYLES[msg.level].text}`}>{msg.message}</span>
          {idx < messages.length - 1 && (
            <span className={`px-6 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>•</span>
          )}
        </React.Fragment>
      ))}
    </span>
  );

  useEffect(() => {
    const cw = containerRef.current?.offsetWidth || 0;
    setPosX(cw);
  }, [contentKey]);

  useEffect(() => {
    const cw = containerRef.current?.offsetWidth || 0;
    setPosX(cw);
  }, []);

  useEffect(() => {
    if (!hasMessages) return;
    let raf = 0;
    let last = performance.now();
    const speed = 50;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPosX((prev) => {
        const w = (textRef.current?.offsetWidth || 0) + gap;
        if (w <= 0) return prev;
        let next = prev - speed * dt;
        while (next <= -w) next += w;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [contentKey, hasMessages]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onMeasureHeight) return;
    const report = () => onMeasureHeight(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener('resize', report);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', report);
    };
  }, [onMeasureHeight]);

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-0 left-0 right-0 border-t py-2 text-xl overflow-hidden ${
        theme === 'light' ? 'bg-zinc-100/95 border-zinc-200' : 'bg-zinc-900/95 border-zinc-800'
      }`}
      style={{ bottom: bottomOffset }}
    >
      {hasMessages ? (
        <div className="whitespace-nowrap will-change-transform" style={{ transform: `translateX(${posX}px)` }}>
          {renderCopy({ ref: (node) => { textRef.current = node; } })}
          {renderCopy({ paddingLeft: gap })}
        </div>
      ) : (
        <div>—</div>
      )}
    </div>
  );
};

