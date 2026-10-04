// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShortcutStore } from '@/stores/useShortcutStore';
import { useSelectedCellStore } from '@/stores/useSelectedCellStore';
import { useMatrixShortcutRegistration } from '@/features/matrix-v2/keyboard/useMatrixShortcutRegistration';

const makeActions = () => ({ open: vi.fn(), confirm: vi.fn(), decline: vi.fn(), remove: vi.fn(), toggleUnavailable: vi.fn() });
const IDS = ['matrix-open-cell', 'matrix-confirm', 'matrix-decline', 'matrix-remove', 'matrix-unavailable'];

describe('useMatrixShortcutRegistration', () => {
  afterEach(() => {
    useSelectedCellStore.getState().clearSelection();
    for (const id of IDS) useShortcutStore.getState().unregisterShortcut(id);
  });

  it('registers the matrix shortcuts for Stream Deck, and removes them on unmount', () => {
    const view = renderHook(() => useMatrixShortcutRegistration(true, makeActions(), null));
    const registered = useShortcutStore.getState().getShortcutsByCategory('matrix').map((shortcut) => shortcut.id);
    expect(registered).toEqual(expect.arrayContaining(IDS));
    // None claims a global keybind: the keys belong to the focused grid.
    expect(useShortcutStore.getState().getShortcutsByCategory('matrix').every((shortcut) => !shortcut.defaultKeybind)).toBe(true);
    view.unmount();
    expect(useShortcutStore.getState().getShortcutsByCategory('matrix')).toEqual([]);
  });

  it('does not register when Matrix v2 is off', () => {
    renderHook(() => useMatrixShortcutRegistration(false, makeActions(), null));
    expect(useShortcutStore.getState().getShortcutsByCategory('matrix')).toEqual([]);
  });

  it('acts on the active cell first', async () => {
    const actions = makeActions();
    renderHook(() => useMatrixShortcutRegistration(true, actions, { technicianId: 't1', dateKey: '2026-10-14' }));
    await useShortcutStore.getState().executeShortcut('matrix-confirm');
    expect(actions.confirm).toHaveBeenCalledWith({ technicianId: 't1', dateKey: '2026-10-14' });
  });

  it('falls back to the cell Stream Deck selected, and does nothing without one', async () => {
    const actions = makeActions();
    renderHook(() => useMatrixShortcutRegistration(true, actions, null));
    await useShortcutStore.getState().executeShortcut('matrix-unavailable');
    expect(actions.toggleUnavailable).not.toHaveBeenCalled();

    useSelectedCellStore.getState().selectCell('t2', new Date(2026, 9, 15));
    await useShortcutStore.getState().executeShortcut('matrix-decline');
    expect(actions.decline).toHaveBeenCalledWith({ technicianId: 't2', dateKey: '2026-10-15' });
  });

  it('uses the latest actions without re-registering', async () => {
    const first = makeActions();
    const second = makeActions();
    const view = renderHook(({ actions }) => useMatrixShortcutRegistration(true, actions, { technicianId: 't1', dateKey: '2026-10-14' }), { initialProps: { actions: first } });
    view.rerender({ actions: second });
    await useShortcutStore.getState().executeShortcut('matrix-remove');
    expect(first.remove).not.toHaveBeenCalled();
    expect(second.remove).toHaveBeenCalledTimes(1);
  });
});
