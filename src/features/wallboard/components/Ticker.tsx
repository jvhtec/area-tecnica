import { Fragment, useEffect, useRef } from 'react';

import type { AnnouncementLevel } from '@/constants/announcementLevels';

import type { TickerMessage } from '../types';

const LEVELS: Record<AnnouncementLevel, { label: string; className: string }> = {
  info: { label: 'INFO', className: 'wb-info' },
  warn: { label: 'AVISO', className: 'wb-warn' },
  critical: { label: 'URGENTE', className: 'wb-crit' },
};

const SPEED_PX_PER_SECOND = 60;

/**
 * Announcement ticker. Each message carries its level as a labelled chip.
 * Renders nothing when there are no announcements.
 */
export const Ticker = ({ messages }: { messages: TickerMessage[] }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);
  const contentKey = messages.map((message) => `${message.level}:${message.message}`).join('|');

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !contentKey) return;
    let frame = 0;
    let last = performance.now();
    let offset = 0;
    const tick = (now: number) => {
      const width = copyRef.current?.offsetWidth ?? 0;
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      if (width > 0) {
        offset = (offset + SPEED_PX_PER_SECOND * dt) % width;
        track.style.transform = `translateX(${-offset}px)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [contentKey]);

  if (!messages.length) return null;

  const renderCopy = (ref?: typeof copyRef) => (
    <div className="wb-ticker-copy" ref={ref} aria-hidden={ref ? undefined : true}>
      {messages.map((message, index) => {
        const level = LEVELS[message.level] ?? LEVELS.info;
        return (
          <Fragment key={`${index}-${message.message}`}>
            <span className="wb-ticker-item">
              <span className={`wb-level ${level.className}`}>{level.label}</span>
              {message.message}
            </span>
            <span className="wb-ticker-sep">/</span>
          </Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="wb-ticker" role="marquee">
      <div className="wb-ticker-track" ref={trackRef}>
        {renderCopy(copyRef)}
        {renderCopy()}
      </div>
    </div>
  );
};
