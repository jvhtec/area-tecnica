import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type ConfettiBurstProps = {
  /** A value that changes per burst to vary the pattern. */
  seed: number;
  /** Milliseconds until the burst auto-unmounts. */
  ttlMs?: number;
};

type Piece = {
  id: string;
  xPct: number;
  driftPx: number;
  sizePx: number;
  rotateDeg: number;
  durationS: number;
  delayS: number;
  color: string;
  kind: 'rect' | 'circle' | 'emoji';
  emoji?: string;
};

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

export function ConfettiBurst({ seed, ttlMs = 1600 }: ConfettiBurstProps) {
  const reducedMotion = useReducedMotion();
  const [alive, setAlive] = React.useState(true);

  React.useEffect(() => {
    if (reducedMotion) {
      setAlive(false);
      return;
    }
    const t = setTimeout(() => setAlive(false), ttlMs);
    return () => clearTimeout(t);
  }, [ttlMs, reducedMotion]);

  const pieces = React.useMemo(() => {
    const rand = mulberry32(seed);
    const out: Piece[] = [];

    const count = 26;
    for (let i = 0; i < count; i++) {
      const kind: Piece['kind'] = rand() < 0.12 ? 'emoji' : rand() < 0.55 ? 'rect' : 'circle';
      const xPct = 8 + rand() * 84;
      const driftPx = (rand() - 0.5) * 140;
      const sizePx = kind === 'emoji' ? 16 + rand() * 10 : 6 + rand() * 7;
      const rotateDeg = (rand() - 0.5) * 720;
      const durationS = 0.9 + rand() * 0.7;
      const delayS = rand() * 0.08;
      const color = COLORS[Math.floor(rand() * COLORS.length)]!;
      const emoji = kind === 'emoji' ? BALLOONS[Math.floor(rand() * BALLOONS.length)]! : undefined;
      out.push({
        id: `${seed}-${i}`,
        xPct,
        driftPx,
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

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-[9999]">
      {pieces.map((p) => {
        const common = {
          position: 'absolute' as const,
          left: `${p.xPct}%`,
          top: '-8px',
        };

        if (p.kind === 'emoji' && p.emoji) {
          return (
            <motion.span
              key={p.id}
              style={{ ...common, fontSize: p.sizePx }}
              initial={{ y: -10, opacity: 1, rotate: 0 }}
              animate={{
                y: '110%',
                x: p.driftPx,
                opacity: [1, 1, 0],
                rotate: p.rotateDeg,
              }}
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
            initial={{ y: -10, opacity: 1, rotate: 0 }}
            animate={{
              y: '110%',
              x: p.driftPx,
              opacity: [1, 1, 0],
              rotate: p.rotateDeg,
            }}
            transition={{ duration: p.durationS, delay: p.delayS, ease: 'easeOut' }}
            aria-hidden
          />
        );
      })}
    </div>
  );
}
