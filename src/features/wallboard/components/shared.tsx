import type { ReactNode } from 'react';

import type { JobReadiness } from '../model';

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The job's own colour, shown as a small swatch so it never competes with status colours. */
export const JobSwatch = ({ color, small = false }: { color?: string | null; small?: boolean }) => (
  <span
    className={`wb-swatch${small ? ' is-small' : ''}`}
    style={color && HEX_COLOR.test(color) ? { backgroundColor: color } : undefined}
    aria-hidden="true"
  />
);

const URGENCY_CLASS: Record<JobReadiness['urgency'], string> = { crit: 'wb-crit', warn: 'wb-warn', ok: 'wb-ok' };

export const StatusPill = ({ readiness }: { readiness: JobReadiness }) => (
  <span className={`wb-pill ${URGENCY_CLASS[readiness.urgency]}`}>{readiness.label}</span>
);

export const EmptyState = ({ children, ok = false }: { children: ReactNode; ok?: boolean }) => (
  <div className={`wb-empty${ok ? ' is-ok' : ''}`}>{children}</div>
);
