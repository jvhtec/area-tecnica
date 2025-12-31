import React, { useEffect, useRef } from 'react';

export const PanelContainer: React.FC<{ children: React.ReactNode; theme?: 'light' | 'dark' }> = ({
  children,
  theme = 'light',
}) => (
  <div className={`w-full p-6 space-y-4 ${theme === 'light' ? 'bg-white text-zinc-900' : 'bg-black text-white'}`}>
    {children}
  </div>
);

export const StatusDot: React.FC<{ color: 'green' | 'yellow' | 'red' }> = ({ color }) => (
  <span
    className={`inline-block w-3 h-3 rounded-full mr-2 ${
      color === 'green' ? 'bg-green-500' : color === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'
    }`}
  />
);

export const AutoScrollWrapper: React.FC<{ children: React.ReactNode; speed?: number; resetKey?: string | number }> = ({
  children,
  speed = 150,
  resetKey,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      console.log('AutoScrollWrapper: no container', { speed, resetKey });
      return;
    }

    container.scrollTop = 0;
    console.log('AutoScrollWrapper: starting', {
      speed,
      resetKey,
      clientHeight: container.clientHeight,
      scrollHeight: container.scrollHeight,
      canScroll: container.scrollHeight > container.clientHeight,
    });

    let frameId: number | null = null;
    let lastTime = performance.now();
    let direction: 1 | -1 = 1;
    let isPaused = false;
    let pauseTimeoutId: number | null = null;
    let debugFrames = 0;
    let position = container.scrollTop;

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (dt <= 0 || dt > 1) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      if (debugFrames < 10) debugFrames++;

      const maxScroll = container.scrollHeight - container.clientHeight;

      if (maxScroll > 0 && !isPaused) {
        const delta = (speed ?? 0) * dt;
        const before = position;
        let next = before + direction * delta;

        if (direction === 1 && next >= maxScroll) {
          next = maxScroll;
          isPaused = true;
          console.log('AutoScrollWrapper: hit bottom, pausing', { maxScroll });
          pauseTimeoutId = window.setTimeout(() => {
            isPaused = false;
            direction = -1;
            console.log('AutoScrollWrapper: resume, direction up');
          }, 1000);
        } else if (direction === -1 && next <= 0) {
          next = 0;
          isPaused = true;
          console.log('AutoScrollWrapper: hit top, pausing');
          pauseTimeoutId = window.setTimeout(() => {
            isPaused = false;
            direction = 1;
            console.log('AutoScrollWrapper: resume, direction down');
          }, 1000);
        }

        position = next;
        container.scrollTop = position;
        if (debugFrames < 10) {
          console.log('AutoScrollWrapper: moved', { before, next, maxScroll });
        }
      } else if (maxScroll <= 0 && debugFrames === 1) {
        console.log('AutoScrollWrapper: no scrollable overflow', {
          clientHeight: container.clientHeight,
          scrollHeight: container.scrollHeight,
          speed,
          resetKey,
        });
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (pauseTimeoutId !== null) {
        window.clearTimeout(pauseTimeoutId);
      }
    };
  }, [speed, resetKey]);

  return (
    <div ref={scrollContainerRef} className="h-full overflow-y-auto scrollbar-hide" style={{ scrollBehavior: 'auto' }}>
      {children}
    </div>
  );
};

