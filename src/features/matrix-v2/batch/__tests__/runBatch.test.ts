import { describe, expect, it, vi } from 'vitest';
import type { MatrixCommandRunner } from '@/features/matrix-v2/commandRunner';
import { batchReversible, combineUndos, forceIntent, problemRows, retryRow, runBatch, runRow, tally } from '@/features/matrix-v2/batch/runBatch';
import type { BatchRow } from '@/features/matrix-v2/batch/types';
import type { MatrixIntent, MatrixRunOutcome, MatrixUndo } from '@/features/matrix-v2/types';
import { makeResult } from '@/features/matrix-v2/__tests__/fixtures';

const makeUndo = (overrides: Partial<MatrixUndo> = {}): MatrixUndo => ({
  commandId: 'c', expiresAt: Date.now() + 8_000, isOpen: () => true, undo: async () => ({ ok: true }), release: () => undefined, ...overrides,
});
const okOutcome = (undo: MatrixUndo | null = makeUndo(), noop = false): MatrixRunOutcome => ({ ok: true, noop, result: makeResult(), undo });
const failure = (code: 'conflict' | 'stale_state' | 'network', message: string = code): MatrixRunOutcome => ({ ok: false, code, message, stale: code === 'stale_state', conflict: null, result: null, retryable: code === 'network' });
const assign = (technicianId: string): MatrixIntent => ({ kind: 'assign', technicianId, jobId: 'job-a', role: 'SND-MON-E', status: 'invited', coverage: 'full', source: 'matrix-batch' });
const makeRow = (id: string, intents: MatrixIntent[] = [assign(id)]): BatchRow => ({
  id: `${id}:job-a`, technicianId: id, name: id, summary: id, intents, next: 0, status: 'pending', changed: false, reversible: true, undos: [],
});
const runnerWith = (run: MatrixCommandRunner['run']): MatrixCommandRunner => ({ run, releaseAll: vi.fn(), loadState: vi.fn() });

describe('runRow', () => {
  it('runs a row\'s commands in order and collects what can be undone', async () => {
    const order: string[] = [];
    const runner = runnerWith(async (intent) => { order.push(intent.kind === 'remove-date' ? intent.date : intent.kind); return okOutcome(null); });
    const row = makeRow('t1', [
      { kind: 'remove-date', technicianId: 't1', jobId: 'job-a', date: '2026-10-13', source: 'matrix-batch' },
      { kind: 'remove-date', technicianId: 't1', jobId: 'job-a', date: '2026-10-14', source: 'matrix-batch' },
    ]);
    const done = await runRow(runner, row);
    expect(order).toEqual(['2026-10-13', '2026-10-14']);
    expect(done).toMatchObject({ status: 'done', next: 2, changed: true, reversible: false });
  });

  it('stops at the first failure and keeps what already committed', async () => {
    const run = vi.fn<MatrixCommandRunner['run']>().mockResolvedValueOnce(okOutcome()).mockResolvedValueOnce(failure('conflict', 'Ya tiene otro trabajo'));
    const row = makeRow('t1', [assign('t1'), assign('t1'), assign('t1')]);
    const done = await runRow(runnerWith(run), row);
    expect(run).toHaveBeenCalledTimes(2);
    expect(done).toMatchObject({ status: 'failed', next: 1, changed: true, message: 'Ya tiene otro trabajo' });
    expect(done.failure?.code).toBe('conflict');
  });

  it('a row where nothing changed is a no-op', async () => {
    const done = await runRow(runnerWith(async () => okOutcome(null, true)), makeRow('t1'));
    expect(done).toMatchObject({ status: 'noop', changed: false });
  });

  it('turns an unexpected exception into a failed row instead of losing the batch', async () => {
    const done = await runRow(runnerWith(async () => { throw new Error('boom'); }), makeRow('t1'));
    expect(done.status).toBe('failed');
  });
});

describe('runBatch', () => {
  it('never has more than three commands in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const runner = runnerWith(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return okOutcome();
    });
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => makeRow(id));
    const done = await runBatch(runner, rows);
    expect(peak).toBe(3);
    expect(done.every((row) => row.status === 'done')).toBe(true);
  });

  it('one failing row does not stop or roll back the others', async () => {
    const runner = runnerWith(async (intent) => (intent.technicianId === 'b' ? failure('conflict') : okOutcome()));
    const seen: string[] = [];
    const done = await runBatch(runner, ['a', 'b', 'c'].map((id) => makeRow(id)), { onRow: (row) => seen.push(`${row.id}:${row.status}`) });
    expect(done.map((row) => row.status)).toEqual(['done', 'failed', 'done']);
    expect(seen).toContain('b:job-a:running');
    expect(problemRows(done).map((row) => row.id)).toEqual(['b:job-a']);
    expect(tally(done)).toMatchObject({ total: 3, done: 2, failed: 1 });
  });

  it('only runs pending rows, leaving skipped ones as the planner set them', async () => {
    const run = vi.fn<MatrixCommandRunner['run']>().mockResolvedValue(okOutcome());
    const rows = [makeRow('a'), { ...makeRow('b'), status: 'skipped' as const }, { ...makeRow('c'), status: 'needs-role' as const }];
    const done = await runBatch(runnerWith(run), rows);
    expect(run).toHaveBeenCalledTimes(1);
    expect(done.map((row) => row.status)).toEqual(['done', 'skipped', 'needs-role']);
  });
});

describe('retry and force', () => {
  it('Forzar reruns only the command that clashed, with the clash accepted', async () => {
    const failed: BatchRow = { ...makeRow('t1', [assign('t1'), assign('t1')]), status: 'failed', next: 1, message: 'x' };
    const forced = retryRow(failed, { force: true });
    expect(forced).toMatchObject({ status: 'pending', message: undefined, failure: null });
    expect(forced.intents[0]).not.toHaveProperty('conflictPolicy');
    expect(forced.intents[1]).toMatchObject({ conflictPolicy: 'allow' });
  });

  it('Reintentar resumes from where the row stopped, with the same intents', async () => {
    const failed: BatchRow = { ...makeRow('t1'), status: 'failed', next: 0 };
    expect(retryRow(failed).intents).toEqual(failed.intents);
  });

  it('only assignments can be forced', () => {
    const confirm: MatrixIntent = { kind: 'confirm', technicianId: 't1', jobId: 'job-a', source: 'matrix-batch' };
    expect(forceIntent(confirm)).toBe(confirm);
  });
});

describe('batch Deshacer', () => {
  it('is offered only when every change can be taken back', () => {
    const done = (reversible: boolean, undos: MatrixUndo[]): BatchRow => ({ ...makeRow('t'), status: 'done', changed: true, reversible, undos });
    expect(batchReversible([done(true, [makeUndo()]), done(true, [makeUndo()])])).toBe(true);
    expect(batchReversible([done(true, [makeUndo()]), done(false, [])])).toBe(false);
    expect(batchReversible([{ ...makeRow('t'), status: 'failed' }])).toBe(false);
  });

  it('undoes every change, and closes with the earliest window', async () => {
    const undone: string[] = [];
    const first = makeUndo({ commandId: '1', expiresAt: 1_000, undo: async () => { undone.push('1'); return { ok: true }; } });
    const second = makeUndo({ commandId: '2', expiresAt: 5_000, undo: async () => { undone.push('2'); return { ok: true }; } });
    const combined = combineUndos([first, second]);
    expect(combined?.expiresAt).toBe(1_000);
    expect(await combined?.undo()).toEqual({ ok: true });
    expect(undone.sort()).toEqual(['1', '2']);
  });

  it('says how many it could not undo', async () => {
    const good = makeUndo();
    const expired = makeUndo({ undo: async () => ({ ok: false, reason: 'expired', message: 'Ya no se puede deshacer' }) });
    const partial = await combineUndos([good, expired])?.undo();
    expect(partial).toMatchObject({ ok: false, message: expect.stringContaining('1 de 2') });
    const none = await combineUndos([expired, expired])?.undo();
    expect(none).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('releases every held effect together', () => {
    const release = vi.fn();
    combineUndos([makeUndo({ release }), makeUndo({ release })])?.release();
    expect(release).toHaveBeenCalledTimes(2);
    expect(combineUndos([])).toBeNull();
  });
});
