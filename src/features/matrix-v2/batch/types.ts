import type { MatrixIntent, MatrixRunOutcome, MatrixUndo } from '@/features/matrix-v2/types';

export type BatchRowStatus = 'pending' | 'running' | 'done' | 'noop' | 'failed' | 'skipped' | 'needs-role';

export type BatchFailure = Extract<MatrixRunOutcome, { ok: false }>;

/** What a batch does to one job/technician pair: one row, one command per intent, run in order. */
export interface BatchRow {
  /** `${technicianId}:${jobId}`, unique within a batch. */
  id: string;
  technicianId: string;
  name: string;
  /** "Festival Lúa · mar 13 – jue 15". */
  summary: string;
  intents: MatrixIntent[];
  /** Index of the next intent to run, so a retry resumes where the row stopped. */
  next: number;
  status: BatchRowStatus;
  /** Why a row was skipped or failed, in words for the manager. */
  message?: string;
  failure?: BatchFailure | null;
  /** True once at least one command actually changed something. */
  changed: boolean;
  /** Every change so far can be taken back with Deshacer. */
  reversible: boolean;
  undos: MatrixUndo[];
  /** A cell to open for the details ("Abrir"). */
  openAt?: { technicianId: string; dateKey: string };
}

export interface BatchTally {
  total: number;
  done: number;
  noop: number;
  failed: number;
  skipped: number;
  needsRole: number;
}
