import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type ConfettiBurstProps = {
  /** A value that changes per burst to vary the pattern. */
  seed: number;
  /**
   * Origin in viewport percentages.
   * Defaults to top-center-ish if not provided.
   */
  origin?: { xPct: number; yPct: number };
  /** Milliseconds until the burst auto-unmounts. */
  ttlMs?: number;
};

type Piece = {
  id: string;
  startOffsetPx: { x: number; y: number };
  driftPx: number;
  popUpPx: number;
  fallPx: number;
  sizePx: number;
  rotateDeg: number;
  durationS: number;
  delayS: number;
  color: string;
  kind: 'rect' | 'circle' | 'emoji';
  emoji?: string;
};

/**
 * Small, fast seeded PRNG so confetti patterns are deterministic per burst.
 * (Not crypto-safe.)
 */
function mulberry32(a: number) {
  let t = a >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS = ['#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
const BALLOONS = ['🎈', '🎉'];

/**
 * Full-screen, short-lived confetti/balloon burst overlay.
 *
 * Intended to be rendered via a portal (document.body) so it appears above dialogs.
 */
export function ConfettiBurst({ seed, origin, ttlMs = 2200 }: ConfettiBurstProps) {
  const reducedMotion = useReducedMotion();
  const [alive, setAlive] = React.useState(true);

  React.useEffect(() => {
    // Each new seed should produce a fresh burst.
    setAlive(true);

    if (reducedMotion) {
      setAlive(false);
      return;
    }

    const t = setTimeout(() => setAlive(false), ttlMs);
    return () => clearTimeout(t);
  }, [seed, ttlMs, reducedMotion]);

  const pieces = React.useMemo(() => {
    const rand = mulberry32(seed);
    const out: Piece[] = [];

    const count = 90;
    for (let i = 0; i < count; i++) {
      const kind: Piece['kind'] = rand() < 0.22 ? 'emoji' : rand() < 0.58 ? 'rect' : 'circle';
      const startOffsetPx = {
        x: (rand() - 0.5) * 60,
        y: (rand() - 0.5) * 40,
      };
      const driftPx = (rand() - 0.5) * 320;
      const popUpPx = 35 + rand() * 55;
      const fallPx = 520 + rand() * 560;
      const sizePx = kind === 'emoji' ? 22 + rand() * 12 : 8 + rand() * 9;
      const rotateDeg = (rand() - 0.5) * 1080;
      const durationS = 1.4 + rand() * 0.9;
      const delayS = rand() * 0.06;
      const color = COLORS[Math.floor(rand() * COLORS.length)]!;
      const emoji = kind === 'emoji' ? BALLOONS[Math.floor(rand() * BALLOONS.length)]! : undefined;
      out.push({
        id: `${seed}-${i}`,
        startOffsetPx,
        driftPx,
        popUpPx,
        fallPx,
        sizePx,
        rotateDeg,
        durationS,
        delayS,
        color,
        kind,
        emoji,
      });
    }

    return out;
  }, [seed]);

  if (!alive) return null;

  const safeOrigin = origin && Number.isFinite(origin.xPct) && Number.isFinite(origin.yPct)
    ? { xPct: Math.min(98, Math.max(2, origin.xPct)), yPct: Math.min(92, Math.max(6, origin.yPct)) }
    : { xPct: 50, yPct: 18 };

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-[9999]">
      {pieces.map((p) => {
        const common: React.CSSProperties = {
          position: 'absolute',
          left: `calc(${safeOrigin.xPct}% + ${p.startOffsetPx.x}px)`,
          top: `calc(${safeOrigin.yPct}% + ${p.startOffsetPx.y}px)`,
        };

        const animate = {
          y: [0, -p.popUpPx, p.fallPx],
          x: [0, p.driftPx],
          opacity: [1, 1, 0],
          rotate: p.rotateDeg,
        };

        if (p.kind === 'emoji' && p.emoji) {
          return (
            <motion.span
              key={p.id}
              style={{ ...common, fontSize: p.sizePx }}
              initial={{ y: 0, x: 0, opacity: 1, rotate: 0, scale: 1 }}
              animate={animate}
              transition={{ duration: p.durationS, delay: p.delayS, ease: 'easeOut' }}
              aria-hidden
            >
              {p.emoji}
            </motion.span>
          );
        }

        const baseStyle: React.CSSProperties = {
          ...common,
          width: p.sizePx,
          height: p.sizePx,
          backgroundColor: p.color,
          borderRadius: p.kind === 'circle' ? 999 : 2,
          opacity: 0.95,
        };

        return (
          <motion.div
            key={p.id}
            style={baseStyle}
            initial={{ y: 0, x: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={animate}
            transition={{ duration: p.durationS, delay: p.delayS, ease: 'easeOut' }}
            aria-hidden
          />
        );
      })}
    </div>
  );
}
