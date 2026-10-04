// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  select: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/lib/supabase', () => {
  const chain = { eq: vi.fn(), in: vi.fn(), select: mocks.select };
  chain.eq.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  return { supabase: { from: () => ({ upsert: mocks.upsert, delete: () => chain }) } };
});

import {
  clearUnavailable,
  clearUnavailableWithUndo,
  markUnavailable,
  markUnavailableWithUndo,
} from '@/features/matrix-v2/unavailability';

describe('unavailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks days with a day_off row each, once', async () => {
    mocks.upsert.mockResolvedValue({ error: null });
    await markUnavailable('t1', ['2026-10-14', '2026-10-14', '2026-10-15']);
    expect(mocks.upsert).toHaveBeenCalledWith(
      [{ technician_id: 't1', date: '2026-10-14', status: 'day_off' }, { technician_id: 't1', date: '2026-10-15', status: 'day_off' }],
      { onConflict: 'technician_id,date' },
    );
  });

  it('tells the matrix to refresh after a change', async () => {
    mocks.upsert.mockResolvedValue({ error: null });
    const listener = vi.fn();
    window.addEventListener('assignment-updated', listener);
    await markUnavailable('t1', ['2026-10-14']);
    window.removeEventListener('assignment-updated', listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports how many marks it removed', async () => {
    mocks.select.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], error: null });
    expect(await clearUnavailable('t1', ['2026-10-14', '2026-10-15'])).toBe(2);
    mocks.select.mockResolvedValue({ data: [], error: null });
    expect(await clearUnavailable('t1', ['2026-10-14'])).toBe(0);
  });

  it('does nothing for no days', async () => {
    await markUnavailable('t1', []);
    expect(await clearUnavailable('t1', [])).toBe(0);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('offers Deshacer after marking, and undoing clears the day', async () => {
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.select.mockResolvedValue({ data: [{ id: 1 }], error: null });
    expect(await markUnavailableWithUndo('t1', '2026-10-14')).toEqual({ ok: true });
    const [title, options] = mocks.toast.mock.calls[0];
    expect(title).toBe('Marcado como no disponible');
    options.action.onClick();
    await vi.waitFor(() => expect(mocks.select).toHaveBeenCalled());
  });

  it('offers Deshacer after lifting, and undoing marks the day again', async () => {
    mocks.select.mockResolvedValue({ data: [{ id: 1 }], error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    expect(await clearUnavailableWithUndo('t1', '2026-10-14')).toEqual({ ok: true });
    const [title, options] = mocks.toast.mock.calls[0];
    expect(title).toBe('Disponible de nuevo');
    options.action.onClick();
    await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalled());
  });

  it('refuses to lift a mark that lives elsewhere, without a toast', async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });
    const result = await clearUnavailableWithUndo('t1', '2026-10-14');
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('vacaciones') });
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('turns a failed write into a message', async () => {
    mocks.upsert.mockResolvedValue({ error: new Error('rls') });
    expect(await markUnavailableWithUndo('t1', '2026-10-14')).toMatchObject({ ok: false, message: expect.stringContaining('No se pudo marcar') });
    mocks.select.mockResolvedValue({ data: null, error: new Error('rls') });
    expect(await clearUnavailableWithUndo('t1', '2026-10-14')).toMatchObject({ ok: false, message: expect.stringContaining('No se pudo quitar') });
  });
});
